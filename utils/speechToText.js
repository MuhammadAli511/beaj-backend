import sdk from "microsoft-cognitiveservices-speech-sdk";
import { v4 as uuidv4 } from "uuid";
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
import { convertOggToWav } from "./utils.js";
import dotenv from 'dotenv';
dotenv.config();

ffmpeg.setFfmpegPath(ffmpegPath);

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);


const elevenLabsSpeechToText = async (audioBuffer) => {
    try {
        const client = new ElevenLabsClient({
            apiKey: process.env.ELEVENLABS_API_KEY,
        });
        const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
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
};

const azureOpenAISpeechToText = async (audioBuffer, prompt = null, language = "en") => {
    try {
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT_2;
        const apiKey = process.env.AZURE_OPENAI_API_KEY_2;
        const apiVersion = "2025-03-01-preview";
        const deployment = "gpt-4o-transcribe";

        const postObject = {
            file: fs.createReadStream(tempFilePath),
            model: deployment,
            language: language,
        };
        if (prompt) {
            postObject.prompt = prompt;
        }

        const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });
        const result = await client.audio.transcriptions.create(postObject);

        return result.text;
    } catch {
        return await openaiSpeechToText(audioBuffer, prompt, language);
    }
};

const openaiSpeechToText = async (audioBuffer, prompt = null, language = "en") => {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);

    const uniqueFileName = `audio-${uuidv4()}.ogg`;
    const tempFilePath = join(tmpdir(), uniqueFileName);

    try {
        await writeFile(tempFilePath, audioBuffer);

        const postObject = {
            file: fs.createReadStream(tempFilePath),
            model: "gpt-4o-transcribe",
            language: language,
        };
        if (prompt) {
            postObject.prompt = prompt;
        }

        const transcription = await openai.audio.transcriptions.create(postObject);
        return transcription.text;
    } finally {
        await unlink(tempFilePath);
    }
};

const azureSpeechToText = async (audioBuffer) => {
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
                        resolve(null);
                        break;
                    case sdk.ResultReason.Canceled:
                        const cancellation = sdk.CancellationDetails.fromResult(result);

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
};

const azureSpeechToTextAnyLanguage = async (audioBuffer) => {
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
};

const azurePronunciationAssessment = async (audioBuffer, referenceText) => {
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
};

const azureSpeakingAssessment = async (audioBuffer, topic) => {
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
};

const geminiSpeechToText = async (audioBuffer, language) => {
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
};


export default {
    elevenLabsSpeechToText,
    azureOpenAISpeechToText,
    openaiSpeechToText,
    azureSpeechToText,
    azureSpeechToTextAnyLanguage,
    azurePronunciationAssessment,
    azureSpeakingAssessment,
    geminiSpeechToText
};