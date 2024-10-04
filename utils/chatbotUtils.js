import axios from "axios";
import dotenv from "dotenv";
import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waUserActivityLogsRepository from "../repositories/waUserActivityLogsRepository.js";
import waConstantsRepository from "../repositories/waConstantsRepository.js";
import documentFileRepository from "../repositories/documentFileRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import multipleChoiceQuestionRepository from "../repositories/multipleChoiceQuestionRepository.js";
import multipleChoiceQuestionAnswerRepository from "../repositories/multipleChoiceQuestionAnswerRepository.js";
import speakActivityQuestionRepository from '../repositories/speakActivityQuestionRepository.js';
import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import azureBlobStorage from "./azureBlobStorage.js";
import azureAIServices from '../utils/azureAIServices.js';

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

const sendMCQTemplateMessage = async (to, template_id) => {
    try {
        const response = await axios.post(
            `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'template',
                template: {
                    name: template_id,
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
            await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date());

            // First lesson of the day custom message
            // const firstLesson = await lessonRepository.isFirstLessonOfDay(currentUserState.dataValues.currentLessonId);
            // if (firstLesson) {
            //     let letStartLessonMessage = "Let's start Lesson #" + currentUserState.dataValues.currentDay;
            //     await sendMessage(userMobileNumber, letStartLessonMessage);
            //     await createActivityLog(userMobileNumber, "text", "outbound", letStartLessonMessage, null);
            // }

            // Send lesson message
            let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
            lessonMessage += "\nListen to the dialogue and answer the questions. ";
            await sendMessage(userMobileNumber, lessonMessage);
            await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

            // Send video content
            const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
            let videoURL = documentFile[0].dataValues.video;
            await sendMediaMessage(userMobileNumber, videoURL, 'video');
            await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null);

            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start next lesson"]);

            // Sleep
            await sleep(10000);

            // const lastLesson = await lessonRepository.isLastLessonOfDay(currentUserState.dataValues.currentLessonId);
            // if (lastLesson) {
            //     const totalLessons = await lessonRepository.getTotalDaysInCourse(currentUserState.currentCourseId);
            //     let endingMessage = "Lesson Completed 👏🏽\nYou have completed " + currentUserState.dataValues.currentDay + " out of " + totalLessons + " lessons! ⭐️";
            //     await sendMessage(userMobileNumber, endingMessage);
            //     await createActivityLog(userMobileNumber, "text", "outbound", endingMessage, null);
            // }

            // Next template for next lesson
            await sendNextLessonTemplateMessage(userMobileNumber);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start next lesson", null);
        }
        else if (activity == 'listenAndSpeak' || activity == 'preListenAndSpeak' || activity == 'postListenAndSpeak') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // First lesson of the day custom message
                // const firstLesson = await lessonRepository.isFirstLessonOfDay(currentUserState.dataValues.currentLessonId);
                // if (firstLesson) {
                //     let letStartLessonMessage = "Let's start Lesson #" + currentUserState.dataValues.currentDay;
                //     await sendMessage(userMobileNumber, letStartLessonMessage);
                //     await createActivityLog(userMobileNumber, "text", "outbound", letStartLessonMessage, null);
                // }

                // Send first Listen and Speak question
                const firstListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstListenAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstListenAndSpeakQuestion.dataValues.mediaFile, 'audio');
                await createActivityLog(userMobileNumber, "audio", "outbound", firstListenAndSpeakQuestion.dataValues.mediaFile, null);

                await sleep(4000);

                // Send question text
                await sendMessage(userMobileNumber, firstListenAndSpeakQuestion.dataValues.question);
                await createActivityLog(userMobileNumber, "text", "outbound", firstListenAndSpeakQuestion.dataValues.question, null);

                return;
            } else if (messageType === 'audio') {
                // Get the current Listen and Speak question
                const currentListenAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                const recognizedText = await azureAIServices.azureSpeechToText(messageContent.data);
                if (recognizedText) {
                    const answersArray = currentListenAndSpeakQuestion.dataValues.answer;
                    let userAnswerIsCorrect = false;
                    for (let i = 0; i < answersArray.length; i++) {
                        if (recognizedText.toLowerCase().includes(answersArray[i].toLowerCase())) {
                            userAnswerIsCorrect = true;
                            break;
                        }
                    }
                    if (!userAnswerIsCorrect) {
                        userAnswerIsCorrect = false;
                    }
                    const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, "audioFile.opus");
                    const submissionDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    const retryCounter = currentUserState.dataValues.retryCounter;
                    if (retryCounter == 0 || retryCounter == null) {
                        await waUserProgressRepository.updateRetryCounter(userMobileNumber, 1);
                        await waQuestionResponsesRepository.create(
                            userMobileNumber,
                            currentUserState.dataValues.currentLessonId,
                            currentListenAndSpeakQuestion.dataValues.id,
                            activity,
                            startingLesson.dataValues.activityAlias,
                            [recognizedText],
                            [userAudioFileUrl],
                            null,
                            null,
                            null,
                            [userAnswerIsCorrect],
                            retryCounter,
                            submissionDate
                        );
                    } else {
                        await waQuestionResponsesRepository.update(
                            userMobileNumber,
                            currentUserState.dataValues.currentLessonId,
                            currentListenAndSpeakQuestion.dataValues.id,
                            activity,
                            startingLesson.dataValues.activityAlias,
                            recognizedText,
                            userAudioFileUrl,
                            null,
                            null,
                            null,
                            userAnswerIsCorrect,
                            retryCounter,
                            submissionDate
                        );
                    }
                    if (userAnswerIsCorrect) {
                        await waUserProgressRepository.updateRetryCounter(userMobileNumber, 0);
                        await sendMessage(userMobileNumber, "✅ Great!");
                        await createActivityLog(userMobileNumber, "text", "outbound", "✅ Great!", null);
                    } else {
                        if (retryCounter !== 2) {
                            await waUserProgressRepository.updateRetryCounter(userMobileNumber, currentUserState.dataValues.retryCounter + 1);
                            await sendMessage(userMobileNumber, "❌ Try again");
                            await createActivityLog(userMobileNumber, "text", "outbound", "❌ Try again", null);
                            return;
                        } else if (retryCounter == 2) {
                            await waUserProgressRepository.updateRetryCounter(userMobileNumber, 0);
                            await sendMessage(userMobileNumber, "❌ The correct answer is: " + answersArray[0]);
                            await createActivityLog(userMobileNumber, "text", "outbound", "❌ The correct answer is: " + answersArray[0], null);
                        }
                    }
                    const nextListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                    if (nextListenAndSpeakQuestion) {
                        await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextListenAndSpeakQuestion.dataValues.questionNumber);
                        await sendMediaMessage(userMobileNumber, nextListenAndSpeakQuestion.dataValues.mediaFile, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", nextListenAndSpeakQuestion.dataValues.mediaFile, null);
                        await sleep(4000);
                        await sendMessage(userMobileNumber, nextListenAndSpeakQuestion.dataValues.question);
                        await createActivityLog(userMobileNumber, "text", "outbound", nextListenAndSpeakQuestion.dataValues.question, null);
                    } else {
                        const totalScore = await waQuestionResponsesRepository.getTotalScore(userMobileNumber, currentUserState.dataValues.currentLessonId);
                        const totalQuestions = await waQuestionResponsesRepository.getTotalQuestions(userMobileNumber, currentUserState.dataValues.currentLessonId);
                        const scorePercentage = (totalScore / totalQuestions) * 100;
                        let message = "❗️ RESULT ❗️\nYou scored " + totalScore + " out of " + totalQuestions + ".";
                        if (scorePercentage >= 0 && scorePercentage <= 60) {
                            message += "\nGood Effort! 👍🏽";
                        } else if (scorePercentage >= 61 && scorePercentage <= 79) {
                            message += "\nWell done! 🌟";
                        } else if (scorePercentage >= 80) {
                            message += "\nExcellent 🎉";
                        }
                        await sendMessage(userMobileNumber, message);
                        await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                        // Update acceptable messages list for the user
                        await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start next lesson"]);

                        // Sleep
                        await sleep(2000);

                        // Check if the lesson is the last lesson of the day
                        // const lastLesson = await lessonRepository.isLastLessonOfDay(currentUserState.dataValues.currentLessonId);
                        // if (lastLesson) {
                        //     const totalLessons = await lessonRepository.getTotalDaysInCourse(currentUserState.currentCourseId);
                        //     let endingMessage = "Lesson Completed 👏🏽\nYou have completed " + currentUserState.dataValues.currentDay + " out of " + totalLessons + " lessons! ⭐️";
                        //     await sendMessage(userMobileNumber, endingMessage);
                        //     await createActivityLog(userMobileNumber, "text", "outbound", endingMessage, null);
                        // }

                        // Next template for next lesson
                        await sendNextLessonTemplateMessage(userMobileNumber);
                        await createActivityLog(userMobileNumber, "template", "outbound", "Start next lesson", null);
                    }
                } else {
                    console.log("No speech recognized or an error occurred.");
                }
            }
        }
        else if (activity == 'audio') {
            // Lesson Started Record
            await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date());

            // First lesson of the day custom message
            // const firstLesson = await lessonRepository.isFirstLessonOfDay(currentUserState.dataValues.currentLessonId);
            // if (firstLesson) {
            //     let letStartLessonMessage = "Let's start Lesson #" + currentUserState.dataValues.currentDay;
            //     await sendMessage(userMobileNumber, letStartLessonMessage);
            //     await createActivityLog(userMobileNumber, "text", "outbound", letStartLessonMessage, null);
            // }

            // Send lesson message
            let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
            lessonMessage += "\nListen to the audio and answer the questions. ";
            await sendMessage(userMobileNumber, lessonMessage);
            await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

            // Send audio content
            const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
            let audioUrl, imageUrl;
            for (let i = 0; i < documentFile.length; i++) {
                if (documentFile[i].dataValues.audio) {
                    audioUrl = documentFile[i].dataValues.audio;
                }
                if (documentFile[i].dataValues.image) {
                    imageUrl = documentFile[i].dataValues.image;
                }
            }

            if (imageUrl) {
                await sendMediaMessage(userMobileNumber, imageUrl, 'image');
                await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null);
            }
            await sleep(4000);
            if (audioUrl) {
                await sendMediaMessage(userMobileNumber, audioUrl, 'audio');
                await createActivityLog(userMobileNumber, "audio", "outbound", audioUrl, null);
            }

            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start next lesson"]);

            // Sleep
            await sleep(10000);

            // const lastLesson = await lessonRepository.isLastLessonOfDay(currentUserState.dataValues.currentLessonId);
            // if (lastLesson) {
            //     const totalLessons = await lessonRepository.getTotalDaysInCourse(currentUserState.currentCourseId);
            //     let endingMessage = "Lesson Completed 👏🏽\nYou have completed " + currentUserState.dataValues.currentDay + " out of " + totalLessons + " lessons! ⭐️";
            //     await sendMessage(userMobileNumber, endingMessage);
            //     await createActivityLog(userMobileNumber, "text", "outbound", endingMessage, null);
            // }

            // Next template for next lesson
            await sendNextLessonTemplateMessage(userMobileNumber);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start next lesson", null);
        }
        else if (activity == 'mcqs' || activity == 'postMCQs' || activity == 'preMCQs') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // First lesson of the day custom message
                // const firstLesson = await lessonRepository.isFirstLessonOfDay(currentUserState.dataValues.currentLessonId);
                // if (firstLesson) {
                //     let letStartLessonMessage = "Let's start Lesson #" + currentUserState.dataValues.currentDay;
                //     await sendMessage(userMobileNumber, letStartLessonMessage);
                //     await createActivityLog(userMobileNumber, "text", "outbound", letStartLessonMessage, null);
                // }

                // Send first MCQs question
                const firstMCQsQuestion = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstMCQsQuestion.dataValues.QuestionNumber);

                // Send question as mcq template where templateId is currentLessonId_QuestionNumber
                await sendMCQTemplateMessage(userMobileNumber, `${currentUserState.dataValues.currentLessonId}_${firstMCQsQuestion.dataValues.QuestionNumber}`);
                const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(firstMCQsQuestion.dataValues.Id);
                let question = firstMCQsQuestion.dataValues.QuestionText;
                let message = question + "\n";
                for (let i = 0; i < mcqAnswers.length; i++) {
                    message += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                }
                await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                return;
            } else {
                const currentMCQsQuestion = await multipleChoiceQuestionRepository.getCurrentMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                const originalAnswer = messageContent;
                const userAnswer = messageContent.toLowerCase();

                const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(currentMCQsQuestion.dataValues.Id);

                let isCorrectAnswer = false;
                for (let i = 0; i < mcqAnswers.length; i++) {
                    if (mcqAnswers[i].dataValues.IsCorrect === true && userAnswer === mcqAnswers[i].dataValues.AnswerText.toLowerCase()) {
                        isCorrectAnswer = true;
                        break;
                    }
                }

                const submissionDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
                await waQuestionResponsesRepository.create(
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentMCQsQuestion.dataValues.Id,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    [originalAnswer],
                    null,
                    null,
                    null,
                    null,
                    [isCorrectAnswer],
                    1,
                    submissionDate
                );

                if (isCorrectAnswer) {
                    await sendMessage(userMobileNumber, "✅ Great!");
                    await createActivityLog(userMobileNumber, "text", "outbound", "✅ Great!", null);
                } else {
                    // Send correct here in mesassge like ❌ The correct answer is ___.
                    let correctAnswer = "❌ The correct answer is ";
                    for (let i = 0; i < mcqAnswers.length; i++) {
                        if (mcqAnswers[i].dataValues.IsCorrect === true) {
                            correctAnswer += mcqAnswers[i].dataValues.AnswerText;
                        }
                    }
                    await sendMessage(userMobileNumber, correctAnswer);
                    await createActivityLog(userMobileNumber, "text", "outbound", correctAnswer, null);
                }

                const nextMCQsQuestion = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                if (nextMCQsQuestion) {
                    await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextMCQsQuestion.dataValues.QuestionNumber);
                    await sendMCQTemplateMessage(userMobileNumber, `${currentUserState.dataValues.currentLessonId}_${nextMCQsQuestion.dataValues.QuestionNumber}`);
                    const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(nextMCQsQuestion.dataValues.Id);
                    let question = nextMCQsQuestion.dataValues.QuestionText;
                    let message = question + "\n";
                    for (let i = 0; i < mcqAnswers.length; i++) {
                        message += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                    }
                    await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                } else {
                    const totalScore = await waQuestionResponsesRepository.getTotalScore(userMobileNumber, currentUserState.dataValues.currentLessonId);
                    const totalQuestions = await waQuestionResponsesRepository.getTotalQuestions(userMobileNumber, currentUserState.dataValues.currentLessonId);
                    const scorePercentage = (totalScore / totalQuestions) * 100;
                    let message = "❗️ RESULT ❗️\nYou scored " + totalScore + " out of " + totalQuestions + ".";
                    if (scorePercentage >= 0 && scorePercentage <= 60) {
                        message += "\nGood Effort! 👍🏽";
                    } else if (scorePercentage >= 61 && scorePercentage <= 79) {
                        message += "\nWell done! 🌟";
                    } else if (scorePercentage >= 80) {
                        message += "\nExcellent 🎉";
                    }
                    await sendMessage(userMobileNumber, message);
                    await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start next lesson"]);

                    // Sleep
                    await sleep(2000);

                    // Check if the lesson is the last lesson of the day
                    // const lastLesson = await lessonRepository.isLastLessonOfDay(currentUserState.dataValues.currentLessonId);
                    // if (lastLesson) {
                    //     const totalLessons = await lessonRepository.getTotalDaysInCourse(currentUserState.currentCourseId);
                    //     let endingMessage = "Lesson Completed 👏🏽\nYou have completed " + currentUserState.dataValues.currentDay + " out of " + totalLessons + " lessons! ⭐️";
                    //     await sendMessage(userMobileNumber, endingMessage);
                    //     await createActivityLog(userMobileNumber, "text", "outbound", endingMessage, null);
                    // }

                    // Next template for next lesson
                    await sendNextLessonTemplateMessage(userMobileNumber);
                    await createActivityLog(userMobileNumber, "template", "outbound", "Start next lesson", null);
                }
            }
        }
        else if (activity == 'watchAndSpeak') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // First lesson of the day custom message
                // const firstLesson = await lessonRepository.isFirstLessonOfDay(currentUserState.dataValues.currentLessonId);
                // if (firstLesson) {
                //     let letStartLessonMessage = "Let's start Lesson #" + currentUserState.dataValues.currentDay;
                //     await sendMessage(userMobileNumber, letStartLessonMessage);
                //     await createActivityLog(userMobileNumber, "text", "outbound", letStartLessonMessage, null);
                // }

                // Send first Listen and Speak question
                const firstWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFile, 'video');
                await createActivityLog(userMobileNumber, "video", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFile, null);
                return;
            } else if (messageType === 'audio') {

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
