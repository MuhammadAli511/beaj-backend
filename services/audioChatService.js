import { createClient } from "@deepgram/sdk";
import dotenv from 'dotenv';
import OpenAI from "openai";
import openai_prompt from "../utils/prompts.js";
import cleanTextForSpeech from "../utils/cleanText.js";
import getAudio from "../utils/getAudio.js";
import path from "path";
import fs from "fs";
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
    console.log(audioBuffer)
    return result.results.channels[0].alternatives[0].transcript;


    // if (error) throw error;
    // const transcript = result.results.channels[0].alternatives[0].transcript;

    // const completion = await openai.chat.completions.create({
    //     messages: [{ role: "system", content: await openai_prompt("Hi My name ali. I am software engineer. I working at Beaj Education on create backend and chatbot. Day going fantastic") }],
    //     model: "gpt-4o",
    // });

    // const model_response = completion.choices[0].message.content;
    // const model_response = "Great job, Ali! Your introduction is clear, and it's wonderful that you're sharing information about your work. Here are some improvements. Instead of \"Hi My name ali,\" you should say, \"Hi, my name is Ali.\" For \"I am software engineer,\" add \"a\" to make it \"I am a software engineer.\" Replace \"I working\" with \"I am working.\" Use \"on creating\" instead of \"on create.\" To improve fluency, try practicing full sentences and pausing at the right places. You're doing great keep practicing and you'll get even better!";
    // const cleaned_response = await cleanTextForSpeech(model_response)
    // console.log(cleaned_response.length);
    // const mp3 = await openai.audio.speech.create({
    //     model: "tts-1-hd",
    //     voice: "nova",
    //     input: cleaned_response,
    // });
    // const buffer = Buffer.from(await mp3.arrayBuffer());
    // const speechFile = path.resolve("./speech.mp3");
    // await fs.promises.writeFile(speechFile, buffer);
    // await getAudio(cleaned_response);
    // return model_response;
};



export default {
    analyzeAudioChatService
};