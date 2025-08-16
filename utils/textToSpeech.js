import { v4 as uuidv4 } from "uuid";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { AzureOpenAI } from "openai";
import OpenAI from "openai";
import fs from "fs";
import { promisify } from "util";
import { tmpdir } from "os";
import { join } from "path";
import { ElevenLabsClient } from "elevenlabs";
import { uploadAudioToAzure } from "./utils.js";
import dotenv from 'dotenv';
dotenv.config();

ffmpeg.setFfmpegPath(ffmpegPath);

const writeFile = promisify(fs.writeFile);



const elevenLabsTextToSpeech = async (text) => {
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
};

const azureOpenAITextToSpeech = async (text) => {
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
        return await openaiTextToSpeech(text);
    }
};

const openaiTextToSpeech = async (text) => {
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
        return await elevenLabsTextToSpeech(text);
    }
};


export default {
    elevenLabsTextToSpeech,
    azureOpenAITextToSpeech,
    openaiTextToSpeech
};