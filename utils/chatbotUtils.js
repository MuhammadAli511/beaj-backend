import axios from "axios";
import dotenv from "dotenv";
import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waUserActivityLogsRepository from "../repositories/waUserActivityLogsRepository.js";
import waConstantsRepository from "../repositories/waConstantsRepository.js";
import documentFileRepository from "../repositories/documentFileRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import multipleChoiceQuestionRepository from "../repositories/multipleChoiceQuestionRepository.js";
import multipleChoiceQuestionAnswerRepository from "../repositories/multipleChoiceQuestionAnswerRepository.js";
import speakActivityQuestionRepository from '../repositories/speakActivityQuestionRepository.js';
import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import azureBlobStorage from "./azureBlobStorage.js";
import azureAIServices from '../utils/azureAIServices.js';
import cleanTextForSpeech from "../utils/cleanText.js";

dotenv.config();

const whatsappToken = process.env.WHATSAPP_TOKEN;
const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const removeUser = async (phoneNumber) => {
    await waUsersMetadataRepository.deleteByPhoneNumber(phoneNumber);
    await waUserProgressRepository.deleteByPhoneNumber(phoneNumber);
    await waUserActivityLogsRepository.deleteByPhoneNumber(phoneNumber);
    await waLessonsCompletedRepository.deleteByPhoneNumber(phoneNumber);
    await waQuestionResponsesRepository.deleteByPhoneNumber(phoneNumber);

    await sendMessage(phoneNumber, "Your data has been removed. Please start again using the link provided.");
};

const generatePronunciationAssessmentMessage = async (pronunciationAssessment) => {
    const overallScores = pronunciationAssessment.scoreNumber;
    const words = pronunciationAssessment.words;

    // Create the overall score part of the message
    let message = `Pronunciation Assessment Results:\n\nOverall Scores:\n`;
    message += `- Accuracy: ${overallScores.accuracyScore}\n`;
    message += `- Fluency: ${overallScores.fluencyScore}\n`;
    message += `- Comprehension: ${overallScores.compScore}\n`;
    message += `- Prosody: ${overallScores.prosodyScore}\n`;
    message += `- Pronunciation: ${overallScores.pronScore}\n\n`;

    // Create the word breakdown part of the message
    message += `Word Breakdown:\n`;

    words.forEach((wordData, index) => {
        let wordLine = `${index + 1}. *${wordData.Word}*`;

        // If there's an AccuracyScore, append it
        if (wordData.PronunciationAssessment && wordData.PronunciationAssessment.AccuracyScore) {
            wordLine += ` - Accuracy: ${wordData.PronunciationAssessment.AccuracyScore}%`;
        }

        // If there's an ErrorType that is not "None", append it
        if (wordData.PronunciationAssessment && wordData.PronunciationAssessment.ErrorType && wordData.PronunciationAssessment.ErrorType !== "None") {
            wordLine += ` - Error: ${wordData.PronunciationAssessment.ErrorType}`;
        }

        // Add the word line to the message
        message += wordLine + `\n`;
    });

    return message;
}

const extractUserTranscriptionFromWords = async (pronunciationAssessment) => {
    const words = pronunciationAssessment.words;
    let transcription = "";
    words.forEach((wordData) => {
        transcription += wordData.Word + " ";
    });
    return transcription;
}

const getAcceptableMessagesList = async (activityType) => {
    if (activityType === "listenAndSpeak" || activityType === "postListenAndSpeak" || activityType === "preListenAndSpeak" || activityType === "watchAndSpeak" || activityType === "conversationalQuestionsBot" || activityType === "conversationalMonologueBot") {
        return ["audio"];
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
        let logger = `Outbound Message: User: ${to}, Message Type: text, Message Content: ${body}`;
        console.log(logger);
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
        questionId = userCurrentProgress.questionNumber || null;
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
        let logger = `Outbound Message: User: ${to}, Message Type: ${mediaType}, Message Content: ${mediaUrl}`;
        console.log(logger);
    } catch (error) {
        console.error('Error sending media message:', error.response ? error.response.data : error.message);
    }
};

const sendTemplateMessage = async (to, template_name) => {
    try {
        const response = await axios.post(
            `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'template',
                template: {
                    name: template_name,
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
        let logger = `Outbound Message: User: ${to}, Message Type: template, Message Content: ${template_name}`;
        console.log(logger);
    } catch (error) {
        console.error('Error sending template message:', error.response ? error.response.data : error.message);
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
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start next lesson"]);

            // Sleep
            await sleep(12000);

            // const lastLesson = await lessonRepository.isLastLessonOfDay(currentUserState.dataValues.currentLessonId);
            // if (lastLesson) {
            //     const totalLessons = await lessonRepository.getTotalDaysInCourse(currentUserState.currentCourseId);
            //     let endingMessage = "Lesson Completed 👏🏽\nYou have completed " + currentUserState.dataValues.currentDay + " out of " + totalLessons + " lessons! ⭐️";
            //     await sendMessage(userMobileNumber, endingMessage);
            //     await createActivityLog(userMobileNumber, "text", "outbound", endingMessage, null);
            // }

            // Next template for next lesson
            await sendTemplateMessage(userMobileNumber, "next_lesson_emoji");
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
                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\nListen to the audio and answer the questions. ";
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Listen and Speak question
                const firstListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstListenAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstListenAndSpeakQuestion.dataValues.mediaFile, 'audio');
                await createActivityLog(userMobileNumber, "audio", "outbound", firstListenAndSpeakQuestion.dataValues.mediaFile, null);
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
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
                        await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
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
                        await sendTemplateMessage(userMobileNumber, "next_lesson_emoji");
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
            await sleep(12000);

            // const lastLesson = await lessonRepository.isLastLessonOfDay(currentUserState.dataValues.currentLessonId);
            // if (lastLesson) {
            //     const totalLessons = await lessonRepository.getTotalDaysInCourse(currentUserState.currentCourseId);
            //     let endingMessage = "Lesson Completed 👏🏽\nYou have completed " + currentUserState.dataValues.currentDay + " out of " + totalLessons + " lessons! ⭐️";
            //     await sendMessage(userMobileNumber, endingMessage);
            //     await createActivityLog(userMobileNumber, "text", "outbound", endingMessage, null);
            // }

            // Next template for next lesson
            await sendTemplateMessage(userMobileNumber, "next_lesson_emoji");
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

                // Send question
                const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(firstMCQsQuestion.dataValues.Id);
                let mcqMessage = firstMCQsQuestion.dataValues.QuestionText + "\n";
                for (let i = 0; i < mcqAnswers.length; i++) {
                    mcqMessage += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                }
                await sendMessage(userMobileNumber, mcqMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", mcqMessage, null);
                await sendTemplateMessage(userMobileNumber, "mcq_options");
                await createActivityLog(userMobileNumber, "template", "outbound", "Option A\nOption B\nOption C", null);

                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["option a", "option b", "option c"]);
                return;
            } else {
                const currentMCQsQuestion = await multipleChoiceQuestionRepository.getCurrentMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                const originalAnswer = messageContent;
                const userAnswer = messageContent.toLowerCase();

                const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(currentMCQsQuestion.dataValues.Id);

                let isCorrectAnswer = false;
                for (let i = 0; i < mcqAnswers.length; i++) {
                    let matchWith = `option ${String.fromCharCode(65 + i)}`.toLowerCase();
                    if (mcqAnswers[i].dataValues.IsCorrect === true && userAnswer == matchWith) {
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
                    const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(nextMCQsQuestion.dataValues.Id);
                    let mcqMessage = nextMCQsQuestion.dataValues.QuestionText + "\n";
                    for (let i = 0; i < mcqAnswers.length; i++) {
                        mcqMessage += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                    }
                    await sendMessage(userMobileNumber, mcqMessage);
                    await createActivityLog(userMobileNumber, "text", "outbound", mcqMessage, null);
                    await sendTemplateMessage(userMobileNumber, "mcq_options");
                    await createActivityLog(userMobileNumber, "template", "outbound", "Option A\nOption B\nOption C", null);

                    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["option a", "option b", "option c"]);
                    return;
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
                    await sendTemplateMessage(userMobileNumber, "next_lesson_emoji");
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

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\nWatch the video and repeat the sentences. ";
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Listen and Speak question
                const firstWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFile, 'video');
                await createActivityLog(userMobileNumber, "video", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFile, null);
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                return;
            } else if (messageType === 'audio') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                const pronunciationAssessment = await azureAIServices.azurePronunciationAssessment(messageContent.data, currentWatchAndSpeakQuestion.dataValues.answer[0]);
                const userTranscription = await extractUserTranscriptionFromWords(pronunciationAssessment);
                const assessmentMessage = await generatePronunciationAssessmentMessage(pronunciationAssessment);


                await sendMessage(userMobileNumber, assessmentMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", assessmentMessage, null);

                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, "audioFile.opus");
                const submissionDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
                await waQuestionResponsesRepository.create(
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentWatchAndSpeakQuestion.dataValues.id,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    [userTranscription],
                    [userAudioFileUrl],
                    null,
                    null,
                    [pronunciationAssessment],
                    null,
                    1,
                    submissionDate
                );

                const nextWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                if (nextWatchAndSpeakQuestion) {
                    await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.questionNumber);
                    await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFile, 'video');
                    await createActivityLog(userMobileNumber, "video", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFile, null);
                } else {
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
                    await sendTemplateMessage(userMobileNumber, "next_lesson_emoji");
                    await createActivityLog(userMobileNumber, "template", "outbound", "Start next lesson", null);
                }
            }
        }
        else if (activity == 'read') {
            if (messageType != 'audio') {
                // Save as video activity but with pronunciation assessment
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
                lessonMessage += "\nRead the text and repeat the sentences. ";
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send video content
                const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
                let videoURL = documentFile[0].dataValues.video;
                await sendMediaMessage(userMobileNumber, videoURL, 'video');
                await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null);
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);

                // const lastLesson = await lessonRepository.isLastLessonOfDay(currentUserState.dataValues.currentLessonId);
                // if (lastLesson) {
                //     const totalLessons = await lessonRepository.getTotalDaysInCourse(currentUserState.currentCourseId);
                //     let endingMessage = "Lesson Completed 👏🏽\nYou have completed " + currentUserState.dataValues.currentDay + " out of " + totalLessons + " lessons! ⭐️
                //     await sendMessage(userMobileNumber, endingMessage);
                //     await createActivityLog(userMobileNumber, "text", "outbound", endingMessage, null);
                // }
            } else if (messageType == 'audio') {
                // Get the current Read question text


            }
        }
        else if (activity == 'conversationalQuestionsBot') {
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

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\nChat with the bot and answer the questions. ";
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send Conversation Bot Question
                const firstConversationBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstConversationBotQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstConversationBotQuestion.dataValues.mediaFile, 'audio');
                await createActivityLog(userMobileNumber, "audio", "outbound", firstConversationBotQuestion.dataValues.mediaFile, null);
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                return;
            }
            else if (messageType === 'audio') {
                // Get the current Conversation Bot question
                const currentConversationBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                const recognizedText = await azureAIServices.azureSpeechToText(messageContent.data);
                if (recognizedText) {
                    const message = `Please wait for an answer. \n\nYou said: ${recognizedText}`;
                    await sendMessage(userMobileNumber, message);
                    await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                    const openaiFeedbackTranscript = await azureAIServices.openaiFeedback(recognizedText);
                    const openaiFeedbackAudio = await azureAIServices.azureTextToSpeechAndUpload(openaiFeedbackTranscript);
                    await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                    await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);

                    const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, "audioFile.opus");

                    const submissionDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    await waQuestionResponsesRepository.create(
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentConversationBotQuestion.dataValues.id,
                        activity,
                        startingLesson.dataValues.activityAlias,
                        [recognizedText],
                        [userAudioFileUrl],
                        [openaiFeedbackTranscript],
                        [openaiFeedbackAudio],
                        null,
                        null,
                        1,
                        submissionDate
                    );

                    const nextConversationBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                    if (nextConversationBotQuestion) {
                        await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextConversationBotQuestion.dataValues.questionNumber);
                        await sendMediaMessage(userMobileNumber, nextConversationBotQuestion.dataValues.mediaFile, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", nextConversationBotQuestion.dataValues.mediaFile, null);
                    } else {
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
                        await sendTemplateMessage(userMobileNumber, "next_lesson_emoji");
                        await createActivityLog(userMobileNumber, "template", "outbound", "Start next lesson", null);
                    }
                }
            }
        }
        else if (activity == 'conversationalMonologueBot') {
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

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\nChat with the bot and answer the questions. ";
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send Conversation Bot Monologue
                const conversationBotMonologue = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, conversationBotMonologue.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, conversationBotMonologue.dataValues.mediaFile, 'audio');
                await createActivityLog(userMobileNumber, "audio", "outbound", conversationBotMonologue.dataValues.mediaFile, null);
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                return;
            }
            else if (messageType === 'audio') {
                // Get the current Conversation Bot Monologue
                // This will have both openai feedback and pronunciation assessment
                const currentConversationBotMonologue = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                const recognizedText = await azureAIServices.azureSpeechToText(messageContent.data);
                if (recognizedText) {
                    const message = `Please wait for an answer. \n\nYou said: ${recognizedText}`;
                    await sendMessage(userMobileNumber, message);
                    await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                    // OpenAI Feedback
                    const openaiFeedbackTranscript = await azureAIServices.openaiFeedback(recognizedText);
                    const openaiFeedbackAudio = await azureAIServices.azureTextToSpeechAndUpload(openaiFeedbackTranscript);
                    await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                    await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);

                    // Pronunciation Assessment
                    const pronunciationAssessment = await azureAIServices.azurePronunciationAssessment(messageContent.data, currentConversationBotMonologue.dataValues.answer[0]);
                    const userTranscription = await extractUserTranscriptionFromWords(pronunciationAssessment);
                    const assessmentMessage = await generatePronunciationAssessmentMessage(pronunciationAssessment);
                    await sendMessage(userMobileNumber, assessmentMessage);
                    await createActivityLog(userMobileNumber, "text", "outbound", assessmentMessage, null);

                    const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, "audioFile.opus");
                    const submissionDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    await waQuestionResponsesRepository.create(
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentConversationBotMonologue.dataValues.id,
                        activity,
                        startingLesson.dataValues.activityAlias,
                        [userTranscription],
                        [userAudioFileUrl],
                        [openaiFeedbackTranscript],
                        [openaiFeedbackAudio],
                        [pronunciationAssessment],
                        null,
                        1,
                        submissionDate
                    );

                    const nextConversationBotMonologue = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                    if (nextConversationBotMonologue) {
                        await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextConversationBotMonologue.dataValues.questionNumber);
                        await sendMediaMessage(userMobileNumber, nextConversationBotMonologue.dataValues.mediaFile, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", nextConversationBotMonologue.dataValues.mediaFile, null);
                    } else {
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
                        await sendTemplateMessage(userMobileNumber, "next_lesson_emoji");
                        await createActivityLog(userMobileNumber, "template", "outbound", "Start next lesson", null);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error sending lesson to user:', error);
        error.fileName = 'chatBotService.js';
        throw error;
    };
};

const outlineMessage = async (userMobileNumber) => {
    await waUserProgressRepository.create({
        phoneNumber: userMobileNumber,
        persona: "Teacher",
        engagement_type: "Outline Message",
        lastUpdated: new Date(),
    });
    const botIntroMessage = await extractConstantMessage("onboarding_bot_introduction_message");
    await sendMessage(userMobileNumber, botIntroMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", botIntroMessage, null);

    const outlineImageLink = await extractConstantMessage("level_one_course_outline");
    await sendMediaMessage(userMobileNumber, outlineImageLink, 'image');
    await createActivityLog(userMobileNumber, "image", "outbound", outlineImageLink, null);
    await sleep(2000);

    await sendTemplateMessage(userMobileNumber, "apply_now_or_try_course_demo");
    await createActivityLog(userMobileNumber, "template", "outbound", "Apply Now or Try Course Demo", null);

    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["apply now", "try course demo"]);
    return;
};

const nameInputMessage = async (userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "Name Input");
    await sendMessage(userMobileNumber, "Your Full Name\n(e.g. Saima Khan)");
    await createActivityLog(userMobileNumber, "text", "outbound", "Your Full Name\n(e.g. Saima Khan)", null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["text"]);
    return;
};

const districtInputMessage = async (userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "District Input");
    await sendMessage(userMobileNumber, "Your District\n(e.g. Faisalabad, Punjab)");
    await createActivityLog(userMobileNumber, "text", "outbound", "Your District\n(e.g. Faisalabad, Punjab)", null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["text"]);
    return;
};

const preferredTimingInputMessage = async (userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "Preferred Timing Input");
    await sendTemplateMessage(userMobileNumber, "live_class_timing");
    await createActivityLog(userMobileNumber, "template", "outbound", "Live Class Timing", null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["text"]);
    return;
};

const thankYouMessage = async (userMobileNumber) => {
    const message = "Thank you for applying! This course starts on November 4, 2024.\n\nWithin 48 hours a Beaj Team Member will call you to confirm if you get selected for this batch."
    await sendMessage(userMobileNumber, message);
    await createActivityLog(userMobileNumber, "text", "outbound", message, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start next lesson"]);
    const random = Math.floor(Math.random() * 3);
    let targetGroup;
    if (random === 0) {
        targetGroup = 'T1';
    }
    if (random === 1) {
        targetGroup = 'T2';
    }
    if (random === 2) {
        targetGroup = 'Control';
    }
    await waUsersMetadataRepository.update(userMobileNumber, { targetGroup: targetGroup });
    return;
};

const trialCourseStart = async (userMobileNumber, startingLesson) => {
    await waUserProgressRepository.update(
        userMobileNumber,
        await courseRepository.getCourseIdByName(
            "Trial Course - Teachers"
        ),
        startingLesson.dataValues.weekNumber,
        startingLesson.dataValues.dayNumber,
        startingLesson.dataValues.LessonId,
        startingLesson.dataValues.SequenceNumber,
        startingLesson.dataValues.activity,
        null,
        null,
    );
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "Trial Course - Teachers");
    await sendMessage(userMobileNumber, "Let's start your free trial. Here is your first lesson:");
    await createActivityLog(userMobileNumber, "text", "outbound", "Let's start your free trial. Here is your first lesson:", null);
    return;
};

const checkUserMessageAndAcceptableMessages = async (userMobileNumber, currentUserState, currentLesson, messageType, messageContent) => {
    const acceptableMessagesList = currentUserState.dataValues.acceptableMessages;
    const activityType = currentUserState.dataValues.activityType;
    if (activityType === "listenAndSpeak" || activityType === "postListenAndSpeak" || activityType === "preListenAndSpeak" || activityType === "watchAndSpeak" || activityType === "conversationalQuestionsBot" || activityType === "conversationalMonologueBot") {
        if (acceptableMessagesList.includes("audio") && messageType === "audio") {
            return true;
        }
    }
    if (acceptableMessagesList.includes(messageContent.toLowerCase())) {
        return true;
    } else {
        // Write customized message based on the acceptable messages list
        let message = "I'm sorry, I didn't understand that. Please try again.";
        if (acceptableMessagesList.length > 1) {
            message += "\n\nAcceptable messages are:";
            for (let i = 0; i < acceptableMessagesList.length; i++) {
                message += "\n" + acceptableMessagesList[i];
            }
        } else {
            message += "\n\nAcceptable message is: " + acceptableMessagesList[0];
        }
        await sendMessage(userMobileNumber, message);
        await createActivityLog(userMobileNumber, "text", "outbound", message, null);
        return false;
    }
};

const continuePracticingMessage = async (userMobileNumber) => {
    await sendMessage(userMobileNumber, 'To continue practicing, apply for the full course.\nSeats are limited!');
    await createActivityLog(userMobileNumber, 'text', 'outbound', 'To continue practicing, apply for the full course.\nSeats are limited!', null);
    await sleep(2000);
    await sendTemplateMessage(userMobileNumber, 'apply_now');
    await createActivityLog(userMobileNumber, 'template', 'outbound', 'Apply Now', null);
    await waUserProgressRepository.update(
        userMobileNumber,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
    )
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ['apply now']);
    await waUserProgressRepository.updateEngagementType(userMobileNumber, 'Apply Now');
    return;
}

export {
    sendMessage,
    retrieveMediaURL,
    outlineMessage,
    createActivityLog,
    extractConstantMessage,
    sendLessonToUser,
    getAcceptableMessagesList,
    nameInputMessage,
    districtInputMessage,
    thankYouMessage,
    preferredTimingInputMessage,
    trialCourseStart,
    continuePracticingMessage,
    removeUser,
    checkUserMessageAndAcceptableMessages
};
