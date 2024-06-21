import { createClient } from "@deepgram/sdk";
import dotenv from 'dotenv';
dotenv.config();

const getAudioBuffer = async (response) => {
    const reader = response.getReader();
    const chunks = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
    }

    const dataArray = chunks.reduce(
        (acc, chunk) => Uint8Array.from([...acc, ...chunk]),
        new Uint8Array(0)
    );

    return Buffer.from(dataArray.buffer);
};

const getAudio = async (text) => {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    const response = await deepgram.speak.request(
        { text },
        {
            model: "aura-asteria-en",
            encoding: "linear16",
            container: "wav",
        }
    );

    const stream = await response.getStream();
    const buffer = await getAudioBuffer(stream);

    if (buffer) {
        return buffer;
    } else {
        console.error("Error generating audio:", stream);
        throw new Error("Failed to generate audio");
    }
};


export default getAudio;