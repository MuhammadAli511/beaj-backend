import { createClient } from "@deepgram/sdk";
import dotenv from 'dotenv';
import OpenAI from "openai";
import openai_prompt from "../utils/prompts.js";
import cleanTextForSpeech from "../utils/cleanText.js";
import getAudio from "../utils/getAudio.js";
dotenv.config();


const analyzeAudioChatService = async (audioText) => {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    const openai = new OpenAI(process.env.OPENAI_API_KEY);

    // const audioBuffer = await audioText.buffer;

    // const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    //     audioBuffer,
    //     {
    //         model: "nova-2",
    //         smart_format: false,
    //     }
    // );

    // if (error) throw error;
    // const transcript = result.results.channels[0].alternatives[0].transcript;

    const completion = await openai.chat.completions.create({
        messages: [{ role: "system", content: await openai_prompt("Hi My name ali. I am software engineer. I working at Beaj Education on create backend and chatbot. Day going fantastic") }],
        model: "gpt-4o",
    });

    const model_response = completion.choices[0].message.content;
    const cleaned_response = await cleanTextForSpeech(model_response)
    console.log(cleaned_response.length);
    await getAudio(cleaned_response);
    return model_response;
};



export default {
    analyzeAudioChatService
};