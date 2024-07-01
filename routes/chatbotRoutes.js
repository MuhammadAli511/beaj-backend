import express from 'express';
import twilio from 'twilio';
import { createClient } from "@deepgram/sdk";
import dotenv from 'dotenv';
import OpenAI from "openai";
import axios from 'axios';
import openai_prompt from "../utils/prompts.js";
import cleanTextForSpeech from "../utils/cleanText.js";
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { BlobServiceClient } from "@azure/storage-blob";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;



async function uploadToBlobStorage(fileBuffer, originalName) {
    try {
        const newFileName = originalName;
        const containerName = "beajdocuments";
        const azureBlobConnectionString = process.env.AZURE_BLOB_CONNECTION_STRING;
        const blobServiceClient = BlobServiceClient.fromConnectionString(azureBlobConnectionString);
        const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
        const uniqueID = uuidv4();
        const filename = `${timestamp}-${uniqueID}-${newFileName}`;

        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blobClient = containerClient.getBlobClient(filename);
        const blockBlobClient = blobClient.getBlockBlobClient();

        await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
            blobHTTPHeaders: { blobContentType: "audio/ogg" },
        });

        return `https://${blobServiceClient.accountName}.blob.core.windows.net/${containerName}/${filename}`;
    } catch (ex) {
        console.error(`uploadToBlobStorage: ${ex.message}`);
        throw new Error('Failed to upload to Blob Storage');
    }
}


dotenv.config();

const router = express.Router();

router.get('/status', (req, res) => {
    res.status(200).send("Chatbot Route Status : Working");
});


router.post('/webhook', async (req, res) => {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    const { body } = req;
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
                    const audioFileUrl = await uploadToBlobStorage(buffer, "feedback.opus");
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
});


export default router;