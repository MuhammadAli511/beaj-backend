import twilio from 'twilio';
import { createClient } from "@deepgram/sdk";
import OpenAI from "openai";
import axios from 'axios';
import openai_prompt from "../utils/prompts.js";
import cleanTextForSpeech from "../utils/cleanText.js";
import azure_blob from "../utils/azureBlobStorage.js";
import dotenv from 'dotenv';

dotenv.config();

const webhookService = async (body, res) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    const openai = new OpenAI(process.env.OPENAI_API_KEY);

    const twiml = new twilio.twiml.MessagingResponse();

    if (body.NumMedia > 0) {
        const mediaUrl = body.MediaUrl0;
        const mediaContentType = body.MediaContentType0;
        console.log('Received media:', mediaUrl, mediaContentType);
        if (mediaContentType.startsWith('audio/')) {
            try {
                const audioResponse = await axios.get(mediaUrl, {
                    responseType: 'arraybuffer',
                    auth: {
                        username: accountSid,
                        password: authToken
                    }
                });
                const audioBuffer = audioResponse.data;

                const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
                    audioBuffer,
                    {
                        model: "nova-2",
                        smart_format: false,
                    }
                );

                if (error) {
                    console.error('Error transcribing audio:', error);
                    twiml.message('Sorry, there was an error processing your audio file.');
                } else {
                    const transcription = result.results.channels[0].alternatives[0].transcript;
                    const completion = await openai.chat.completions.create({
                        messages: [{ role: "system", content: await openai_prompt(transcription) }],
                        model: "gpt-4o",
                    });
                    const model_response = completion.choices[0].message.content;
                    const cleaned_response = await cleanTextForSpeech(model_response);
                    const mp3 = await openai.audio.speech.create({
                        model: "tts-1-hd",
                        voice: "nova",
                        input: cleaned_response,
                        response_format: "opus",
                    });
                    const buffer = Buffer.from(await mp3.arrayBuffer());
                    const audioFileUrl = await azure_blob.uploadToBlobStorage(buffer, "feedback.opus");
                    const client = new twilio(accountSid, authToken);

                    console.log('Sending Message');
                    client.messages.create({
                        from: body.To,
                        mediaUrl: [audioFileUrl],
                        to: body.From,
                    }).then(message => console.log(message.sid));

                }
            } catch (err) {
                console.error('Error fetching or processing audio file:', err);
                twiml.message('Sorry, there was an error fetching your audio file.');
            }
        } else {
            twiml.message('Sorry, I only accept audio files.');
        }
    } else {
        const message = body.Body.toLowerCase().trim();
        const response = message === 'hello' ? 'Hi there! Welcome to Beaj. Start by giving a short introduction' : 'Sorry, I don\'t understand that message.';
        twiml.message(response);
    }

    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
};

export default { webhookService };
