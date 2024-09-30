import { createClient } from "@deepgram/sdk";
import OpenAI from "openai";
import axios from 'axios';
import openai_prompt from "../utils/prompts.js";
import cleanTextForSpeech from "../utils/cleanText.js";
import azure_blob from "../utils/azureBlobStorage.js";
import dotenv from 'dotenv';
import { performance } from 'perf_hooks';
import waUsersMetadataRepository from '../repositories/waUsersMetadataRepository.js';
import audioChatRepository from '../repositories/audioChatsRepository.js';
import waConstantsRepository from '../repositories/waConstantsRepository.js';
import lessonRepository from '../repositories/lessonRepository.js';
import documentFileRepository from '../repositories/documentFileRepository.js';
import multipleChoiceQuestionRepository from '../repositories/multipleChoiceQuestionRepository.js';
import multipleChoiceQuestionAnswerRepository from '../repositories/multipleChoiceQuestionAnswerRepository.js';
import questionResponseRepository from '../repositories/questionResponseRepository.js';
import speakActivityQuestionRepository from '../repositories/speakActivityQuestionRepository.js';
import courseRepository from "../repositories/courseRepository.js";
import { mcqsResponse } from '../constants/chatbotConstants.js';
import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import { onboardingMessage, createActivityLog, extractConstantMessage, sendLessonToUser, getAcceptableMessagesList } from '../utils/chatbotUtils.js';


dotenv.config();
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const openai = new OpenAI(process.env.OPENAI_API_KEY);
const whatsappVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN;


const verifyWebhookService = async (req, res) => {
    try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode && token === whatsappVerifyToken) {
            console.log('Webhook verified');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } catch (error) {
        console.error('Error in verifyWebhookService:', error);
        error.fileName = 'chatBotService.js';
        throw error;
    }
};


const webhookService = async (body, res) => {
    try {
        res.sendStatus(200);
        if (
            body.entry &&
            body.entry[0].changes &&
            body.entry[0].changes[0].value.messages &&
            body.entry[0].changes[0].value.statuses == undefined
        ) {
            const message = body.entry[0].changes[0].value.messages[0];
            const userMobileNumber = "+" + message.from;
            let messageContent;
            let messageType = message.type;
            console.log('User:', userMobileNumber);
            console.log('Message Type:', message.type);
            if (message.type === 'image') {
                createActivityLog(userMobileNumber, 'image', 'inbound', message, null);
                messageContent = await retrieveMediaURL(message.image.id);
            } else if (message.type === 'audio') {
                createActivityLog(userMobileNumber, 'audio', 'inbound', message, null);
                messageContent = await retrieveMediaURL(message.audio.id);
            } else if (message.type === 'video') {
                createActivityLog(userMobileNumber, 'video', 'inbound', message, null);
                messageContent = await retrieveMediaURL(message.video.id);
            } else if (message.type === 'text') {
                messageContent = message.text?.body.toLowerCase().trim() || "";
                createActivityLog(userMobileNumber, 'text', 'inbound', message.text?.body, null);
            } else if (message.type === 'button') {
                messageContent = message.button.text;
                createActivityLog(userMobileNumber, 'button', 'inbound', messageContent, null);
            }

            // Check if user exists in the database
            let user = await waUsersMetadataRepository.getByPhoneNumber(userMobileNumber);

            const onboardingFirstMessage = await extractConstantMessage('onboarding_first_message');
            if (!user && onboardingFirstMessage.toLowerCase() === messageContent) {
                const startingLesson = await lessonRepository.getNextLesson(
                    await courseRepository.getCourseIdByName("Trial Course - Teachers"),
                    1,
                    null,
                    null
                );
                await onboardingMessage(userMobileNumber, startingLesson);
                let currentUserState = await waUserProgressRepository.getByPhoneNumber(userMobileNumber);
                await sendLessonToUser(userMobileNumber, currentUserState, startingLesson, messageType, messageContent);
                return;
            }


            // TODO: If user exists add a acceptable messages checking mechanism here



            let currentUserState = await waUserProgressRepository.getByPhoneNumber(userMobileNumber);
            if (userMessage.toLowerCase().includes('start next lesson')) {
                // Get next lesson to send user
                const nextLesson = await lessonRepository.getNextLesson(currentUserState.dataValues.currentCourseId, currentUserState.dataValues.currentWeek, currentUserState.dataValues.currentDay, currentUserState.dataValues.currentLesson_sequence);

                // Course is completed
                if (nextLesson === null) {
                    await sendMessage(userMobileNumber, '❗️❗️🎉 CONGRATULATIONS 🎉❗️❗️\n 🌟 You have successfully completed the course! 🌟 \n Please contact your group admin to receive your certificate. 📜💬');
                    return;
                }

                // Mark previous lesson as completed
                const currentLesson = await lessonRepository.getCurrentLesson(currentUserState.dataValues.currentLessonId);
                await waLessonsCompletedRepository.endLessonByPhoneNumberAndLessonId(userMobileNumber, currentLesson.dataValues.LessonId);

                // Get acceptable messages for the next question/lesson
                const acceptableMessagesList = getAcceptableMessagesList(nextLesson.dataValues.activity);

                // Update user progress to next lesson
                await waUserProgressRepository.update(userMobileNumber, nextLesson.dataValues.courseId, nextLesson.dataValues.weekNumber, nextLesson.dataValues.dayNumber, nextLesson.dataValues.LessonId, nextLesson.dataValues.SequenceNumber, nextLesson.dataValues.activity, null, 0, acceptableMessagesList);

                // Send next lesson to user
                await sendLessonToUser(userMobileNumber, currentUserState, nextLesson, messageType, messageContent);
                return;
            }



            if (currentUserState.dataValues.activityType && activity_types_to_repeat.includes(currentUserState.dataValues.activityType)) {
                // Get the current lesson for next question
                const currentLesson = await lessonRepository.getCurrentLesson(currentUserState.dataValues.currentLessonId);

                // Get acceptable messages for the next question
                const acceptableMessagesList = getAcceptableMessagesList(currentLesson.dataValues.activity);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, acceptableMessagesList);

                // Update user progress to next question
                await sendLessonToUser(userMobileNumber, currentUserState, currentLesson, messageType, messageContent);
                return;
            }
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

export default { webhookService, feedbackService, getAllFeedbackService, verifyWebhookService };
