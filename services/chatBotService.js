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
import lessonRepository from '../repositories/lessonRepository.js';
import documentFileRepository from '../repositories/documentFileRepository.js';
import multipleChoiceQuestionRepository from '../repositories/multipleChoiceQuestionRepository.js';
import multipleChoiceQuestionAnswerRepository from '../repositories/multipleChoiceQuestionAnswerRepository.js';


dotenv.config();
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const openai = new OpenAI(process.env.OPENAI_API_KEY);

const greeting_message = async (body) => {
    client.messages.create({
        from: body.To,
        body: "Hi there! Welcome to Beaj. Let's begin your course. Below is your first lesson.",
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
                }).then(message => console.log("Error message sent + " + message.sid));
            } else {
                const transcription = result.results.channels[0].alternatives[0].transcript;
                const message = `Please wait for an answer. \n\nYou said: ${transcription}`;
                client.messages.create({
                    from: body.To,
                    body: message,
                    to: body.From,
                }).then(message => console.log("Transcription message sent + " + message.sid));

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
                }).then(message => console.log("Audio message sent + " + message.sid));

            }
        } catch (err) {
            console.error('Error fetching or processing audio file:', err);
            client.messages.create({
                from: body.To,
                body: 'Sorry, there was an error processing your audio file.',
                to: body.From,
            }).then(message => console.log("Error message sent + " + message.sid));
        }
    } else {
        client.messages.create({
            from: body.To,
            body: 'Sorry, I only accept audio files.',
            to: body.From,
        }).then(message => console.log("Error message sent + " + message.sid));
    }
};

const update_user = async (userMobileNumber, user, startingLesson) => {
    await waUser.update(
        userMobileNumber,
        user.dataValues.persona,
        user.dataValues.engagement_type,
        user.dataValues.level,
        startingLesson.dataValues.weekNumber,
        startingLesson.dataValues.dayNumber,
        startingLesson.dataValues.SequenceNumber,
        startingLesson.dataValues.activity,
        startingLesson.dataValues.LessonId,
        null
    );
};

const send_mcq = async (userMobileNumber, user, mcq, body) => {
    console.log(mcq.dataValues.Id)
    const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(mcq.dataValues.Id);
    console.log(mcqAnswers)
    let mcqMessage = mcq.QuestionText;
    for (let j = 0; j < mcqAnswers.length; j++) {
        mcqMessage += "\n" + String.fromCharCode(65 + j) + ". " + mcqAnswers[j].dataValues.AnswerText;
    }
    await client.messages.create({
        from: body.To,
        body: mcqMessage,
        to: body.From,
    }).then(message => console.log("MCQ message sent + " + message.sid));
};



const get_lessons = async (userMobileNumber, user, startingLesson, body) => {
    const activity = startingLesson.dataValues.activity;
    let lessonMessage = "Week " + startingLesson.dataValues.weekNumber + ", Day " + startingLesson.dataValues.dayNumber + "\nActivity Name: " + startingLesson.dataValues.activityAlias;
    if (startingLesson.dataValues.text) {
        lessonMessage += "\n\n" + startingLesson.dataValues.text;
    }
    await client.messages.create({
        from: body.To,
        body: lessonMessage,
        to: body.From,
    }).then(message => console.log("Lesson message sent + " + message.sid));
    if (activity === 'video') {
        const videoURL = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
        // await client.messages.create({
        //     from: body.To,
        //     mediaUrl: [videoURL[0].dataValues.video],
        //     to: body.From,
        // }).then(message => console.log("Video message sent + " + message.sid));
        // Update user
        const nextLesson = await lessonRepository.getNextLesson(user.dataValues.level, user.dataValues.week, user.dataValues.day, user.dataValues.lesson_sequence);
        await update_user(userMobileNumber, user, nextLesson);
        await get_lessons(userMobileNumber, user, nextLesson, body);
    } else if (activity === 'mcqs') {
        if (user.dataValues.question_number === null) {
            const startingMCQ = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(startingLesson.dataValues.LessonId, null);
            await waUser.update_question(userMobileNumber, startingMCQ.dataValues.QuestionNumber);
            await send_mcq(userMobileNumber, user, startingMCQ, body);
        } else {
            // Check for the answer of the user and update in DB





            // Send Next MCQ
            const nextMCQ = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(startingLesson.dataValues.LessonId, user.dataValues.question_number);
            if (nextMCQ === null) {
                // Give Score here
            } else {
                await waUser.update_question(userMobileNumber, nextMCQ.dataValues.QuestionNumber);
                await send_mcq(userMobileNumber, user, nextMCQ, body);
            }
        }






        const mcq = mcqs[i].dataValues;
        const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(mcq.id);
        let mcqMessage = mcq.QuestionText;
        for (let j = 0; j < mcqAnswers.length; j++) {
            mcqMessage += "\n" + mcqAnswers[j].dataValues.AnswerText;
        }
        await client.messages.create({
            from: body.To,
            body: mcqMessage,
            to: body.From,
        }).then(message => console.log("MCQ message sent + " + message.sid));

    }
};


const webhookService = async (body, res) => {
    try {
        const message = body.Body.toLowerCase().trim();
        const userMobileNumber = body.From.split(":")[1];
        // If the user sends an audio file, process it
        if (body.NumMedia > 0) {
            await audio_feedback_message(body);
            return;
        }

        // Check if user exists in the database
        let user = await waUser.getByPhoneNumber(userMobileNumber);

        if (!user) {
            greeting_message(body);
            waUser.create(userMobileNumber, 'Teacher', 'Learning');
            const startingLesson = await lessonRepository.getNextLesson(94, 4, null, null);
            await waUser.update(
                userMobileNumber,
                'Teacher',
                'Learning',
                '94',
                startingLesson.dataValues.weekNumber,
                startingLesson.dataValues.dayNumber,
                startingLesson.dataValues.SequenceNumber,
                startingLesson.dataValues.activity,
                startingLesson.dataValues.LessonId,
                null
            );
            user = await waUser.getByPhoneNumber(userMobileNumber);
            await get_lessons(userMobileNumber, user, startingLesson, body);
            return;
        }

        const startingLesson = await lessonRepository.getNextLesson(user.dataValues.level, user.dataValues.week, user.dataValues.day, user.dataValues.lesson_sequence);
        await update_user(userMobileNumber, user, startingLesson);






        if (startingLesson === null) {
            client.messages.create({
                from: body.To,
                body: 'Congratulations! You have completed all the lessons for this course.',
                to: body.From,
            }).then(message => console.log("Completion message sent + " + message.sid));
            return;
        };
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
