import dotenv from 'dotenv';
import sdk from 'microsoft-cognitiveservices-speech-sdk';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import azure_blob from './azureBlobStorage.js';
import { promisify } from 'util';

dotenv.config();

const readFileAsync = promisify(fs.readFile);

async function azureTextToSpeechAndUpload(text) {
    return new Promise((resolve, reject) => {
        try {
            const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.AZURE_CUSTOM_VOICE_KEY, process.env.AZURE_CUSTOM_VOICE_REGION);
            // Set the speech synthesis output format to MP3
            speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

            const audioFile = `tts_audio_${uuidv4()}.mp3`; // File to store synthesized speech locally
            const audioConfig = sdk.AudioConfig.fromAudioFileOutput(audioFile);
            speechConfig.speechSynthesisVoiceName = "en-US-SerenaMultilingualNeural";

            const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

            synthesizer.speakTextAsync(
                text,
                async (result) => {
                    if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {

                        // Ensure the file has been fully written before reading
                        try {
                            // Read the audio file as a binary buffer using fs.promises
                            const audioFileBuffer = await readFileAsync(audioFile);

                            // Upload the file buffer to Azure Blob Storage
                            const blobUrl = await azure_blob.uploadToBlobStorage(audioFileBuffer, audioFile);

                            // Optionally delete the local audio file after uploading
                            fs.unlinkSync(audioFile);

                            resolve(blobUrl);
                        } catch (readError) {
                            console.error("Error reading the audio file:", readError);
                            reject(readError);
                        }
                    } else {
                        console.error("Speech synthesis canceled: ", result.errorDetails);
                        reject(new Error("Synthesis failed"));
                    }
                    synthesizer.close();
                },
                (err) => {
                    console.trace("Error during speech synthesis: " + err);
                    synthesizer.close();
                    reject(err);
                }
            );
        } catch (err) {
            reject(err);
        }
    });
}

export default { azureTextToSpeechAndUpload };
