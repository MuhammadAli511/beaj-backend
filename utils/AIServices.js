import sdk from "microsoft-cognitiveservices-speech-sdk";
import { v4 as uuidv4 } from "uuid";
import { BlobServiceClient } from "@azure/storage-blob";
import { format } from "date-fns";
import { Readable, PassThrough } from "stream";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import _ from "lodash";
import { diffArrays } from "diff";
import { AzureOpenAI } from "openai";
import OpenAI from "openai";
import fs from "fs";
import { promisify } from "util";
import { tmpdir } from "os";
import { join } from "path";
import { ElevenLabsClient } from "elevenlabs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { marketing_bot_prompt } from "./prompts.js";

ffmpeg.setFfmpegPath(ffmpegPath);

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

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

async function elevenLabsTextToSpeechAndUpload(text) {
    try {
        const client = new ElevenLabsClient({
            apiKey: process.env.ELEVENLABS_API_KEY,
        });
        const audio = await client.generate({
            voice: "NH0AbpVpD8W8R6jnEwVU",
            model_id: "eleven_flash_v2_5",
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
    } catch (error) {
        console.error("Error during text-to-speech generation:", error);
        throw error;
    }
}

async function elevenLabsSpeechToText(audioBuffer) {
    try {
        const client = new ElevenLabsClient({
            apiKey: process.env.ELEVENLABS_API_KEY,
        });
        const audioBlob = new Blob([audioBuffer], { type: "audio/mp3" });
        const transcription = await client.speechToText.convert({
            file: audioBlob,
            model_id: "scribe_v1",
            language_code: "eng",
        });

        return transcription.text;
    } catch (error) {
        console.error("Error in ElevenLabs Speech-to-Text:", error);
        throw new Error("Speech-to-Text conversion failed");
    }
}

async function convertOggToWav(oggBuffer) {
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

async function azureOpenAISpeechToText(audioBuffer) {
    try {
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT_2;
        const apiKey = process.env.AZURE_OPENAI_API_KEY_2;
        const apiVersion = "2025-03-01-preview";
        const deployment = "gpt-4o-transcribe";

        const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });
        const result = await client.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: deployment,
            language: 'en',
        });

        return result.text;
    } catch {
        return await openaiSpeechToText(audioBuffer);
    }
};

async function azureOpenAISpeechToTextWithPrompt(audioBuffer, prompt) {
    try {
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT_2;
        const apiKey = process.env.AZURE_OPENAI_API_KEY_2;
        const apiVersion = "2025-03-01-preview";
        const deployment = "gpt-4o-transcribe";

        const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });
        const result = await client.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: deployment,
            language: 'en',
            prompt: prompt
        });

        return result.text;
    } catch {
        return await openaiSpeechToTextWithPrompt(audioBuffer, prompt);
    }
};

async function openaiSpeechToText(audioBuffer) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);

    const uniqueFileName = `audio-${uuidv4()}.ogg`;
    const tempFilePath = join(tmpdir(), uniqueFileName);

    try {
        await writeFile(tempFilePath, audioBuffer);

        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: "gpt-4o-transcribe",
            language: 'en'
        });
        return transcription.text;
    } finally {
        await unlink(tempFilePath);
    }
};

async function openaiSpeechToTextWithPrompt(audioBuffer, prompt) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);

    const uniqueFileName = `audio-${uuidv4()}.ogg`;
    const tempFilePath = join(tmpdir(), uniqueFileName);

    try {
        await writeFile(tempFilePath, audioBuffer);

        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: "gpt-4o-transcribe",
            language: 'en',
            prompt: prompt
        });
        return transcription.text;
    } finally {
        await unlink(tempFilePath);
    }
};

async function azureOpenAITextToSpeechAndUpload(text) {
    try {
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT_2;
        const apiKey = process.env.AZURE_OPENAI_API_KEY_2;
        const apiVersion = "2025-03-01-preview";
        const deployment = "gpt-4o-mini-tts";

        const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });

        const mp3 = await client.audio.speech.create({
            model: deployment,
            voice: "nova",
            input: text,
            instructions: "Use British pronunciation for English and speak in a slow speed, not too fast"
        });

        const buffer = Buffer.from(await mp3.arrayBuffer());
        const tempFileName = `temp-${uuidv4()}.mp3`;
        const tempFilePath = join(tmpdir(), tempFileName);
        await writeFile(tempFilePath, buffer);
        const audioUrl = await uploadAudioToAzure(buffer);
        return audioUrl;
    } catch (error) {
        return await openaiTextToSpeechAndUpload(text);
    }
};

async function openaiTextToSpeechAndUpload(text) {
    try {
        const openai = new OpenAI(process.env.OPENAI_API_KEY);

        const mp3 = await openai.audio.speech.create({
            model: "gpt-4o-mini-tts",
            voice: "nova",
            input: text,
            instructions: "Use British pronunciation for English and speak in a slow speed, not too fast"
        });

        const buffer = Buffer.from(await mp3.arrayBuffer());
        const tempFileName = `temp-${uuidv4()}.mp3`;
        const tempFilePath = join(tmpdir(), tempFileName);
        await writeFile(tempFilePath, buffer);
        const audioUrl = await uploadAudioToAzure(buffer);
        return audioUrl;
    } catch (error) {
        return await elevenLabsTextToSpeechAndUpload(text);
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
                            console.log(`CANCELED: ErrorDetails=${cancellation.errorDetails}`);
                            console.log("CANCELED: Did you set the speech resource key and region values?");
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
        const region = process.env.AZURE_CUSTOM_VOICE_REGION;
        const subscriptionKey = process.env.AZURE_CUSTOM_VOICE_KEY;
        const endpointUrl = `wss://${region}.stt.speech.microsoft.com/speech/universal/v2`;
        const wavBuffer = await convertOggToWav(audioBuffer);
        const audioFormat = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
        const pushStream = sdk.AudioInputStream.createPushStream(audioFormat);
        pushStream.write(wavBuffer);
        pushStream.close();

        const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);


        const speechConfig = sdk.SpeechConfig.fromEndpoint(new URL(endpointUrl), subscriptionKey);

        speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_LanguageIdMode, "Continuous");

        const autoDetectSourceLanguageConfig = sdk.AutoDetectSourceLanguageConfig.fromLanguages(["en-US", "ur-IN"]);

        const recognizer = sdk.SpeechRecognizer.FromConfig(speechConfig, autoDetectSourceLanguageConfig, audioConfig);

        let finalTranscription = "";

        // Event handlers
        recognizer.recognizing = (s, e) => {
            if (e.result.reason === sdk.ResultReason.RecognizingSpeech) {
                const autoDetectSourceLanguageResult = sdk.AutoDetectSourceLanguageResult.fromResult(e.result);
            }
        };

        recognizer.recognized = (s, e) => {
            if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
                finalTranscription += e.result.text;
            } else if (e.result.reason === sdk.ResultReason.NoMatch) {
                console.log("NOMATCH: Speech could not be recognized.");
            }
        };

        recognizer.sessionStopped = (s, e) => {
            recognizer.stopContinuousRecognitionAsync(() => {
                resolve(finalTranscription);
            });
        };

        // Start continuous recognition
        recognizer.startContinuousRecognitionAsync();
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
                let pronunciation_result = sdk.PronunciationAssessmentResult.fromResult(
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
                    let str = `(cancel) Reason: ${sdk.CancellationReason[e.reason]}: ${e.errorDetails
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

async function azureSpeakingAssessment(audioBuffer, topic) {
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
                    true
                );
            pronunciationAssessmentConfig.enableProsodyAssessment = true;
            pronunciationAssessmentConfig.enableContentAssessmentWithTopic(topic);
            pronunciationAssessmentConfig.applyTo(recognizer);

            let recognizedText = "";
            let results = [];

            recognizer.recognized = function (s, e) {
                let jo = JSON.parse(e.result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult));
                if (jo.DisplayText != ".") {
                    recognizedText += jo.DisplayText + " ";
                }
                results.push(jo);
            }

            function onRecognizedResult() {
                try {
                    let finalOutput = {
                        "recognizedText": recognizedText,
                        "pronunciationAssessment": {
                            AccuracyScore: 0,
                            FluencyScore: 0,
                            CompletenessScore: 0,
                            PronScore: 0,
                            ProsodyScore: 0
                        },
                        "contentAssessment": null,
                        "words": {}
                    };

                    let validResultsCount = 0;
                    // Process all results except the last one for pronunciation assessment
                    for (const result of results) {
                        if (result?.NBest?.[0]?.PronunciationAssessment) {
                            const currentAssessment = result.NBest[0].PronunciationAssessment;

                            // Accumulate scores
                            finalOutput.pronunciationAssessment.AccuracyScore += currentAssessment.AccuracyScore;
                            finalOutput.pronunciationAssessment.FluencyScore += currentAssessment.FluencyScore;
                            finalOutput.pronunciationAssessment.CompletenessScore += currentAssessment.CompletenessScore;
                            finalOutput.pronunciationAssessment.PronScore += currentAssessment.PronScore;
                            finalOutput.pronunciationAssessment.ProsodyScore += currentAssessment.ProsodyScore;

                            validResultsCount++;

                            // Process words
                            const wordsList = result.NBest[0].Words;
                            for (const word of wordsList) {
                                finalOutput.words[word.Word] = {
                                    Word: word.Word,
                                    AccuracyScore: word.PronunciationAssessment.AccuracyScore,
                                    ErrorType: word.PronunciationAssessment.ErrorType
                                };
                            }
                        }

                        // Check for content assessment in the current chunk
                        if (result?.NBest?.[0]?.ContentAssessment) {
                            finalOutput.contentAssessment = result.NBest[0].ContentAssessment;
                        }
                    }

                    // Calculate averages if we have valid results
                    if (validResultsCount > 0) {
                        finalOutput.pronunciationAssessment.AccuracyScore /= validResultsCount;
                        finalOutput.pronunciationAssessment.FluencyScore /= validResultsCount;
                        finalOutput.pronunciationAssessment.CompletenessScore /= validResultsCount;
                        finalOutput.pronunciationAssessment.PronScore /= validResultsCount;
                        finalOutput.pronunciationAssessment.ProsodyScore /= validResultsCount;

                        // Round the scores to 2 decimal places
                        for (let key in finalOutput.pronunciationAssessment) {
                            finalOutput.pronunciationAssessment[key] =
                                Math.round(finalOutput.pronunciationAssessment[key] * 100) / 100;
                        }
                    }

                    return finalOutput;
                } catch (error) {
                    console.error("Error in onRecognizedResult:", error);
                    return {
                        "recognizedText": recognizedText,
                        "error": error.message
                    };
                }
            }

            recognizer.canceled = function (s, e) {
                if (e.reason === sdk.CancellationReason.Error) {
                    let str = `(cancel) Reason: ${sdk.CancellationReason[e.reason]}: ${e.errorDetails
                        }`;
                }
                recognizer.stopContinuousRecognitionAsync();
            };

            recognizer.sessionStopped = function (s, e) {
                recognizer.stopContinuousRecognitionAsync();
                recognizer.close();
                const result = onRecognizedResult();
                resolve(result);
            };

            recognizer.startContinuousRecognitionAsync();


        } catch (err) {
            console.error("Error during pronunciation assessment:", err);
            reject(err);
        }
    });
}

async function openaiFeedback(previousMessages) {
    try {
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT_2;
        const apiKey = process.env.AZURE_OPENAI_API_KEY_2;
        const apiVersion = "2025-01-01-preview";
        const deployment = "gpt-4.1-nano";

        const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });
        const result = await client.chat.completions.create({
            messages: previousMessages,
            model: "",
        });

        return result.choices[0].message.content;
    } catch {
        return await geminiFeedback(previousMessages);
    }
}

async function geminiFeedback(previousMessages) {
    let userTranscript = previousMessages[previousMessages.length - 1].content;
    previousMessages.pop();

    let messagesArray = [];
    previousMessages.forEach(message => {
        messagesArray.push({
            role: message.role == 'assistant' ? 'model' : message.role,
            parts: [{ text: message.content }]
        });
    });

    let systemInstruction = "";

    if (messagesArray[0].role === 'system') {
        systemInstruction = messagesArray[0].content;
        messagesArray.shift();
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: systemInstruction
    });
    const chat = model.startChat({
        history: messagesArray
    });

    let result = await chat.sendMessage(userTranscript);
    return result.response.text();
}


async function geminiSpeechToText(audioBuffer, language) {
    let tempFilePath = null;
    try {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-pro"
        });

        // Create temporary file for Gemini API
        const uniqueFileName = `audio-${uuidv4()}.ogg`;
        tempFilePath = join(tmpdir(), uniqueFileName);

        await writeFile(tempFilePath, audioBuffer);

        const audioFile = {
            inlineData: {
                data: audioBuffer.toString('base64'),
                mimeType: 'audio/ogg'
            }
        };

        let prompt = "Please transcribe the following audio file:";
        if (language && language !== "none") {
            prompt = `Please transcribe the following audio file. Transcribe the text in ${language}. If something is spoken in English, then that part should be transcribed in English. (No timestamps or speaker diarization)`;
        }

        const result = await model.generateContent([
            prompt,
            audioFile
        ]);

        return result.response.text();
    } catch (error) {
        console.error('Error in Gemini Speech-to-Text:', error);
        throw new Error('Gemini Speech-to-Text conversion failed');
    } finally {
        // Clean up temporary file
        if (tempFilePath) {
            try {
                await unlink(tempFilePath);
            } catch (cleanupError) {
                console.warn('Failed to cleanup temporary file:', cleanupError);
            }
        }
    }
}

async function geminiCustomFeedback(userTranscript, modelPrompt) {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: modelPrompt
    });
    const result = await model.generateContent(userTranscript);
    return result.response.text();
}

async function openaiCustomFeedback(userTranscript, modelPrompt) {
    try {
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT_2;
        const apiKey = process.env.AZURE_OPENAI_API_KEY_2;
        const apiVersion = "2025-01-01-preview";
        const deployment = "gpt-4.1-nano";

        const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });
        const result = await client.chat.completions.create({
            messages: [
                { role: "system", content: modelPrompt },
                { role: "user", content: userTranscript },
            ],
            model: "",
        });

        return result.choices[0].message.content;
    } catch {
        return await geminiCustomFeedback(userTranscript, modelPrompt);
    }
}

async function marketingBotResponse(previousMessages) {
    const marketingBotPrompt = await marketing_bot_prompt();
    previousMessages.unshift({
        role: "system",
        content: marketingBotPrompt
    });
    try {
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
        const apiKey = process.env.AZURE_OPENAI_API_KEY;
        const apiVersion = "2025-01-01-preview";
        const deployment = "gpt-4.1-mini";

        const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });
        const result = await client.chat.completions.create({
            messages: previousMessages,
            model: "",
        });

        return result.choices[0].message.content;
    } catch {
        return "Sorry, I am not able to respond to your question.";
    }
}

export default {
    azureSpeechToText,
    azurePronunciationAssessment,
    openaiFeedback,
    openaiSpeechToText,
    openaiCustomFeedback,
    azureSpeakingAssessment,
    azureSpeechToTextAnyLanguage,
    openaiSpeechToTextWithPrompt,
    elevenLabsSpeechToText,
    geminiSpeechToText,
    geminiFeedback,
    geminiCustomFeedback,
    openaiTextToSpeechAndUpload,
    marketingBotResponse,
    azureOpenAISpeechToText,
    azureOpenAISpeechToTextWithPrompt,
    azureOpenAITextToSpeechAndUpload
};

