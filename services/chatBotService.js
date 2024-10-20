import { createClient } from "@deepgram/sdk";
import OpenAI from "openai";
import cleanTextForSpeech from "../utils/cleanText.js";
import azure_blob from "../utils/azureBlobStorage.js";
import dotenv from 'dotenv';
import { performance } from 'perf_hooks';
import waUsersMetadataRepository from '../repositories/waUsersMetadataRepository.js';
import audioChatRepository from '../repositories/audioChatsRepository.js';
import courseRepository from '../repositories/courseRepository.js';
import lessonRepository from '../repositories/lessonRepository.js';
import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waConstantsRepository from "../repositories/waConstantsRepository.js";
import {
    outlineMessage,
    createActivityLog,
    extractConstantMessage,
    retrieveMediaURL,
    sendLessonToUser,
    nameInputMessage,
    districtInputMessage,
    scholarshipInputMessage,
    thankYouMessage,
    demoCourseStart,
    getAcceptableMessagesList,
    removeUser,
    checkUserMessageAndAcceptableMessages,
    sendMessage,
    sendWrongMessages
} from '../utils/chatbotUtils.js';


dotenv.config();
const whatsappVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

let activity_types_to_repeat = ['mcqs', 'watchAndSpeak', 'listenAndSpeak', 'postListenAndSpeak', 'preListenAndSpeak', 'postMCQs', 'preMCQs', 'read', 'conversationalQuestionsBot', 'conversationalMonologueBot'];


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
            let logger = `Inbound Message: User: ${userMobileNumber}, Message Type: ${message.type}, Message Content: ${message.text?.body || message.image?.id || message.audio?.id || message.video?.id || message.interactive?.button_reply?.title}`;
            console.log(logger);
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
            } else if (message.type === 'interactive') {
                messageContent = message.interactive.button_reply.title.toLowerCase().trim();
                createActivityLog(userMobileNumber, 'template', 'inbound', messageContent, null);
            }

            const botStatus = await waConstantsRepository.getByKey("BOT_STATUS");
            if (!botStatus || botStatus.dataValues.constantValue != 'Active') {
                await sendMessage(userMobileNumber, 'Sorry, We are currently not accepting any messages. Please try again later.');
                return;
            }

            // Check if user exists in the database
            let user = await waUsersMetadataRepository.getByPhoneNumber(userMobileNumber);
            let currentUserState = await waUserProgressRepository.getByPhoneNumber(userMobileNumber);

            // If message is reset, delete user from database
            if ((message.type === 'text' || message.type === 'interactive') && messageContent.toLowerCase() === 'reset') {
                await removeUser(userMobileNumber);
                return;
            }

            // Step 1: If user does not exist, check if the first message is the onboarding message
            const onboardingFirstMessage = await extractConstantMessage('onboarding_first_message');
            if (!user && onboardingFirstMessage.toLowerCase() === messageContent) {
                await waUsersMetadataRepository.create({ phoneNumber: userMobileNumber });
                await outlineMessage(userMobileNumber);
                return;
            } else if (!user && onboardingFirstMessage.toLowerCase() !== messageContent) {
                await sendWrongMessages(userMobileNumber);
                return;
            }

            if (user && currentUserState) {
                const messageAuth = await checkUserMessageAndAcceptableMessages(userMobileNumber, currentUserState, message, messageType, messageContent);
                if (messageAuth === false) {
                    return;
                }
            }

            // Step 2: User either clicks 'Apply for Course'
            if ((message.type === 'text' || message.type === 'interactive') && (messageContent.toLowerCase().includes('apply for course'))) {
                const validEngagementTypes = ['Outline Message', 'Apply for Course', 'Free Demo'];
                const currentLesson = await lessonRepository.getCurrentLesson(currentUserState.dataValues.currentLessonId);
                if (currentLesson) {
                    await waLessonsCompletedRepository.endLessonByPhoneNumberAndLessonId(userMobileNumber, currentLesson.dataValues.LessonId);
                }
                if (validEngagementTypes.includes(currentUserState.dataValues.engagement_type)) {
                    await nameInputMessage(userMobileNumber);
                    return;
                }
            }

            // Step 3: User enters their name, now ask for district
            if (message.type === 'text' && currentUserState.dataValues.engagement_type == 'Name Input') {
                await waUsersMetadataRepository.update(userMobileNumber, { name: messageContent });
                await districtInputMessage(userMobileNumber);
                return;
            }

            // Step 4: User enters their district, now ask for their preferred timing
            if (message.type === 'text' && currentUserState.dataValues.engagement_type == 'District Input') {
                await waUsersMetadataRepository.update(userMobileNumber, { city: messageContent });
                await scholarshipInputMessage(userMobileNumber);
                return;
            }

            // Step 5: User enters their scholarship, send them a thank you message
            if (message.type == 'text' && currentUserState.dataValues.engagement_type == 'Scholarship') {
                const messageAuth = await checkUserMessageAndAcceptableMessages(userMobileNumber, currentUserState, message, messageType, messageContent);
                if (messageAuth === false) {
                    return;
                }
                await waUsersMetadataRepository.update(userMobileNumber, { scholarshipvalue: messageContent });
                await thankYouMessage(userMobileNumber);
                return;
            };

            // From step 2 if user clicks 'Start Free Demo' button
            if ((message.type == 'interactive' || message.type == 'text') && (messageContent.toLowerCase().includes('start free demo'))) {
                if (currentUserState.dataValues.engagement_type == 'Outline Message') {
                    // Get the first lesson of the course
                    const startingLesson = await lessonRepository.getNextLesson(
                        await courseRepository.getCourseIdByName("Free Trial"),
                        1,
                        null,
                        null
                    );
                    await demoCourseStart(userMobileNumber, startingLesson);
                    // Send first lesson to user
                    let currentUserState = await waUserProgressRepository.getByPhoneNumber(userMobileNumber);
                    await sendLessonToUser(userMobileNumber, currentUserState, startingLesson, messageType, messageContent);
                    return;
                }
            }

            // If user completes an activity and wants to try the next activity
            if ((message.type === 'text' || message.type === 'interactive')) {
                if (messageContent.toLowerCase().includes('try next activity') || messageContent.toLowerCase().includes('next')) {
                    // Get next lesson to send user
                    const nextLesson = await lessonRepository.getNextLesson(
                        currentUserState.dataValues.currentCourseId,
                        currentUserState.dataValues.currentWeek,
                        currentUserState.dataValues.currentDay,
                        currentUserState.dataValues.currentLesson_sequence
                    );

                    // Course is completed
                    if (nextLesson === null) {
                        await sendMessage(userMobileNumber, '❗️❗️🎉 CONGRATULATIONS 🎉❗️❗️\n 🌟 You have successfully completed the course! 🌟 \n Please contact your group admin to receive your certificate. 📜💬');
                        return;
                    }

                    // Mark previous lesson as completed
                    const currentLesson = await lessonRepository.getCurrentLesson(currentUserState.dataValues.currentLessonId);
                    await waLessonsCompletedRepository.endLessonByPhoneNumberAndLessonId(userMobileNumber, currentLesson.dataValues.LessonId);

                    // Get acceptable messages for the next question/lesson
                    const acceptableMessagesList = await getAcceptableMessagesList(nextLesson.dataValues.activity);

                    // Update user progress to next lesson
                    await waUserProgressRepository.update(
                        userMobileNumber,
                        nextLesson.dataValues.courseId,
                        nextLesson.dataValues.weekNumber,
                        nextLesson.dataValues.dayNumber,
                        nextLesson.dataValues.LessonId,
                        nextLesson.dataValues.SequenceNumber,
                        nextLesson.dataValues.activity,
                        null,
                        0,
                        acceptableMessagesList
                    );
                    const latestUserState = await waUserProgressRepository.getByPhoneNumber(userMobileNumber);

                    // Send next lesson to user
                    await sendLessonToUser(userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
                    return;
                }
            }

            if (currentUserState.dataValues.activityType && activity_types_to_repeat.includes(currentUserState.dataValues.activityType)) {
                // Get the current lesson for next question
                const currentLesson = await lessonRepository.getCurrentLesson(currentUserState.dataValues.currentLessonId);

                // Get acceptable messages for the next question
                const acceptableMessagesList = await getAcceptableMessagesList(currentLesson.dataValues.activity);

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
