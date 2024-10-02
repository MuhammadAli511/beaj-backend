import dotenv from 'dotenv';
import sdk from 'microsoft-cognitiveservices-speech-sdk';
import { v4 as uuidv4 } from 'uuid';
import { BlobServiceClient } from '@azure/storage-blob';
import { format } from 'date-fns';
import { Readable, PassThrough } from 'stream';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

dotenv.config();
ffmpeg.setFfmpegPath(ffmpegPath);

async function azureTextToSpeechAndUpload(text) {
    return new Promise((resolve, reject) => {
        try {
            const speechConfig = sdk.SpeechConfig.fromSubscription(
                process.env.AZURE_CUSTOM_VOICE_KEY,
                process.env.AZURE_CUSTOM_VOICE_REGION
            );

            speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

            speechConfig.speechSynthesisVoiceName = "en-US-SerenaMultilingualNeural";

            const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

            synthesizer.speakTextAsync(
                text,
                async (result) => {
                    if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                        try {
                            // Convert the audio data to a Buffer
                            const audioData = Buffer.from(result.audioData);

                            // Generate a unique file name with timestamp and UUID
                            const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                            const uniqueID = uuidv4();
                            const baseFileName = `tts_audio_${uniqueID}.mp3`;
                            const filename = `${timestamp}-${uniqueID}-${baseFileName}`;

                            const containerName = "beajdocuments";
                            const azureBlobConnectionString = process.env.AZURE_BLOB_CONNECTION_STRING;

                            if (!azureBlobConnectionString) {
                                throw new Error("Azure Blob Storage connection string is not defined in environment variables.");
                            }

                            const blobServiceClient = BlobServiceClient.fromConnectionString(azureBlobConnectionString);

                            const containerClient = blobServiceClient.getContainerClient(containerName);

                            await containerClient.createIfNotExists({
                                access: 'container',
                            });

                            const blobClient = containerClient.getBlockBlobClient(filename);
                            const blockBlobClient = blobClient.getBlockBlobClient();

                            await blockBlobClient.uploadData(audioData, {
                                blobHTTPHeaders: { blobContentType: "audio/mpeg" },
                            });

                            const blobUrl = blockBlobClient.url;

                            console.log(`Audio successfully uploaded to Blob Storage: ${blobUrl}`);
                            resolve(blobUrl);
                        } catch (uploadError) {
                            console.error("Error uploading the audio data:", uploadError);
                            reject(uploadError);
                        }
                    } else {
                        console.error("Speech synthesis canceled:", result.errorDetails);
                        reject(new Error("Synthesis failed"));
                    }
                    synthesizer.close();
                },
                (err) => {
                    console.error("Error during speech synthesis:", err);
                    synthesizer.close();
                    reject(err);
                }
            );
        } catch (err) {
            console.error("Unexpected error:", err);
            reject(err);
        }
    });
};

function convertOggToWav(oggBuffer) {
    return new Promise((resolve, reject) => {
        const oggStream = new PassThrough();
        oggStream.end(oggBuffer);

        const wavData = [];
        const wavStream = new PassThrough();
        wavStream.on('data', chunk => wavData.push(chunk));
        wavStream.on('end', () => resolve(Buffer.concat(wavData)));
        wavStream.on('error', err => reject(err));

        ffmpeg(oggStream)
            .format('wav')
            .audioCodec('pcm_s16le')
            .audioChannels(1)
            .audioFrequency(16000)
            .on('error', err => reject(err))
            .pipe(wavStream);
    });
}

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

            const speechRecognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

            speechRecognizer.recognizeOnceAsync(result => {
                switch (result.reason) {
                    case sdk.ResultReason.RecognizedSpeech:
                        console.log(`RECOGNIZED: Text=${result.text}`);
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
                        reject(new Error(`Speech recognition canceled: ${cancellation.reason}`));
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


export default { azureTextToSpeechAndUpload, azureSpeechToText };
