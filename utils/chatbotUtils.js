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
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const whatsappToken = process.env.WHATSAPP_TOKEN;
const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Register the Arial font
registerFont(join(__dirname, '../fonts/arial.ttf'), { family: 'Arial' });

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


async function createAndUploadScoreImage(pronunciationAssessment) {
    try {
        const pronounciationScoreNumber = Math.round(pronunciationAssessment.scoreNumber.pronScore);
        const fluencyScoreNumber = Math.round(pronunciationAssessment.scoreNumber.fluencyScore);
        const words = pronunciationAssessment.words;

        // Set up canvas dimensions
        const width = 900;
        const height = 800;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Draw background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Load and add the company logo in the top-right corner
        // const image = await loadImage(logoPath);  // Path to the logo image
        // ctx.drawImage(image, width - 160, 20, image.width / 7.5, image.height / 7.5);

        // Add "YOUR SCORE" Title
        ctx.font = 'bold 40px Arial';
        ctx.fillStyle = '#000000';
        ctx.fillText('YOUR SCORE', 50, 80);

        // Add "Pronunciation" Bar with dynamic score
        ctx.font = '25px Arial';
        ctx.fillText('Pronunciation', 50, 150);

        // Draw light blue background bar for full length
        ctx.fillStyle = '#B2EBF2';
        ctx.fillRect(50, 160, 790, 40);

        // Draw dark blue foreground bar for actual score
        ctx.fillStyle = '#30D5C8';
        ctx.fillRect(50, 160, 790 * (pronounciationScoreNumber / 100), 40);

        // Add score text inside the bar
        ctx.fillStyle = '#000000';
        ctx.fillText(`${pronounciationScoreNumber}%`, 50 + 790 * (pronounciationScoreNumber / 100) - 70, 187);

        // Add "Fluency" Bar with dynamic score
        ctx.fillText('Fluency', 50, 250);

        // Draw light yellow background bar for full length
        ctx.fillStyle = '#F0F4C3';
        ctx.fillRect(50, 260, 790, 40);

        // Draw darker yellow foreground bar for actual score
        ctx.fillStyle = '#C7EA46';
        ctx.fillRect(50, 260, 790 * (fluencyScoreNumber / 100), 40);

        // Add score text inside the bar
        ctx.fillStyle = '#000000';
        ctx.fillText(`${fluencyScoreNumber}%`, 50 + 790 * (fluencyScoreNumber / 100) - 70, 287);

        // Add "You said" section
        ctx.font = 'bold 30px Arial';
        ctx.fillText('You said', 50, 380);

        // Create a paragraph format for the text
        ctx.font = '25px Arial';
        const marginLeft = 50;
        const maxWidth = 850;
        let lineHeight = 40;
        let cursorX = marginLeft;
        let cursorY = 430; // Starting Y position for the text

        // Loop through words and handle line breaks
        words.forEach((wordObj) => {
            // If not Mispronunciation, Omission, or None, skip the word
            if (!['Mispronunciation', 'Omission', 'None'].includes(wordObj.PronunciationAssessment.ErrorType)) {
                return;
            }
            const word = wordObj.Word;
            const errorType = wordObj.PronunciationAssessment.ErrorType;
            const wordWidth = ctx.measureText(word).width + 15; // Measure width of the word

            // If the word exceeds the max width, move to a new line
            if (cursorX + wordWidth > maxWidth) {
                cursorX = marginLeft; // Reset X position to the left margin
                cursorY += lineHeight; // Move to the next line
            }

            if (errorType === 'Mispronunciation') {
                // Highlight mispronounced words in yellow
                ctx.fillStyle = '#FFD700'; // Yellow
                ctx.fillRect(cursorX - 5, cursorY - 25, wordWidth - 5, 30);
                ctx.fillStyle = '#000000'; // Black text
                ctx.fillText(word, cursorX, cursorY);
            } else if (errorType === 'Omission') {
                // Highlight skipped words in grey
                ctx.fillStyle = '#A9A9A9'; // Grey
                ctx.fillRect(cursorX - 5, cursorY - 25, wordWidth - 5, 30);
                ctx.fillStyle = '#000000'; // Black text
                ctx.fillText(word, cursorX, cursorY);
            } else if (errorType === 'None') {
                // Regular words
                ctx.fillStyle = '#000000';
                ctx.fillText(word, cursorX, cursorY);
            }

            // Move cursor for the next word
            cursorX += wordWidth;
        });

        // Add the legends at the bottom
        ctx.font = '20px Arial';

        // Mispronounced Words Legend (Yellow Circle)
        ctx.fillStyle = '#FFD700'; // Yellow color
        ctx.beginPath(); // Start a new path
        ctx.arc(60, 760, 10, 0, 2 * Math.PI); // Draw a circle
        ctx.fill(); // Fill the circle
        ctx.fillStyle = '#000000';
        ctx.fillText('Mispronounced Words', 80, 767);

        // Skipped Words Legend (Grey Circle)
        ctx.fillStyle = '#A9A9A9'; // Grey color
        ctx.beginPath(); // Start a new path
        ctx.arc(350, 760, 10, 0, 2 * Math.PI); // Draw a circle
        ctx.fill(); // Fill the circle
        ctx.fillStyle = '#000000';
        ctx.fillText('Skipped Words', 380, 767);

        // Convert the canvas to a buffer
        const buffer = canvas.toBuffer('image/jpeg');

        // Upload to Azure Blob Storage
        const imageUrl = await azureBlobStorage.uploadImageToBlobStorage(buffer);
        console.log('Image URL:', imageUrl);
        return imageUrl;
    } catch (err) {
        console.error('Error creating and uploading image:', err);
        throw new Error('Failed to create and upload image');
    }
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
    } else if (actionType === "interactive" && messageDirection == 'inbound') {
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


const sendButtonMessage = async (to, bodyText, buttonOptions) => {
    try {
        const response = await axios.post(
            `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'interactive',
                interactive: {
                    type: 'button',
                    body: {
                        text: bodyText
                    },
                    action: {
                        buttons: buttonOptions.map(option => ({
                            type: 'reply',
                            reply: {
                                id: option.id,
                                title: option.title
                            }
                        }))
                    }
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${whatsappToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        let logger = `Outbound Message: User: ${to}, Message Type: button, Message Content: ${bodyText}`;
        console.log(logger);
    } catch (error) {
        console.error('Error sending button message:', error.response ? error.response.data : error.message);
    }
};

const removeHTMLTags = (text) => {
    return text.replace(/<[^>]*>?/gm, '');
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

            // Send lesson message
            let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
            lessonMessage += "\n" + removeHTMLTags(startingLesson.dataValues.text);

            // Text message
            await sendMessage(userMobileNumber, lessonMessage);
            await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

            // Send video content
            const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
            let videoURL = documentFile[0].dataValues.video;

            // Media message
            await sendMediaMessage(userMobileNumber, videoURL, 'video');
            await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null);

            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["next"]);

            // Sleep
            await sleep(10000);

            // Reply buttons to move forward
            await sendButtonMessage(userMobileNumber, 'Let’s Start Questions👇🏽', [{ id: 'next', title: 'Next' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Next", null);
        }
        else if (activity == 'listenAndSpeak' || activity == 'preListenAndSpeak' || activity == 'postListenAndSpeak') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = "Listen to the audio question and record your answer as a voice note.💬";

                // Text message
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Listen and Speak question
                const firstListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstListenAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstListenAndSpeakQuestion.dataValues.mediaFile, 'audio');
                await createActivityLog(userMobileNumber, "audio", "outbound", firstListenAndSpeakQuestion.dataValues.mediaFile, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                await sleep(5000);

                // Send question text
                await sendMessage(userMobileNumber, firstListenAndSpeakQuestion.dataValues.question);
                await createActivityLog(userMobileNumber, "text", "outbound", firstListenAndSpeakQuestion.dataValues.question, null);

                return;
            } else if (messageType === 'audio') {
                // Get the current Listen and Speak question
                const currentListenAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // OpenAI Speech to Text
                const recognizedText = await azureAIServices.openaiSpeechToText(messageContent.data);
                if (recognizedText) {
                    // Checking if user response is correct or not
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

                    // Uploading user audio to Azure Blob Storage
                    const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                    const uniqueID = uuidv4();
                    const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                    const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);

                    // Save user response to the database
                    const submissionDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    const retryCounter = currentUserState.dataValues.retryCounter;
                    // User first attempt
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
                            retryCounter + 1,
                            submissionDate
                        );
                    }
                    // User other attempts
                    else {
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
                            retryCounter + 1,
                            submissionDate
                        );
                    }
                    // If user response is correct
                    if (userAnswerIsCorrect) {
                        // Reset retry counter
                        await waUserProgressRepository.updateRetryCounter(userMobileNumber, 0);

                        // Text message
                        let correctMessage = "You said:\n" + recognizedText + "\n✅ Great!";
                        await sendMessage(userMobileNumber, correctMessage);
                        await createActivityLog(userMobileNumber, "text", "outbound", correctMessage, null);
                    }
                    // If user response is incorrect
                    else {
                        if (retryCounter !== 2) {
                            // Update retry counter
                            await waUserProgressRepository.updateRetryCounter(userMobileNumber, currentUserState.dataValues.retryCounter + 1);

                            // Text message
                            let wrongMessage = "You said:\n" + recognizedText + "\n❌ Try Again!";
                            await sendMessage(userMobileNumber, wrongMessage);
                            await createActivityLog(userMobileNumber, "text", "outbound", wrongMessage, null);
                            return;
                        } else if (retryCounter == 2) {
                            // Reset retry counter
                            await waUserProgressRepository.updateRetryCounter(userMobileNumber, 0);

                            // Text message
                            let wrongMessage = "You said:\n" + recognizedText + "\n❌ The correct answer is: " + answersArray[0];
                            await sendMessage(userMobileNumber, wrongMessage);
                            await createActivityLog(userMobileNumber, "text", "outbound", wrongMessage, null);
                        }
                    }
                    const nextListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                    if (nextListenAndSpeakQuestion) {
                        // Update question number
                        await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextListenAndSpeakQuestion.dataValues.questionNumber);

                        // Media message
                        await sendMediaMessage(userMobileNumber, nextListenAndSpeakQuestion.dataValues.mediaFile, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", nextListenAndSpeakQuestion.dataValues.mediaFile, null);

                        // Update acceptable messages list for the user
                        await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                        await sleep(5000);

                        // Text message
                        await sendMessage(userMobileNumber, nextListenAndSpeakQuestion.dataValues.question);
                        await createActivityLog(userMobileNumber, "text", "outbound", nextListenAndSpeakQuestion.dataValues.question, null);
                    } else {
                        // Calculate total score and send message
                        const totalScore = await waQuestionResponsesRepository.getTotalScore(userMobileNumber, currentUserState.dataValues.currentLessonId);
                        const totalQuestions = await waQuestionResponsesRepository.getTotalQuestions(userMobileNumber, currentUserState.dataValues.currentLessonId);
                        const scorePercentage = (totalScore / totalQuestions) * 100;
                        let message = "*Your score: " + totalScore + "/" + totalQuestions + ".*";
                        if (scorePercentage >= 0 && scorePercentage <= 60) {
                            message += "\nGood Effort! 👍🏽";
                        } else if (scorePercentage >= 61 && scorePercentage <= 79) {
                            message += "\nWell done! 🌟";
                        } else if (scorePercentage >= 80) {
                            message += "\nExcellent 🎉";
                        }
                        await sendMessage(userMobileNumber, message);
                        await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                        // Reset Question Number, Retry Counter, and Activity Type
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                        // Update acceptable messages list for the user
                        await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["try next activity", "apply for course"]);

                        // Sleep
                        await sleep(2000);

                        // Reply Buttons
                        await sendButtonMessage(userMobileNumber, '👏🏽Activity Complete! 🤓', [{ id: 'try_next_activity', title: 'Try Next Activity' }, { id: 'apply_for_course', title: 'Apply for Course' }]);
                        await createActivityLog(userMobileNumber, "template", "outbound", "Try Next Activity or Apply for Course", null);
                    }
                } else {
                    // TODO: Handle if no speech recognized
                    console.log("No speech recognized or an error occurred.");
                }
            }
        }
        else if (activity == 'audio') {
            // Lesson Started Record
            await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date());

            // Send lesson message
            let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
            lessonMessage += "\nListen to the audio and answer the questions. ";
            // Text message
            await sendMessage(userMobileNumber, lessonMessage);
            await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

            // Fetch audio and image URLs
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

            // Send media files
            if (imageUrl) {
                await sendMediaMessage(userMobileNumber, imageUrl, 'image');
                await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null);
            }
            await sleep(5000);
            if (audioUrl) {
                await sendMediaMessage(userMobileNumber, audioUrl, 'audio');
                await createActivityLog(userMobileNumber, "audio", "outbound", audioUrl, null);
            }

            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["try next activity", "apply for course"]);

            // Sleep
            await sleep(10000);

            // Reply Buttons
            await sendButtonMessage(userMobileNumber, '👏🏽Activity Complete! 🤓', [{ id: 'try_next_activity', title: 'Try Next Activity' }, { id: 'apply_for_course', title: 'Apply for Course' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Try Next Activity or Apply for Course", null);
        }
        else if (activity == 'mcqs' || activity == 'postMCQs' || activity == 'preMCQs') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send first MCQs question
                const firstMCQsQuestion = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstMCQsQuestion.dataValues.QuestionNumber);

                // Send question
                const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(firstMCQsQuestion.dataValues.Id);
                let mcqMessage = firstMCQsQuestion.dataValues.QuestionText + "\n" + "Choose the correct answer.\n";
                for (let i = 0; i < mcqAnswers.length; i++) {
                    mcqMessage += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                }

                // Reply buttons to answer
                await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `option_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })));
                await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["option a", "option b", "option c"]);
                return;
            } else {
                // Get current MCQ question
                const currentMCQsQuestion = await multipleChoiceQuestionRepository.getCurrentMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Upper and Lower case answers
                const originalAnswer = messageContent;
                const userAnswer = messageContent.toLowerCase();

                // Get all answers against the question
                const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(currentMCQsQuestion.dataValues.Id);

                // Check if the user answer is correct
                let isCorrectAnswer = false;
                for (let i = 0; i < mcqAnswers.length; i++) {
                    let matchWith = `option ${String.fromCharCode(65 + i)}`.toLowerCase();
                    if (mcqAnswers[i].dataValues.IsCorrect === true && userAnswer == matchWith) {
                        isCorrectAnswer = true;
                        break;
                    }
                }

                // Save user response to the database
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

                // Correct Answer Feedback
                if (isCorrectAnswer) {
                    // Text message
                    await sendMessage(userMobileNumber, "✅ Great!\n");
                    await createActivityLog(userMobileNumber, "text", "outbound", "✅ Great!\n", null);
                }
                // Incorrect Answer Feedback
                else {
                    let correctAnswer = "❌ The correct answer is ";
                    for (let i = 0; i < mcqAnswers.length; i++) {
                        if (mcqAnswers[i].dataValues.IsCorrect === true) {
                            correctAnswer += "Option " + String.fromCharCode(65 + i) + ": " + mcqAnswers[i].dataValues.AnswerText;
                        }
                    }
                    // Text message
                    await sendMessage(userMobileNumber, correctAnswer);
                    await createActivityLog(userMobileNumber, "text", "outbound", correctAnswer, null);
                }

                // Get next MCQ question
                const nextMCQsQuestion = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                if (nextMCQsQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextMCQsQuestion.dataValues.QuestionNumber);

                    // Send question
                    const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(nextMCQsQuestion.dataValues.Id);
                    let mcqMessage = nextMCQsQuestion.dataValues.QuestionText + "\n" + "Choose the correct answer.\n";
                    for (let i = 0; i < mcqAnswers.length; i++) {
                        mcqMessage += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                    }

                    // Reply buttons to answer
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `option_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })));
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);

                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["option a", "option b", "option c"]);
                    return;
                } else {
                    // Calculate total score and send message
                    const totalScore = await waQuestionResponsesRepository.getTotalScore(userMobileNumber, currentUserState.dataValues.currentLessonId);
                    const totalQuestions = await waQuestionResponsesRepository.getTotalQuestions(userMobileNumber, currentUserState.dataValues.currentLessonId);
                    const scorePercentage = (totalScore / totalQuestions) * 100;
                    let message = "*Your score " + totalScore + "/" + totalQuestions + ".*";
                    if (scorePercentage >= 0 && scorePercentage <= 60) {
                        message += "\nGood Effort! 👍🏽";
                    } else if (scorePercentage >= 61 && scorePercentage <= 79) {
                        message += "\nWell done! 🌟";
                    } else if (scorePercentage >= 80) {
                        message += "\nExcellent 🎉";
                    }
                    // Text message
                    await sendMessage(userMobileNumber, message);
                    await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["try next activity", "apply for course"]);

                    // Sleep
                    await sleep(2000);

                    // Reply Buttons
                    await sendButtonMessage(userMobileNumber, '👏🏽Activity Complete! 🤓', [{ id: 'try_next_activity', title: 'Try Next Activity' }, { id: 'apply_for_course', title: 'Apply for Course' }]);
                    await createActivityLog(userMobileNumber, "template", "outbound", "Try Next Activity or Apply for Course", null);
                }
            }
        }
        else if (activity == 'watchAndSpeak') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\nWatch the videos and then practice speaking by recording voice notes. 💬";
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Watch and Speak question
                const firstWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFile, 'video');
                await createActivityLog(userMobileNumber, "video", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFile, null);
                await sleep(10000);

                // Send question text
                let message = "Now you practice speaking by recording a voice note.💬"
                await sendMessage(userMobileNumber, message);
                await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                return;
            } else if (messageType === 'audio') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Extract user transcription from words
                const userTranscription = await azureAIServices.openaiSpeechToText(messageContent.data);

                // Text message
                await sendMessage(userMobileNumber, "You said: " + userTranscription);
                await createActivityLog(userMobileNumber, "text", "outbound", "You said: " + userTranscription, null);

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await azureAIServices.azurePronunciationAssessment(messageContent.data, currentWatchAndSpeakQuestion.dataValues.answer[0]);

                // Generate pronunciation assessment message
                const imageUrl = await createAndUploadScoreImage(pronunciationAssessment);

                // Media message
                await sendMediaMessage(userMobileNumber, imageUrl, 'image');
                await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null);
                await sleep(5000);

                // Save user response to the database
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
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
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.questionNumber);

                    // Send question media file
                    await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFile, 'video');
                    await createActivityLog(userMobileNumber, "video", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFile, null);
                    await sleep(10000);

                    // Send question text
                    let message = "Now you practice speaking by recording a voice note.💬"

                    // Text message
                    await sendMessage(userMobileNumber, message);
                    await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                } else {
                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["try next activity", "apply for course"]);

                    // Sleep
                    await sleep(2000);

                    // Reply Buttons
                    await sendButtonMessage(userMobileNumber, '👏🏽Activity Complete! 🤓', [{ id: 'try_next_activity', title: 'Try Next Activity' }, { id: 'apply_for_course', title: 'Apply for Course' }]);
                    await createActivityLog(userMobileNumber, "template", "outbound", "Try Next Activity or Apply for Course", null);
                }
            }
        }
        else if (activity == 'read') {
            if (messageType != 'audio') {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\nListen to the passage carefully and then practice reading it.";
                // Text message
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send video content
                const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
                let videoURL = documentFile[0].dataValues.video;

                // Media message
                await sendMediaMessage(userMobileNumber, videoURL, 'video');
                await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                await sleep(10000);

                // Text message
                await sendMessage(userMobileNumber, "Send us a voice note of you reading this passage.💬");
                await createActivityLog(userMobileNumber, "text", "outbound", "Send us a voice note of you reading this passage.💬", null);

                // Remove html tags from the text
                const lessonText = startingLesson.dataValues.text;
                const cleanedLessonText = removeHTMLTags(lessonText);

                // Text message
                await sendMessage(userMobileNumber, cleanedLessonText);
                await createActivityLog(userMobileNumber, "text", "outbound", cleanedLessonText, null);
            } else if (messageType == 'audio') {
                // Get the current Read question text
                const lessonText = startingLesson.dataValues.text;

                // Remove punctuation from the text
                const textWithoutPunctuation = lessonText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()'"‘’“”]/g, "");

                // Remove HTML tags from the text
                const textWithoutPunctuationAndHtmlTags = removeHTMLTags(textWithoutPunctuation);

                // Extract user transcription from words
                const userTranscription = await azureAIServices.openaiSpeechToText(messageContent.data);

                // Text message
                await sendMessage(userMobileNumber, "You said: " + userTranscription);
                await createActivityLog(userMobileNumber, "text", "outbound", "You said: " + userTranscription, null);

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await azureAIServices.azurePronunciationAssessment(messageContent.data, textWithoutPunctuationAndHtmlTags);

                const imageUrl = await createAndUploadScoreImage(pronunciationAssessment);

                // Media message
                await sendMediaMessage(userMobileNumber, imageUrl, 'image');
                await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null);
                await sleep(5000);

                // Save user response to the database
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                const submissionDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
                await waQuestionResponsesRepository.create(
                    userMobileNumber,
                    startingLesson.dataValues.LessonId,
                    null,
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

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["apply for course"]);
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
                await waUserProgressRepository.updateEngagementType(userMobileNumber, 'Apply for Course');

                // Sleep
                await sleep(2000);

                // Reply Buttons
                await sendButtonMessage(userMobileNumber, '👏🏽Demo Complete! 🤓', [{ id: 'apply_for_course', title: 'Apply for Course' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", "Apply for Course", null);
                return;
            }
        }
        else if (activity == 'conversationalQuestionsBot') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = "Now let's practice speaking English!";

                // Text message
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send Conversation Bot Question
                const firstConversationBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstConversationBotQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstConversationBotQuestion.dataValues.mediaFile, 'audio');
                await createActivityLog(userMobileNumber, "audio", "outbound", firstConversationBotQuestion.dataValues.mediaFile, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                return;
            }
            else if (messageType === 'audio') {
                // Get the current Conversation Bot question
                const currentConversationBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // OpenAI Speech to Text
                const recognizedText = await azureAIServices.openaiSpeechToText(messageContent.data);
                if (recognizedText) {
                    const message = `Please wait for an answer. \n\nYou said: ${recognizedText}`;
                    await sendMessage(userMobileNumber, message);
                    await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                    // OpenAI Feedback
                    let openaiFeedbackTranscript = await azureAIServices.openaiFeedback(recognizedText);

                    // Extract corrected version of the answer
                    const correctedVersion = openaiFeedbackTranscript.match(/\[CORRECTED\](.*?)\[\/CORRECTED\]/);
                    if (correctedVersion) {
                        openaiFeedbackTranscript = openaiFeedbackTranscript.replace(/\[CORRECTED\](.*?)\[\/CORRECTED\]/, '');
                    }

                    // Azure Text to Speech
                    const openaiFeedbackAudio = await azureAIServices.azureTextToSpeechAndUpload(openaiFeedbackTranscript);

                    // Media message
                    await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                    await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);
                    await sleep(5000);

                    // Send corrected version of the answer
                    if (correctedVersion) {
                        let correctMessage = "A corrected version of your answer is: " + correctedVersion[1];
                        await sendMessage(userMobileNumber, correctMessage);
                        await createActivityLog(userMobileNumber, "text", "outbound", correctMessage, null);
                    }

                    // Save user response to the database
                    const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                    const uniqueID = uuidv4();
                    const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                    const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
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
                        // Update question number
                        await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextConversationBotQuestion.dataValues.questionNumber);

                        // Media message
                        await sendMediaMessage(userMobileNumber, nextConversationBotQuestion.dataValues.mediaFile, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", nextConversationBotQuestion.dataValues.mediaFile, null);
                    } else {
                        // Reset Question Number, Retry Counter, and Activity Type
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                        // Update acceptable messages list for the user
                        await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["try next activity", "apply for course"]);

                        // Sleep
                        await sleep(2000);

                        // Reply Buttons
                        await sendButtonMessage(userMobileNumber, '👏🏽Activity Complete! 🤓', [{ id: 'try_next_activity', title: 'Try Next Activity' }, { id: 'apply_for_course', title: 'Apply for Course' }]);
                        await createActivityLog(userMobileNumber, "template", "outbound", "Try Next Activity or Apply for Course", null);
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
    // Introduction message
    const botIntroMessage = await extractConstantMessage("onboarding_bot_introduction_message");
    await sendMessage(userMobileNumber, botIntroMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", botIntroMessage, null);

    // Introduction Video picked from DB
    const introVideoLink = await extractConstantMessage("intro_video");
    await sendMediaMessage(userMobileNumber, introVideoLink, 'video');
    await createActivityLog(userMobileNumber, "video", "outbound", introVideoLink, null);

    // Sleep
    await sleep(10000);

    // Text Message
    await sendMessage(userMobileNumber, "Here is the Course Outline");
    await createActivityLog(userMobileNumber, "text", "outbound", "Here is the Course Outline", null);

    // Outline Image picked from DB
    const outlineImageLink = await extractConstantMessage("level_one_course_outline");
    await sendMediaMessage(userMobileNumber, outlineImageLink, 'image');
    await createActivityLog(userMobileNumber, "image", "outbound", outlineImageLink, null);

    // Sleep
    await sleep(5000);

    // Apply for Course or Start Free Demo
    await sendButtonMessage(userMobileNumber, 'Apply for the English course now or start a free demo.', [{ id: 'apply_for_english_course', title: 'Apply for Course' }, { id: 'start_free_demo', title: 'Start Free Demo' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", "Apply for Course or Start Free Demo", null);

    // Update acceptable messages list for the user
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["apply for course", "start free demo"]);
    return;
};

const nameInputMessage = async (userMobileNumber) => {
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

const scolarshipOptions = [
    "Iss 3-month course ki fees Rs. 3000 hai. Scholarships available hain lekin scholarship maangtay huay yaad rakhain ke seats mehdud hain, aur aap jitni zyada scholarship managain ge, aap ka seat milnay ka imkaan utna hi kum ho jaaye ga.\n\nMisaal ke taur pay, Sana Rs. 1500 dainay kay liye tayyar hai (woh 50% scholarship maangti hai). Shazia Rs. 2250 dainay kay liye tayyar hai (woh 25% scholarship maangti hai). Shazia ko course mein jaga milnay ke zyada imkaan hain.\n\nAap iss course kay liye kitni fees dainay kay liye tayyar hain?",
    "Iss 3-month course ki fees Rs. 3000 hai. Scholarships available hain lekin scholarship maangtay huay yaad rakhain ke seats mehdud hain, aur aap jitni zyada scholarship managain ge, aap ka seat milnay ka imkaan utna hi kum ho jaaye ga.\n\nMisaal ke taur pay, Sana Rs. 750 dainay kay liye tayyar hai (woh 75% scholarship maangti hai). Shazia 1500 dainay kay liye tayyar hai (woh 50% scholarship maangti hai). Shazia ko course mein jaga milnay ke zyada imkaan hain.\n\nAap iss course kay liye kitni fees dainay kay liye tayyar hain?",
    "Iss 3-month course ki fees Rs. 3000 hai. Scholarships available hain lekin scholarship maangtay huay yaad rakhain ke seats mehdud hain, aur aap jitni zyada scholarship managain ge, aap ka seat milnay ka imkaan utna hi kum ho jaaye ga.\n\nMisaal ke taur pay, Sana Rs. 0 dainay kay liye tayyar hai (woh 100% scholarship maangti hai). Shazia 3000 dainay kay liye tayyar hai (woh 0% scholarship maangti hai). Shazia ko course mein jaga milnay ke zyada imkaan hain.\n\nAap iss course kay liye kitni fees dainay kay liye tayyar hain?"
]

const scholarshipInputMessage = async (userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "Scholarship");
    const random = Math.floor(Math.random() * 3);
    await sendMessage(userMobileNumber, scolarshipOptions[random]);
    await createActivityLog(userMobileNumber, "text", "outbound", scolarshipOptions[random], null);
    let acceptableMessages = [];
    for (let i = 0; i <= 3000; i += 1) {
        acceptableMessages.push(i.toString());
    }
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, acceptableMessages);
    return;
};

const thankYouMessage = async (userMobileNumber) => {
    const message = "Thank you for applying! We will call you by Nov 1st to confirm if you get selected for this batch."
    await sendMessage(userMobileNumber, message);
    await createActivityLog(userMobileNumber, "text", "outbound", message, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start next lesson"]);
    return;
};

const demoCourseStart = async (userMobileNumber, startingLesson) => {
    // Update user progress
    await waUserProgressRepository.update(
        userMobileNumber,
        await courseRepository.getCourseIdByName(
            "Free Trial"
        ),
        startingLesson.dataValues.weekNumber,
        startingLesson.dataValues.dayNumber,
        startingLesson.dataValues.LessonId,
        startingLesson.dataValues.SequenceNumber,
        startingLesson.dataValues.activity,
        null,
        null,
    );
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "Free Demo");

    // Text Message
    await sendMessage(userMobileNumber, "Great! Let's start your free demo! 🤩 Here is your first lesson.");
    await createActivityLog(userMobileNumber, "text", "outbound", "Great! Let's start your free demo! 🤩 Here is your first lesson.", null);
    return;
};

const checkUserMessageAndAcceptableMessages = async (userMobileNumber, currentUserState, currentLesson, messageType, messageContent) => {
    const acceptableMessagesList = currentUserState.dataValues.acceptableMessages;
    const activityType = currentUserState.dataValues.activityType;
    if (activityType === "listenAndSpeak" || activityType === "postListenAndSpeak" || activityType === "preListenAndSpeak" || activityType === "watchAndSpeak" || activityType === "conversationalQuestionsBot" || activityType === "conversationalMonologueBot" || activityType === "read") {
        if (acceptableMessagesList.includes("audio") && messageType === "audio") {
            return true;
        }
    }
    else if (messageType === "text" && acceptableMessagesList.includes("text")) {
        return true;
    }
    else if (acceptableMessagesList.includes(messageContent.toLowerCase())) {
        return true;
    } else {
        // If acceptable message list size is more than 2999 then "0 - 3000 tak koi number type kerain."
        if (acceptableMessagesList.length > 2999) {
            await sendMessage(userMobileNumber, "0 - 3000 tak koi number type kerain.");
            await createActivityLog(userMobileNumber, "text", "outbound", "0 - 3000 tak koi number type kerain.", null);
            return false;
        }
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

const sendWrongMessages = async (userMobileNumber) => {
    let message = "I'm sorry, I didn't understand that. Please try again.\n\nAcceptable messages are:\nI want to learn English with Beaj";
    await sendMessage(userMobileNumber, message);
    await createActivityLog(userMobileNumber, "text", "outbound", message, null);
    return;
};

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
    scholarshipInputMessage,
    demoCourseStart,
    removeUser,
    checkUserMessageAndAcceptableMessages,
    sendWrongMessages
};
