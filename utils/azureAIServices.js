import dotenv from "dotenv";
import sdk from "microsoft-cognitiveservices-speech-sdk";
import { v4 as uuidv4 } from "uuid";
import { BlobServiceClient } from "@azure/storage-blob";
import { format } from "date-fns";
import { Readable, PassThrough } from "stream";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import _ from "lodash";
import { diffArrays } from "diff";
import openai_prompt from "../utils/prompts.js";
import { AzureOpenAI } from "openai";
import OpenAI from "openai";
import fs from "fs";
import { promisify } from "util";
import { tmpdir } from "os";
import { join } from "path";
import { ElevenLabsClient } from "elevenlabs";

dotenv.config();
ffmpeg.setFfmpegPath(ffmpegPath);

async function uploadAudioToAzure(audioData) {
    // Generate a unique file name with timestamp and UUID
    const timestamp = format(new Date(), "yyyyMMddHHmmssSSS");
    const uniqueID = uuidv4();
    const baseFileName = `tts_audio_${uniqueID}.mp3`;
    const filename = `${timestamp}-${uniqueID}-${baseFileName}`;

    const containerName = "beajdocuments";
    const azureBlobConnectionString =
        process.env.AZURE_BLOB_CONNECTION_STRING;

    if (!azureBlobConnectionString) {
        throw new Error(
            "Azure Blob Storage connection string is not defined in environment variables."
        );
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(
        azureBlobConnectionString
    );

    const containerClient =
        blobServiceClient.getContainerClient(containerName);

    await containerClient.createIfNotExists({
        access: "container",
    });

    const blobClient = containerClient.getBlockBlobClient(filename);
    const blockBlobClient = blobClient.getBlockBlobClient();

    await blockBlobClient.uploadData(audioData, {
        blobHTTPHeaders: { blobContentType: "audio/mpeg" },
    });

    const blobUrl = blockBlobClient.url;
    return blobUrl;
};

async function azureTextToSpeechAndUpload(text) {
    const client = new ElevenLabsClient({
        apiKey: process.env.ELEVENLABS_API_KEY,
    });
    const audio = await client.generate({
        voice: "NH0AbpVpD8W8R6jnEwVU",
        model_id: "eleven_multilingual_v2",
        text,
    });

    // Save to temporary file and then read it as a buffer
    const tempFileName = `temp-${uuidv4()}.mp3`;
    const tempFilePath = join(tmpdir(), tempFileName);
    const tempFileStream = fs.createWriteStream(tempFilePath);
    audio.pipe(tempFileStream);

    return new Promise((resolve, reject) => {
        tempFileStream.on("finish", async () => {
            try {
                const audioBuffer = fs.readFileSync(tempFilePath);
                const audioUrl = await uploadAudioToAzure(audioBuffer);
                resolve(audioUrl);
            } catch (err) {
                reject(err);
            } finally {
                fs.unlinkSync(tempFilePath);
            }
        });
    });
}



function convertOggToWav(oggBuffer) {
    return new Promise((resolve, reject) => {
        const oggStream = new PassThrough();
        oggStream.end(oggBuffer);

        const wavData = [];
        const wavStream = new PassThrough();
        wavStream.on("data", (chunk) => wavData.push(chunk));
        wavStream.on("end", () => resolve(Buffer.concat(wavData)));
        wavStream.on("error", (err) => reject(err));

        ffmpeg(oggStream)
            .format("wav")
            .audioCodec("pcm_s16le")
            .audioChannels(1)
            .audioFrequency(16000)
            .on("error", (err) => reject(err))
            .pipe(wavStream);
    });
}

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

async function openaiSpeechToText(audioBuffer) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);

    const uniqueFileName = `audio-${uuidv4()}.ogg`;
    const tempFilePath = join(tmpdir(), uniqueFileName);

    try {
        await writeFile(tempFilePath, audioBuffer);

        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: "whisper-1",
            language: 'en'
        });
        return transcription.text;
    } finally {
        await unlink(tempFilePath);
    }
};

async function openaiSpeechToTextAnyLanguage(audioBuffer) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);

    const uniqueFileName = `audio-${uuidv4()}.ogg`;
    const tempFilePath = join(tmpdir(), uniqueFileName);

    try {
        await writeFile(tempFilePath, audioBuffer);

        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: "whisper-1",
            language: 'en'
        });
        return transcription.text;
    } finally {
        await unlink(tempFilePath);
    }
};

async function azureSpeechToText(audioBuffer) {
    return new Promise(async (resolve, reject) => {
        try {
            const wavBuffer = await convertOggToWav(audioBuffer);

            const speechConfig = sdk.SpeechConfig.fromSubscription(
                process.env.AZURE_CUSTOM_VOICE_KEY,
                process.env.AZURE_CUSTOM_VOICE_REGION
            );
            speechConfig.speechRecognitionLanguage = "en-US";

            const audioFormat = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);

            const pushStream = sdk.AudioInputStream.createPushStream(audioFormat);
            pushStream.write(wavBuffer);
            pushStream.close();

            const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

            const speechRecognizer = new sdk.SpeechRecognizer(
                speechConfig,
                audioConfig
            );

            speechRecognizer.recognizeOnceAsync((result) => {
                switch (result.reason) {
                    case sdk.ResultReason.RecognizedSpeech:
                        resolve(result.text);
                        break;
                    case sdk.ResultReason.NoMatch:
                        console.log("NOMATCH: Speech could not be recognized.");
                        resolve(null);
                        break;
                    case sdk.ResultReason.Canceled:
                        const cancellation = sdk.CancellationDetails.fromResult(result);
                        console.log(`CANCELED: Reason=${cancellation.reason}`);

                        if (cancellation.reason == sdk.CancellationReason.Error) {
                            console.log(`CANCELED: ErrorCode=${cancellation.ErrorCode}`);
                            console.log(
                                `CANCELED: ErrorDetails=${cancellation.errorDetails}`
                            );
                            console.log(
                                "CANCELED: Did you set the speech resource key and region values?"
                            );
                        }
                        reject(
                            new Error(`Speech recognition canceled: ${cancellation.reason}`)
                        );
                        break;
                }
                speechRecognizer.close();
            });
        } catch (err) {
            console.error("Error during speech recognition:", err);
            reject(err);
        }
    });
}

async function azureSpeechToTextAnyLanguage(audioBuffer) {
    return new Promise(async (resolve, reject) => {
        try {
            const wavBuffer = await convertOggToWav(audioBuffer);

            const speechConfig = sdk.SpeechConfig.fromSubscription(
                process.env.AZURE_CUSTOM_VOICE_KEY,
                process.env.AZURE_CUSTOM_VOICE_REGION
            );
            const autoDetectSourceLanguageConfig = sdk.AutoDetectSourceLanguageConfig.fromLanguages(["en-US", "ur-IN"]);

            const audioFormat = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);

            const pushStream = sdk.AudioInputStream.createPushStream(audioFormat);
            pushStream.write(wavBuffer);
            pushStream.close();

            const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

            const speechRecognizer = sdk.SpeechRecognizer.FromConfig(
                speechConfig,
                autoDetectSourceLanguageConfig,
                audioConfig
            );

            speechRecognizer.recognizeOnceAsync((result) => {
                switch (result.reason) {
                    case sdk.ResultReason.RecognizedSpeech:
                        resolve(result);
                        break;
                }
                speechRecognizer.close();
            });
        } catch (err) {
            console.error("Error during speech recognition:", err);
            reject(err);
        }
    });
}

async function azurePronunciationAssessment(audioBuffer, referenceText) {
    return new Promise(async (resolve, reject) => {
        try {
            const wavBuffer = await convertOggToWav(audioBuffer);

            const speechConfig = sdk.SpeechConfig.fromSubscription(
                process.env.AZURE_CUSTOM_VOICE_KEY,
                process.env.AZURE_CUSTOM_VOICE_REGION
            );
            speechConfig.speechRecognitionLanguage = "en-US";

            const audioFormat = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);

            const pushStream = sdk.AudioInputStream.createPushStream(audioFormat);
            pushStream.write(wavBuffer);
            pushStream.close();

            const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

            const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

            const pronunciationAssessmentConfig =
                new sdk.PronunciationAssessmentConfig(
                    referenceText,
                    sdk.PronunciationAssessmentGradingSystem.HundredMark,
                    sdk.PronunciationAssessmentGranularity.Phoneme,
                    true
                );
            pronunciationAssessmentConfig.enableProsodyAssessment = true;
            pronunciationAssessmentConfig.applyTo(recognizer);

            const scoreNumber = {
                accuracyScore: 0,
                fluencyScore: 0,
                compScore: 0,
                prosodyScore: 0,
                pronScore: 0,
            };
            const allWords = [];
            let currentText = [];
            let startOffset = 0;
            const recognizedWords = [];
            const fluencyScores = [];
            const prosodyScores = [];
            const durations = [];
            let jo = {};

            recognizer.recognizing = function (s, e) { };

            recognizer.recognized = function (s, e) {
                var pronunciation_result = sdk.PronunciationAssessmentResult.fromResult(
                    e.result
                );

                jo = JSON.parse(
                    e.result.properties.getProperty(
                        sdk.PropertyId.SpeechServiceResponse_JsonResult
                    )
                );
                const nb = jo["NBest"][0];
                if (nb.Words && nb.Words.length > 0) {
                    startOffset = nb.Words[0].Offset;
                    const localtext = nb.Words.map((item) => item.Word.toLowerCase());
                    currentText = currentText.concat(localtext);
                    fluencyScores.push(nb.PronunciationAssessment.FluencyScore);
                    prosodyScores.push(nb.PronunciationAssessment.ProsodyScore);
                    const isSucceeded = jo.RecognitionStatus === "Success";
                    const nBestWords = jo.NBest[0].Words;
                    const durationList = [];
                    nBestWords.forEach((word) => {
                        recognizedWords.push(word);
                        durationList.push(word.Duration);
                    });
                    durations.push(_.sum(durationList));

                    if (isSucceeded && nBestWords) {
                        allWords.push(...nBestWords);
                    }
                }
            };

            recognizer.canceled = function (s, e) {
                if (e.reason === sdk.CancellationReason.Error) {
                    var str = `(cancel) Reason: ${sdk.CancellationReason[e.reason]}: ${e.errorDetails
                        }`;
                }
                recognizer.stopContinuousRecognitionAsync();
            };

            recognizer.sessionStarted = function (s, e) { };

            recognizer.sessionStopped = function (s, e) {
                recognizer.stopContinuousRecognitionAsync();
                recognizer.close();
                const result = calculateOverallPronunciationScore();
                resolve(result);
            };

            function calculateOverallPronunciationScore() {
                const resText = currentText.join(" ");
                let wholelyricsArry = [];
                let resTextArray = [];

                const language = speechConfig.speechRecognitionLanguage;
                let resTextProcessed = (resText.toLocaleLowerCase() ?? "")
                    .replace(new RegExp('[!"#$%&()*+,-./:;<=>?@[^_`{|}~]+', "g"), "")
                    .replace(new RegExp("]+", "g"), "");
                let wholelyrics = (referenceText.toLocaleLowerCase() ?? "")
                    .replace(new RegExp('[!"#$%&()*+,-./:;<=>?@[^_`{|}~]+', "g"), "")
                    .replace(new RegExp("]+", "g"), "");
                wholelyricsArry = wholelyrics.split(" ").filter((item) => item.trim());
                resTextArray = resTextProcessed
                    .split(" ")
                    .filter((item) => item.trim());

                const diffs = diffArrays(wholelyricsArry, resTextArray);
                const lastWords = [];

                diffs.forEach((part) => {
                    if (part.added) {
                        part.value.forEach((word) => {
                            const indexInAllWords = currentText.indexOf(word);
                            if (
                                indexInAllWords !== -1 &&
                                allWords[indexInAllWords].PronunciationAssessment.ErrorType !==
                                "Insertion"
                            ) {
                                allWords[indexInAllWords].PronunciationAssessment.ErrorType =
                                    "Insertion";
                            }
                            lastWords.push(allWords[indexInAllWords]);
                        });
                    } else if (part.removed) {
                        part.value.forEach((word) => {
                            const wordObj = {
                                Word: word,
                                PronunciationAssessment: {
                                    ErrorType: "Omission",
                                },
                            };
                            lastWords.push(wordObj);
                        });
                    } else {
                        part.value.forEach((word) => {
                            const indexInAllWords = currentText.indexOf(word);
                            if (indexInAllWords !== -1) {
                                if (
                                    allWords[indexInAllWords].PronunciationAssessment
                                        .ErrorType !== "None"
                                ) {
                                    allWords[indexInAllWords].PronunciationAssessment.ErrorType =
                                        "None";
                                }
                                lastWords.push(allWords[indexInAllWords]);
                            }
                        });
                    }
                });

                const reference_words = wholelyricsArry;

                let recognizedWordsRes = [];
                recognizedWords.forEach((word) => {
                    if (word.PronunciationAssessment.ErrorType === "None") {
                        recognizedWordsRes.push(word);
                    }
                });

                let compScore = Number(
                    ((recognizedWordsRes.length / reference_words.length) * 100).toFixed(
                        0
                    )
                );
                if (compScore > 100) {
                    compScore = 100;
                }
                scoreNumber.compScore = compScore;

                const accuracyScores = [];
                lastWords.forEach((word) => {
                    if (
                        word &&
                        word?.PronunciationAssessment?.ErrorType !== "Insertion"
                    ) {
                        accuracyScores.push(
                            Number(word?.PronunciationAssessment.AccuracyScore ?? 0)
                        );
                    }
                });
                scoreNumber.accuracyScore = Number(
                    (_.sum(accuracyScores) / accuracyScores.length).toFixed(0)
                );

                if (startOffset) {
                    const sumRes = [];
                    fluencyScores.forEach((x, index) => {
                        sumRes.push(x * durations[index]);
                    });
                    scoreNumber.fluencyScore = _.sum(sumRes) / _.sum(durations);
                }
                scoreNumber.prosodyScore = Number(
                    (_.sum(prosodyScores) / prosodyScores.length).toFixed(0)
                );

                const sortScore = Object.keys(scoreNumber).sort(function (a, b) {
                    return scoreNumber[a] - scoreNumber[b];
                });

                if (
                    jo.RecognitionStatus === "Success" ||
                    jo.RecognitionStatus === "Failed"
                ) {
                    scoreNumber.pronScore = Number(
                        (
                            scoreNumber[sortScore[0]] * 0.4 +
                            scoreNumber[sortScore[1]] * 0.2 +
                            scoreNumber[sortScore[2]] * 0.2 +
                            scoreNumber[sortScore[3]] * 0.2
                        ).toFixed(0)
                    );
                } else {
                    scoreNumber.pronScore = Number(
                        (
                            scoreNumber.accuracyScore * 0.5 +
                            scoreNumber.fluencyScore * 0.5
                        ).toFixed(0)
                    );
                }

                lastWords.forEach((word, ind) => { });

                return {
                    scoreNumber,
                    words: lastWords,
                };
            }

            recognizer.startContinuousRecognitionAsync();
        } catch (err) {
            console.error("Error during pronunciation assessment:", err);
            reject(err);
        }
    });
}

async function azurePronunciationSpeakingAssessment(audioBuffer) {
    return new Promise(async (resolve, reject) => {
        try {
            const wavBuffer = await convertOggToWav(audioBuffer);

            const speechConfig = sdk.SpeechConfig.fromSubscription(
                process.env.AZURE_CUSTOM_VOICE_KEY,
                process.env.AZURE_CUSTOM_VOICE_REGION
            );
            speechConfig.speechRecognitionLanguage = "en-US";

            const audioFormat = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);

            const pushStream = sdk.AudioInputStream.createPushStream(audioFormat);
            pushStream.write(wavBuffer);
            pushStream.close();

            const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

            const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

            const pronunciationAssessmentConfig =
                new sdk.PronunciationAssessmentConfig(
                    "",
                    sdk.PronunciationAssessmentGradingSystem.HundredMark,
                    sdk.PronunciationAssessmentGranularity.Phoneme,
                    false
                );
            pronunciationAssessmentConfig.enableProsodyAssessment = true;
            pronunciationAssessmentConfig.applyTo(recognizer);

            var results = [];
            var recognizedText = "";

            recognizer.recognized = function (s, e) {
                var jo = JSON.parse(e.result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult));
                if (jo.DisplayText != ".") {
                    console.log(`Recognizing: ${jo.DisplayText}`);
                    recognizedText += jo.DisplayText + " ";
                }
                results.push(jo);
            };

            recognizer.canceled = function (s, e) {
                if (e.reason === sdk.CancellationReason.Error) {
                    var str = `(cancel) Reason: ${sdk.CancellationReason[e.reason]}: ${e.errorDetails
                        }`;
                }
                recognizer.stopContinuousRecognitionAsync();
            };

            recognizer.sessionStopped = function (s, e) {
                recognizer.stopContinuousRecognitionAsync();
                recognizer.close();
                resolve(results);
            };

            recognizer.startContinuousRecognitionAsync();
        } catch (err) {
            console.error("Error during pronunciation assessment:", err);
            reject(err);
        }
    });
}

async function openaiFeedback(userTranscript) {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const apiVersion = "2023-03-15-preview";
    const deployment = "gpt-4o-mini";

    const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });
    const result = await client.chat.completions.create({
        messages: [
            { role: "system", content: await openai_prompt() },
            { role: "user", content: userTranscript },
        ],
        model: "",
    });

    return result.choices[0].message.content;
}


async function openaiCustomFeedback(userTranscript, modelPrompt) {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const apiVersion = "2023-03-15-preview";
    const deployment = "gpt-4o-mini";

    const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });
    const result = await client.chat.completions.create({
        messages: [
            { role: "system", content: modelPrompt },
            { role: "user", content: userTranscript },
        ],
        model: "",
    });

    return result.choices[0].message.content;
}

export default {
    azureTextToSpeechAndUpload,
    azureSpeechToText,
    azurePronunciationAssessment,
    openaiFeedback,
    openaiSpeechToText,
    openaiCustomFeedback,
    azurePronunciationSpeakingAssessment,
    openaiSpeechToTextAnyLanguage,
    azureSpeechToTextAnyLanguage
};
