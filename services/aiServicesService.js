import OpenAI from 'openai';
import fs from 'fs';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const speechToTextService = async (audioFile, language) => {
    let tempFilePath = null;

    try {
        // Create a temporary file from the buffer
        const tempFileName = `audio_${uuidv4()}_${Date.now()}.${getFileExtension(audioFile.originalname)}`;
        tempFilePath = join(tmpdir(), tempFileName);

        // Write buffer to temporary file
        await writeFile(tempFilePath, audioFile.buffer);

        // Call OpenAI transcription API
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: "gpt-4o-transcribe",
            language: language
        });

        const result = {
            success: true,
            transcription: transcription.text,
            language: language
        };

        return result;

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