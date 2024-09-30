import axios from "axios";
import dotenv from "dotenv";
import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waUserActivityLogsRepository from "../repositories/waUserActivityLogsRepository.js";
import waConstantsRepository from "../repositories/waConstantsRepository.js";
import documentFileRepository from "../repositories/documentFileRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import speakActivityQuestionRepository from '../repositories/speakActivityQuestionRepository.js';
import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import azureBlobStorage from "./azureBlobStorage.js";

dotenv.config();

const whatsappToken = process.env.WHATSAPP_TOKEN;
const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const getAcceptableMessagesList = async (activityType) => {
    if (activityType === "listenAndSpeak" || activityType === "postListenAndSpeak" || activityType === "preListenAndSpeak" || activityType === "watchAndSpeak" || activityType === "conversationalQuestionsBot" || activityType === "conversationalMonologueBot" || activityType === "read") {
        return ["audio"];
    } else if (activityType === "mcqs" || activityType === "preMCQs" || activityType === "postMCQs") {
        return ["option a", "option b", "option c", "option d"];
    }
};

const sendMessage = async (to, body) => {
    try {
        await axios.post(
            `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
            {
                messaging_product: "whatsapp",
                to: to,
                text: { body: body },
            },
            {
                headers: {
                    Authorization: `Bearer ${whatsappToken}`,
                    "Content-Type": "application/json",
                },
            }
        );
    } catch (error) {
        console.error(
            "Error sending message:",
            error.response ? error.response.data : error.message
        );
    }
};

const retrieveMediaURL = async (mediaId) => {
    const mediaResponse = await axios.get(
        `https://graph.facebook.com/v20.0/${mediaId}`,
        {
            headers: {
                Authorization: `Bearer ${whatsappToken}`,
            },
        }
    );

    const audioUrl = mediaResponse.data.url;

    const audioResponse = await axios.get(audioUrl, {
        responseType: "arraybuffer",
        headers: {
            Authorization: `Bearer ${whatsappToken}`,
        },
    });
    return audioResponse;
};

const createActivityLog = async (
    phoneNumber,
    actionType,
    messageDirection,
    messageContent,
    metadata
) => {
    const userCurrentProgress = await waUserProgressRepository.getByPhoneNumber(
        phoneNumber
    );
    let courseId = null,
        lessonId = null,
        weekNumber = null,
        dayNumber = null,
        questionId = null,
        activityType = null,
        retryCount = null;

    if (userCurrentProgress) {
        courseId = userCurrentProgress.currentCourseId || null;
        lessonId = userCurrentProgress.currentLessonId || null;
        weekNumber = userCurrentProgress.currentWeek || null;
        dayNumber = userCurrentProgress.currentDay || null;
        questionId = userCurrentProgress.questionId || null;
        activityType = userCurrentProgress.activityType || null;
        retryCount = userCurrentProgress.retryCounter || null;
    }

    let finalMessageContent = messageContent;

    // Inbound
    if (actionType === "image" && messageDirection == 'inbound') {
        const mediaId = messageContent.image.id;
        const mediaResponse = await retrieveMediaURL(mediaId);
        const azureUrl = await azureBlobStorage.uploadToBlobStorage(
            mediaResponse.data,
            mediaId
        );
        finalMessageContent = azureUrl;
    } else if (actionType === "audio" && messageDirection == 'inbound') {
        const mediaId = messageContent.audio.id;
        const mediaResponse = await retrieveMediaURL(mediaId);
        const azureUrl = await azureBlobStorage.uploadToBlobStorage(
            mediaResponse.data,
            mediaId
        );
        finalMessageContent = azureUrl;
    } else if (actionType === "video" && messageDirection == 'inbound') {
        const mediaId = messageContent.video.id;
        const mediaResponse = await retrieveMediaURL(mediaId);
        const azureUrl = await azureBlobStorage.uploadToBlobStorage(
            mediaResponse.data,
            mediaId
        );
        finalMessageContent = azureUrl;
    } else if (actionType === "text" && messageDirection == 'inbound') {
        finalMessageContent = messageContent;
    } else if (actionType === "button" && messageDirection == 'inbound') {
        finalMessageContent = messageContent;
    }


    // Outbound
    if (messageDirection == 'outbound') {
        finalMessageContent = messageContent;
    }


    await waUserActivityLogsRepository.create({
        phoneNumber: phoneNumber,
        actionType: actionType,
        messageDirection: messageDirection,
        messageContent: [finalMessageContent],
        metadata: metadata,
        courseId: courseId,
        lessonId: lessonId,
        weekNumber: weekNumber,
        dayNumber: dayNumber,
        questionId: questionId,
        activityType: activityType,
        retryCount: retryCount,
    });
};

const extractConstantMessage = async (key) => {
    const constantMessageObj = await waConstantsRepository.getByKey(key);
    const constantMessage = constantMessageObj?.dataValues?.constantValue;
    const formattedMessage = constantMessage.replace(/\\n/g, "\n");
    return formattedMessage;
};

const sendMediaMessage = async (to, mediaUrl, mediaType) => {
    console.log("To:", to);
    console.log("Media URL:", mediaUrl);
    console.log("Media Type:", mediaType);
    try {
        if (mediaType == 'video') {
            await axios.post(
                `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'video',
                    video: { link: mediaUrl },
                },
                {
                    headers: {
                        Authorization: `Bearer ${whatsappToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        } else if (mediaType == 'audio') {
            await axios.post(
                `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'audio',
                    audio: { link: mediaUrl },
                },
                {
                    headers: {
                        Authorization: `Bearer ${whatsappToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        } else if (mediaType == 'image') {
            await axios.post(
                `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'image',
                    image: { link: mediaUrl },
                },
                {
                    headers: {
                        Authorization: `Bearer ${whatsappToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        } else {
            console.error('Invalid media type:', mediaType);
        }
    } catch (error) {
        console.error('Error sending media message:', error.response ? error.response.data : error.message);
    }
};

const sendNextLessonTemplateMessage = async (to) => {
    try {
        console.log("Phone Number:", to);
        const response = await axios.post(
            `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'template',
                template: {
                    name: 'next_lesson_emoji',
                    language: {
                        code: 'en',
                    },
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${whatsappToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );
    } catch (error) {
        console.error('Error sending Next Lesson template message:', error.response ? error.response.data : error.message);
    }
};

const sendLessonToUser = async (
    userMobileNumber,
    currentUserState,
    startingLesson,
    messageType,
    messageContent
) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (activity === 'video') {
            // Lesson Started Record
            waLessonsCompletedRepository.create({
                phoneNumber: userMobileNumber,
                lessonId: startingLesson.dataValues.LessonId,
                courseId: currentUserState.currentCourseId,
                completionStatus: 'Started',
                startTime: new Date(),
            });

            // First lesson of the day custom message
            const firstLesson = lessonRepository.isFirstLessonOfDay(startingLesson.dataValues.LessonId);
            if (firstLesson) {
                let letStartLessonMessage = "Let's start Lesson #" + startingLesson.dataValues.dayNumber;
                await sendMessage(userMobileNumber, letStartLessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", letStartLessonMessage, null);
            }

            // Send lesson message
            let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
            lessonMessage += "\nListen to the dialogue and answer the questions. ";
            await sendMessage(userMobileNumber, lessonMessage);
            await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

            // Send video content
            const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
            let videoURL = documentFile[0].dataValues.video;
            await sendMediaMessage(userMobileNumber, videoURL, 'video');

            // Activity Logging
            await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null);

            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start next lesson"]);

            // Sleep
            await sleep(10000);

            // Next template for next lesson
            await sendNextLessonTemplateMessage(userMobileNumber);
        } else if (activity === 'listenAndSpeak' || activity === 'preListenAndSpeak' || activity === 'postListenAndSpeak') {
            if (startingLesson.dataValues.questionNumber === null) {
                // Lesson Started Record
                waLessonsCompletedRepository.create({
                    phoneNumber: userMobileNumber,
                    lessonId: startingLesson.dataValues.LessonId,
                    courseId: currentUserState.currentCourseId,
                    completionStatus: 'Started',
                    startTime: new Date(),
                });

                // First lesson of the day custom message
                const firstLesson = lessonRepository.isFirstLessonOfDay(startingLesson.dataValues.LessonId);
                if (firstLesson) {
                    let letStartLessonMessage = "Let's start Lesson #" + startingLesson.dataValues.dayNumber;
                    await sendMessage(userMobileNumber, letStartLessonMessage);
                    await createActivityLog(userMobileNumber, "text", "outbound", letStartLessonMessage, null);
                }

                // Send first Listen and Speak question
                const firstListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(startingLesson.dataValues.LessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstListenAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstListenAndSpeakQuestion.dataValues.mediaFile, 'audio');
                await createActivityLog(userMobileNumber, "audio", "outbound", firstListenAndSpeakQuestion.dataValues.mediaFile, null);

                await sleep(8000);

                // Send question tex
                await sendMessage(userMobileNumber, firstListenAndSpeakQuestion.dataValues.question);
                await createActivityLog(userMobileNumber, "text", "outbound", firstListenAndSpeakQuestion.dataValues.question, null);

                return;
            } else if (messageType === 'audio') {
                // Get the current Listen and Speak question
                const currentListenAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(user.dataValues.lesson_id, user.dataValues.question_number);

                // Extract buffer of audio
                const audioBuffer = audioResponse.data;
            }
        }
    } catch (error) {
        console.error('Error sending lesson to user:', error);
        error.fileName = 'chatBotService.js';
        throw error;
    };
};

const onboardingMessage = async (userMobileNumber, startingLesson) => {
    waUsersMetadataRepository.create({ phoneNumber: userMobileNumber });
    await waUserProgressRepository.create({
        phoneNumber: userMobileNumber,
        persona: "Teacher",
        engagement_type: "Trial Course",
        currentCourseId: await courseRepository.getCourseIdByName(
            "Trial Course - Teachers"
        ),
        currentWeek: startingLesson.dataValues.weekNumber,
        currentDay: startingLesson.dataValues.dayNumber,
        currentLessonId: startingLesson.dataValues.LessonId,
        currentLesson_sequence: startingLesson.dataValues.SequenceNumber,
        activityType: startingLesson.dataValues.activity,
        lastUpdated: new Date(),
    });
    await sendMessage(userMobileNumber, await extractConstantMessage("onboarding_bot_introduction_message"));
    await createActivityLog(userMobileNumber, "text", "outbound", await extractConstantMessage("onboarding_bot_introduction_message"), null);
    return;
};

export {
    sendMessage,
    retrieveMediaURL,
    onboardingMessage,
    createActivityLog,
    extractConstantMessage,
    sendLessonToUser,
    getAcceptableMessagesList,
};
