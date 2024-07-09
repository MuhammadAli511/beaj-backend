import twilio from 'twilio';
import { createClient } from "@deepgram/sdk";
import OpenAI from "openai";
import axios from 'axios';
import openai_prompt from "../utils/prompts.js";
import cleanTextForSpeech from "../utils/cleanText.js";
import azure_blob from "../utils/azureBlobStorage.js";
import dotenv from 'dotenv';
import { performance } from 'perf_hooks';
import audioChatRepository from '../repositories/audioChatsRepository.js';
import { introLists, personaDict } from '../constants/chatbotConstants.js';
import waUser from '../repositories/waUser.js';

dotenv.config();
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const openai = new OpenAI(process.env.OPENAI_API_KEY);

const greeting_message = async (body) => {
    client.messages.create({
        from: body.To,
        body: 'Hi there! Welcome to Beaj. Would you like to practice speaking or start taking lessons?',
        to: body.From,
    });
};

const zero_message = async (body) => {
    client.messages.create({
        from: body.To,
        body: 'Great! Please select one of the below to get started.',
        to: body.From,
    });
};

const audio_feedback_message = async (body) => {
    const mediaUrl = body.MediaUrl0;
    const mediaContentType = body.MediaContentType0;
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
                client.messages.create({
                    from: body.To,
                    body: 'Sorry, there was an error processing your audio file.',
                    to: body.From,
                }).then(message => console.log(message.sid));
            } else {
                const transcription = result.results.channels[0].alternatives[0].transcript;
                const message = `Please wait for an answer. \n\nYou said: ${transcription}`;
                client.messages.create({
                    from: body.To,
                    body: message,
                    to: body.From,
                }).then(message => console.log(message.sid));

                const completion = await openai.chat.completions.create({
                    messages: [
                        { role: "system", content: await openai_prompt() },
                        { role: "user", content: transcription },
                    ],
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

                client.messages.create({
                    from: body.To,
                    mediaUrl: [audioFileUrl],
                    to: body.From,
                }).then(message => console.log(message.sid));

            }
        } catch (err) {
            console.error('Error fetching or processing audio file:', err);
            client.messages.create({
                from: body.To,
                body: 'Sorry, there was an error processing your audio file.',
                to: body.From,
            }).then(message => console.log(message.sid));
        }
    } else {
        client.messages.create({
            from: body.To,
            body: 'Sorry, I only accept audio files.',
            to: body.From,
        }).then(message => console.log(message.sid));
    }
};

const webhookService = async (body, res) => {
    try {
        const message = body.Body.toLowerCase().trim();
        const userMobileNumber = body.From.split(":")[1];

        // Check if user exists in the database
        const user = await waUser.getByPhoneNumber(userMobileNumber);

        // If user is new send a greeting message and set the user status to active
        if (!user) {
            greeting_message(body);
            waUser.create(userMobileNumber, 'active');
            return;
        }

        // If user exists and message is 0, reset the user status to active and send menu options
        if (user && message === '0') {
            zero_message(body);
            waUser.update(userMobileNumber, 'active', null);
            return;
        }

        // If user exists and message is speaking, set the user status to speaking
        if (user.state === 'active' && body.Body.toLowerCase().includes("speaking")) {
            client.messages.create({
                from: body.To,
                body: 'Great! Please send me an audio file of you speaking and I will provide feedback. Press 0 to return to main menu.',
                to: body.From,
            });
            waUser.update(userMobileNumber, 'speaking', null);
            return;
        }
        if (user.state === 'speaking' && body.NumMedia > 0) {
            audio_feedback_message(body);
            return;
        }


        // COURSE
        if (user.state === 'active' && body.Body.toLowerCase().includes("course")) {
            client.messages.create({
                from: body.To,
                body: 'Kindly select your persona. Type 1 for teacher, 2 for student, 3 for office employee, 4 for parent.',
                to: body.From,
            });
            waUser.update(userMobileNumber, 'course', null);
        }
        if (user.state === 'course' && message in ['1', '2', '3', '4']) {
            // Send qquestions here
            waUser.update(userMobileNumber, 'taking_placement_test', personaDict[message]);
        }





    } catch (error) {
        console.error('Error in chatBotService:', error);
        error.fileName = 'chatBotService.js';
        throw error;
    }
};


const feedbackService = async (prompt, userAudioFile) => {
    let startTime, endTime, userSpeechToTextTime, modelFeedbackTime, modelTextToSpeechTime, finalStartTime, finalEndTime, totalTime;

    finalStartTime = performance.now();
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    const userFileUrl = await azure_blob.uploadToBlobStorage(userAudioFile);


    startTime = performance.now();
    const audioBuffer = userAudioFile.buffer;
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
            model: "nova-2",
            smart_format: false,
        }
    );
    endTime = performance.now();
    userSpeechToTextTime = (endTime - startTime).toFixed(2) / 1000;

    if (error) {
        console.error('Error transcribing audio:', error);
        return;
    }

    const transcription = result.results.channels[0].alternatives[0].transcript;

    startTime = performance.now();
    const completion = await openai.chat.completions.create({
        messages: [
            { role: "system", content: prompt },
            { role: "user", content: transcription },
        ],
        model: "gpt-4o",
    });
    const model_response = completion.choices[0].message.content;
    const cleaned_response = await cleanTextForSpeech(model_response);
    endTime = performance.now();
    modelFeedbackTime = (endTime - startTime).toFixed(2) / 1000;

    startTime = performance.now();
    const mp3 = await openai.audio.speech.create({
        model: "tts-1-hd",
        voice: "nova",
        input: cleaned_response,
        response_format: "opus",
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    const audioFileUrl = await azure_blob.uploadToBlobStorage(buffer, "feedback.opus");
    endTime = performance.now();
    modelTextToSpeechTime = (endTime - startTime).toFixed(2) / 1000;

    finalEndTime = performance.now();
    totalTime = (finalEndTime - finalStartTime).toFixed(2) / 1000;
    audioChatRepository.create(userFileUrl, audioFileUrl, userSpeechToTextTime, modelFeedbackTime, modelTextToSpeechTime, totalTime, prompt, model_response);
    if (audioFileUrl) {
        return "Feedback successfully submitted";
    } else {
        return "Failed to submit feedback";
    }
};

const getAllFeedbackService = async () => {
    const feedback = await audioChatRepository.getAll();
    return feedback;
};

export default { webhookService, feedbackService, getAllFeedbackService };
