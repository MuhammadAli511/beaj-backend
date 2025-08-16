import dotenv from 'dotenv';
dotenv.config();
import OpenAI from 'openai';
import fs from 'fs';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ElevenLabsClient } from "elevenlabs";
import speechToText from '../utils/speechToText.js';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const speechToTextService = async (audioFile, language, provider) => {
    let tempFilePath = null;

    try {
        // Create a temporary file from the buffer
        const tempFileName = `audio_${uuidv4()}_${Date.now()}.${getFileExtension(audioFile.originalname)}`;
        tempFilePath = join(tmpdir(), tempFileName);

        // Write buffer to temporary file
        await writeFile(tempFilePath, audioFile.buffer);

        if (provider === 'openai') {
            // Prepare parameters for OpenAI transcription API
            const params = {
                file: fs.createReadStream(tempFilePath),
                model: "gpt-4o-transcribe"
            };

            // Call OpenAI transcription API
            const transcription = await openai.audio.transcriptions.create(params);

            const result = {
                success: true,
                transcription: transcription.text,
                language: language
            };

            return result;
        } else if (provider === 'azure') {
            // Use Azure Speech-to-Text with auto language detection
            const transcription = await speechToText.azureSpeechToTextAnyLanguage(audioFile.buffer);

            const result = {
                success: true,
                transcription: transcription,
                language: language
            };

            return result;
        } else if (provider === 'gemini') {
            // Use Gemini Speech-to-Text
            const transcription = await speechToText.geminiSpeechToText(audioFile.buffer, language);

            const result = {
                success: true,
                transcription: transcription,
                language: language
            };

            return result;
        } else if (provider === 'elevenlabs') {
            const client = new ElevenLabsClient({
                apiKey: process.env.ELEVENLABS_API_KEY,
            });
            const audioBlob = new Blob([audioFile.buffer], { type: "audio/mp3" });
            const params = {
                file: audioBlob,
                model_id: "scribe_v1"
            };

            if (language && language !== "none") {
                params.language_code = language;
            }
            const transcription = await client.speechToText.convert(params);

            const result = {
                success: true,
                transcription: transcription.text,
                language: language
            };

            return result;
        }

    } catch (error) {
        console.error('Error in speechToTextService:', error);
        throw new Error(`Speech to text conversion failed: ${error.message}`);
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

const getFileExtension = (filename) => {
    return filename.split('.').pop() || 'mp3';
};

export default {
    speechToTextService,
};