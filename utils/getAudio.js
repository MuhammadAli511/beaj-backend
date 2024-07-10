import { createClient } from "@deepgram/sdk";
import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import { pipeline } from "stream/promises";


const getAudio = async (text) => {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    const response = await deepgram.speak.request(
        { text },
        {
            model: 'aura-asteria-en',
        }
    );
    const stream = await response.getStream();
    if (stream) {
        const file = fs.createWriteStream('model_audio.wav');
        try {
            await pipeline(stream, file);
        } catch (error) {
            console.error('Pipeline failed', error);
        }
    } else {
        console.error('Failed to create audio file');
    }
};

export default getAudio;