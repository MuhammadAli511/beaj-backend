import { createClient } from "@deepgram/sdk";
import dotenv from 'dotenv';
import OpenAI from "openai";
import openai_prompt from "../utils/prompts.js";
import cleanTextForSpeech from "../utils/cleanText.js";
import getAudio from "../utils/getAudio.js";
import fs from 'fs';
dotenv.config();


const analyzeAudioChatService = async (audioText) => {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    const openai = new OpenAI(process.env.OPENAI_API_KEY);

    const audioBuffer = await audioText.buffer;

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
            model: "nova-2",
            smart_format: false,
        }
    );

    if (error) throw error;
    const transcript = result.results.channels[0].alternatives[0].transcript;

    const completion = await openai.chat.completions.create({
        messages: [{ role: "system", content: await openai_prompt(transcript) }],
        model: "gpt-4o",
    });

    const model_response = completion.choices[0].message.content;
    const cleaned_response = await cleanTextForSpeech(model_response)
    console.log(cleaned_response.length);
    const model_audio_buffer = await getAudio(cleaned_response);
    fs.writeFileSync('model_audio.wav', model_audio_buffer);
    return model_response;
};



export default {
    analyzeAudioChatService
};