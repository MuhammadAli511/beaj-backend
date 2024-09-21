// azureTextToSpeechAndUpload.js

import dotenv from 'dotenv';
import sdk from 'microsoft-cognitiveservices-speech-sdk';
import { v4 as uuidv4 } from 'uuid';
import { BlobServiceClient } from '@azure/storage-blob';
import { format } from 'date-fns';

dotenv.config();

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
}

export default { azureTextToSpeechAndUpload };
