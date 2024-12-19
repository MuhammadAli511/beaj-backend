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
import waPurchasedCoursesRepository from '../repositories/waPurchasedCoursesRepository.js';
import azureBlobStorage from "./azureBlobStorage.js";
import azureAIServices from '../utils/azureAIServices.js';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { createCanvas, registerFont, loadImage } from 'canvas';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import OpenAI from "openai";
import lessonRepository from "../repositories/lessonRepository.js";
import fs from 'fs';

dotenv.config();

const openai = new OpenAI(process.env.OPENAI_API_KEY);

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

const removeUserTillCourse = async (phoneNumber) => {
    await waUserProgressRepository.update(phoneNumber, null, null, null, null, null, null, null, null, ["i want to start my course"]);
    await waUserProgressRepository.updateEngagementType(phoneNumber, "School Input");
    await waUserActivityLogsRepository.deleteByPhoneNumber(phoneNumber);
    await waLessonsCompletedRepository.deleteByPhoneNumber(phoneNumber);
    await waQuestionResponsesRepository.deleteByPhoneNumber(phoneNumber);
    await sendMessage(phoneNumber, "Your data has been removed. Please start again using the link provided.");
};

const weekEndImage = async (score, week) => {
    try {
        // Set up canvas dimensions
        const width = 900;
        const height = 800;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Define colors
        const backgroundColor = '#51bccc';
        const chartColor = '#e6f035';
        const whiteColor = '#FFFFFF';


        // Draw background
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        // Draw title
        ctx.fillStyle = 'white';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Week ${week}`, width / 2, 100);
        ctx.fillStyle = 'black';
        ctx.font = 'bold 50px Arial';
        ctx.fillText('Your End-of-Week Score', width / 2, 170);

        // Draw circular progress chart (donut shape)
        const centerX = width / 2;
        const centerY = height / 2 + 50;
        const outerRadius = 200;
        const innerRadius = 120;
        const scorePercentage = score / 100;

        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
        ctx.fillStyle = whiteColor;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, outerRadius, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * scorePercentage);
        ctx.lineTo(centerX, centerY);
        ctx.fillStyle = chartColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
        ctx.fillStyle = backgroundColor;
        ctx.fill();

        ctx.fillStyle = chartColor;
        ctx.font = 'bold 60px Arial';
        ctx.fillText(`${score}%`, centerX, centerY + 20);

        ctx.font = 'bold 60px Arial';
        let remark = '';
        if (parseInt(score) <= 60) {
            remark = "Good Effort!";
        } else if (parseInt(score) <= 79) {
            remark = "Well done!";
        } else {
            remark = "Excellent";
        }
        ctx.fillText(remark, centerX, centerY + 300);


        // Convert the canvas to a buffer
        const buffer = canvas.toBuffer('image/jpeg');

        // Upload to Azure Blob Storage
        const imageUrl = await azureBlobStorage.uploadImageToBlobStorage(buffer);
        return imageUrl;
    } catch (err) {
        console.error('Error creating and uploading image:', err);
        throw new Error('Failed to create and upload image');
    }
}

const weekEndScoreCalculation = async (phoneNumber, weekNumber, courseId) => {
    // Get lessonIds for mcqs of that week
    const mcqLessonIds = await lessonRepository.getLessonIdsByCourseAndWeekAndActivityType(courseId, weekNumber, 'mcqs');
    const correctMcqs = await waQuestionResponsesRepository.getTotalScoreForList(phoneNumber, mcqLessonIds);
    const totalMcqs = await waQuestionResponsesRepository.getTotalQuestionsForList(phoneNumber, mcqLessonIds);

    // Get lessonIds for listenAndSpeak of that week
    const listenAndSpeakLessonIds = await lessonRepository.getLessonIdsByCourseAndWeekAndActivityType(courseId, weekNumber, 'listenAndSpeak');
    const correctListenAndSpeak = await waQuestionResponsesRepository.getTotalScoreForList(phoneNumber, listenAndSpeakLessonIds);
    const totalListenAndSpeak = await waQuestionResponsesRepository.getTotalQuestionsForList(phoneNumber, listenAndSpeakLessonIds);


    // Get lessonIds for watchAndSpeak of that week
    const watchAndSpeakLessonIds = await lessonRepository.getLessonIdsByCourseAndWeekAndActivityType(courseId, weekNumber, 'watchAndSpeak');
    const correctWatchAndSpeak = await waQuestionResponsesRepository.watchAndSpeakScoreForList(phoneNumber, watchAndSpeakLessonIds);


    // Get lessonIds for read of that week
    const readLessonIds = await lessonRepository.getLessonIdsByCourseAndWeekAndActivityType(courseId, weekNumber, 'read');
    const correctRead = await waQuestionResponsesRepository.readScoreForList(phoneNumber, readLessonIds);


    // Get lessonIds for conversationalMonologueBot of that week
    const monologueLessonIds = await lessonRepository.getLessonIdsByCourseAndWeekAndActivityType(courseId, weekNumber, 'conversationalMonologueBot');
    const correctMonologue = await waQuestionResponsesRepository.monologueScoreForList(phoneNumber, monologueLessonIds);


    // Calculate sum of scores and sum of total scores and give percentage out of 100
    const totalScore = correctMcqs + correctListenAndSpeak + correctWatchAndSpeak.score + correctRead.score + correctMonologue.score;
    const totalQuestions = totalMcqs + totalListenAndSpeak + correctWatchAndSpeak.total + correctRead.total + correctMonologue.total;
    const percentage = Math.round((totalScore / totalQuestions) * 100);
    return percentage;
};

const createAndUploadScoreImage = async (pronunciationAssessment) => {
    try {
        if (pronunciationAssessment === undefined || pronunciationAssessment == [] || pronunciationAssessment == null) {
            return null;
        };

        const fluencyScoreNumber = Math.round(pronunciationAssessment.scoreNumber.fluencyScore);
        const accuracyScoreNumber = Math.round(pronunciationAssessment.scoreNumber.accuracyScore);
        const completenessScoreNumber = Math.round(pronunciationAssessment.scoreNumber.compScore);
        const words = pronunciationAssessment.words;

        // Set up canvas dimensions
        const width = 900;
        const height = 850;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Draw background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Load and add the company logo in the top - right corner
        const image = await loadImage("https://beajbloblive.blob.core.windows.net/beajdocuments/logo.jpeg");  // Path to the logo image
        ctx.drawImage(image, width - 160, 20, image.width / 7.5, image.height / 7.5);

        // Add "YOUR SCORE" Title
        ctx.font = 'bold 40px Arial';
        ctx.fillStyle = '#000000';
        ctx.fillText('YOUR SCORE', 50, 80);

        // Add "Completeness" Bar with dynamic score
        ctx.font = '25px Arial';
        ctx.fillText('Sentence Completion', 50, 120);

        // Draw light magenta background bar for full length
        ctx.fillStyle = '#eecef7';
        ctx.fillRect(50, 125, 790, 40);

        // Draw dark magenta foreground bar for actual score
        ctx.fillStyle = '#cb6ce6';
        ctx.fillRect(50, 125, 790 * (completenessScoreNumber / 100), 40);

        // Add score text inside the bar
        ctx.fillStyle = '#000000';
        // Position till the end of dark magenta bar
        ctx.fillText(`${completenessScoreNumber}%`, 50 + 790 * (completenessScoreNumber / 100) - 70, 155);


        // Add "Pronunciation" Bar with dynamic score
        ctx.font = '25px Arial';
        ctx.fillText('Correct Pronunciation', 50, 215);

        // Draw light blue background bar for full length
        ctx.fillStyle = '#B2EBF2';
        ctx.fillRect(50, 220, 790, 40);

        // Draw dark blue foreground bar for actual score
        ctx.fillStyle = '#30D5C8';
        ctx.fillRect(50, 220, 790 * (accuracyScoreNumber / 100), 40);

        // Add score text inside the bar
        ctx.fillStyle = '#000000';
        // Position till the end of dark blue bar
        ctx.fillText(`${accuracyScoreNumber}%`, 50 + 790 * (accuracyScoreNumber / 100) - 70, 250);


        // Add "Fluency" Bar with dynamic score
        ctx.font = '25px Arial';
        ctx.fillText('Fluency', 50, 310);

        // Draw light yellow background bar for full length
        ctx.fillStyle = '#F0F4C3';
        ctx.fillRect(50, 315, 790, 40);

        // Draw darker yellow foreground bar for actual score
        ctx.fillStyle = '#C7EA46';
        ctx.fillRect(50, 315, 790 * (fluencyScoreNumber / 100), 40);

        // Add score text inside the bar
        ctx.fillStyle = '#000000';
        ctx.fillText(`${fluencyScoreNumber}%`, 50 + 790 * (fluencyScoreNumber / 100) - 70, 345);

        // Add "You said" section
        ctx.font = 'bold 30px Arial';
        ctx.fillText('You said', 50, 410);

        // Create a paragraph format for the text
        ctx.font = '25px Arial';
        const marginLeft = 50;
        const maxWidth = 850;
        let lineHeight = 40;
        let cursorX = marginLeft;
        let cursorY = 450; // Starting Y position for the text

        // Loop through words and handle line breaks
        words.forEach((wordObj) => {
            // If not Mispronunciation, Omission, or None, skip the word
            if (!['Mispronunciation', 'Omission', 'None'].includes(wordObj.PronunciationAssessment.ErrorType)) {
                return;
            }
            const word = wordObj.Word;
            const errorType = wordObj.PronunciationAssessment.ErrorType;
            const wordAccuracyScore = wordObj.PronunciationAssessment.AccuracyScore;
            const wordWidth = ctx.measureText(word).width + 15; // Measure width of the word

            // If the word exceeds the max width, move to a new line
            if (cursorX + wordWidth > maxWidth) {
                cursorX = marginLeft; // Reset X position to the left margin
                cursorY += lineHeight; // Move to the next line
            }

            if (errorType === 'Mispronunciation' || wordAccuracyScore < 50) {
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
        ctx.arc(60, 820, 10, 0, 2 * Math.PI);
        ctx.fill(); // Fill the circle
        ctx.fillStyle = '#000000';
        ctx.fillText('Mispronounced Words', 80, 827);

        // Skipped Words Legend (Grey Circle)
        ctx.fillStyle = '#A9A9A9'; // Grey color
        ctx.beginPath(); // Start a new path
        ctx.arc(350, 820, 10, 0, 2 * Math.PI);
        ctx.fill(); // Fill the circle
        ctx.fillStyle = '#000000';
        ctx.fillText('Skipped Words', 370, 827);

        // Convert the canvas to a buffer
        const buffer = canvas.toBuffer('image/jpeg');

        // Upload to Azure Blob Storage
        const imageUrl = await azureBlobStorage.uploadImageToBlobStorage(buffer);
        return imageUrl;
    } catch (err) {
        console.error('Error creating and uploading image:', err);
        throw new Error('Failed to create and upload image');
    }
}

const createAndUploadSpeakingScoreImage = async (results) => {
    try {
        if (results[0].NBest[0].PronunciationAssessment === undefined || results === null) {
            return null;
        }

        const speakingResult = results[0].NBest[0].PronunciationAssessment;

        const pronounciationScoreNumber = Math.round(speakingResult.PronScore);
        const fluencyScoreNumber = Math.round(speakingResult.FluencyScore);
        const words = results[0].NBest[0].Words;

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
            const word = wordObj.Word;
            const errorType = wordObj.PronunciationAssessment.AccuracyScore < 60 ? true : false;
            const wordWidth = ctx.measureText(word).width + 15; // Measure width of the word

            // If the word exceeds the max width, move to a new line
            if (cursorX + wordWidth > maxWidth) {
                cursorX = marginLeft; // Reset X position to the left margin
                cursorY += lineHeight; // Move to the next line
            }


            if (errorType === true) {
                // Highlight mispronounced words in yellow
                ctx.fillStyle = '#FFD700'; // Yellow
                ctx.fillRect(cursorX - 5, cursorY - 25, wordWidth - 5, 30);
                ctx.fillStyle = '#000000'; // Black text
                ctx.fillText(word, cursorX, cursorY);
            } else if (errorType === false) {
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

        // Convert the canvas to a buffer
        const buffer = canvas.toBuffer('image/jpeg');

        // Upload to Azure Blob Storage
        const imageUrl = await azureBlobStorage.uploadImageToBlobStorage(buffer);
        return imageUrl;
    } catch (err) {
        console.error('Error creating and uploading image:', err);
        throw new Error('Failed to create and upload image');
    }
}

const getAcceptableMessagesList = async (activityType) => {
    if (activityType === "listenAndSpeak" || activityType === "watchAndSpeak" || activityType === "conversationalQuestionsBot" || activityType === "conversationalMonologueBot" || activityType === "conversationalAgencyBot") {
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
        } else if (mediaType == 'sticker') {
            await axios.post(
                `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'sticker',
                    sticker: { link: mediaUrl },
                },
                {
                    headers: {
                        Authorization: `Bearer ${whatsappToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        }
        else {
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

const outlineMessage = async (userMobileNumber) => {
    await waUserProgressRepository.create({
        phoneNumber: userMobileNumber,
        persona: "Teacher",
        engagement_type: "Outline Message",
        lastUpdated: new Date(),
    });
    // Introduction message
    let firstMessage = "Assalam o Alaikum 👋\nWelcome to Beaj Self Development Course for Teachers!";
    await sendMessage(userMobileNumber, firstMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", firstMessage, null);

    let secondMessage = "Meet your instructors👇🏽";
    await sendMessage(userMobileNumber, secondMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", secondMessage, null);

    // Introduction Video picked from DB
    const introVideoLink = await extractConstantMessage("intro_video");
    await sendMediaMessage(userMobileNumber, introVideoLink, 'video');
    await createActivityLog(userMobileNumber, "video", "outbound", introVideoLink, null);

    // Sleep
    await sleep(12000);

    // Text Message
    let outlineMessage = "Here is the course outline: ";
    await sendMessage(userMobileNumber, outlineMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", outlineMessage, null);

    // Outline Image picked from DB
    const outlineImageLink = await extractConstantMessage("level_one_course_outline");
    await sendMediaMessage(userMobileNumber, outlineImageLink, 'image');
    await createActivityLog(userMobileNumber, "image", "outbound", outlineImageLink, null);

    // Sleep
    await sleep(5000);

    // Apply for Course or Start Free Demo
    await sendButtonMessage(userMobileNumber, 'Apply for a scholarship to the course or take a free demo:', [{ id: 'apply_for_scholarship', title: 'Apply Scholarship' }, { id: 'try_free_demo', title: 'Try Free Demo' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", "Apply for a scholarship to the course or take a free demo", null);

    // Update acceptable messages list for the user
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["apply scholarship", "try free demo"]);
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
    let nameMessage = "Your Full Name\n(e.g. Saima Khan)\n\nآپ کا پورا نام\n(مثلن: صایمہ خان)"
    await sendMessage(userMobileNumber, nameMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", nameMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["text"]);
    return;
};

const districtInputMessage = async (userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "District Input");
    let districtMessage = "Your District\n(e.g. Faisalabad, Punjab)\n\nآپ کے ضلع کا نام\n(مثلن: فیصل آباد، پنجاب)"
    await sendMessage(userMobileNumber, districtMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", districtMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["text"]);
    return;
};

const teacherInputMessage = async (userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "Teacher Input");
    let teacherMessage = "Are you a teacher?\n\nکیا آپ ٹیچر ہیں؟";
    await sendButtonMessage(userMobileNumber, teacherMessage, [{ id: "yes_message", title: "Yes/ہاں" }, { id: "no_message", title: "No/نہیں" }]);
    await createActivityLog(userMobileNumber, "template", "outbound", teacherMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["yes/ہاں", "no/نہیں", "yes", "no"]);
    return;
};

const schoolNameInputMessage = async (userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "School Input");
    // let schoolNameMessage = "If Yes, type the name of the school you teach at.\nIf No, type 'NO'.\n\nاگر ہاں, تو اپنے سکول کا نام لکھیں۔\nاگر نہیں، تو لکھیں 'NO'."
    let schoolNameMessage = "If Yes, type the name of the school you teach at.\nاگر ہاں, تو اپنے سکول کا نام لکھیں۔\n\nIf No, type 'NO'.\n.اگر نہیں، تو لکھیں 'NO'."
    await sendMessage(userMobileNumber, schoolNameMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", schoolNameMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["text"]);
    return;
};

const thankYouMessage = async (userMobileNumber) => {
    const message = "Thank You! We will call you soon!\n\nشکریہ! ہماری ٹیم جلد ہی آپ کو کال کرے گی!"
    await sendMessage(userMobileNumber, message);
    await createActivityLog(userMobileNumber, "text", "outbound", message, null);

    // Extract image registration
    const registrationImage = await extractConstantMessage("registration");
    await sendMediaMessage(userMobileNumber, registrationImage, 'image');
    await createActivityLog(userMobileNumber, "image", "outbound", registrationImage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["i want to start my course", "try demo"]);

    await sleep(2000);

    // Send Button Message (Try Demo)
    await sendButtonMessage(userMobileNumber, 'Application Complete! 🤩', [{ id: 'try_demo', title: 'Try Demo' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", "Application Complete! 🤩", null);

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
    if (activityType === "listenAndSpeak" || activityType === "watchAndSpeak" || activityType === "conversationalQuestionsBot" || activityType === "conversationalMonologueBot" || activityType === "conversationalAgencyBot" || activityType === "read") {
        if (acceptableMessagesList.includes("audio") && messageType === "audio") {
            return true;
        }
    }
    else if (messageType === "text" && acceptableMessagesList.includes("text")) {
        return true;
    }
    else if (acceptableMessagesList.includes(messageContent.toLowerCase())) {
        return true;
    }

    // If list has "option a", "option b", "option c" then "option a", "option b", "option c" type kerain.
    if (acceptableMessagesList.includes("option a") && acceptableMessagesList.includes("option b") && acceptableMessagesList.includes("option c")) {
        await sendMessage(userMobileNumber, "option a, option b, ya option c mein se koi aik button press kerain.");
        await createActivityLog(userMobileNumber, "text", "outbound", "option a, option b, ya option c mein se koi aik button press kerain.", null);
        return false;
    }
    // If list has "audio"
    else if (acceptableMessagesList.includes("audio")) {
        await sendMessage(userMobileNumber, "Voice message record karke bhejain.");
        await createActivityLog(userMobileNumber, "text", "outbound", "Voice message record karke bhejain.", null);
        return false;
    }
    // If list has "text"
    else if (acceptableMessagesList.includes("text")) {
        await sendMessage(userMobileNumber, "Text message type kerain.");
        await createActivityLog(userMobileNumber, "text", "outbound", "Text message type kerain.", null);
        return false;
    }
    // Write customized message based on the acceptable messages list
    let message = "Please write: \n\n";
    if (acceptableMessagesList.length > 1) {
        for (let i = 0; i < acceptableMessagesList.length; i++) {
            message += "\n" + acceptableMessagesList[i];
        }
    } else {
        message += acceptableMessagesList[0];
    }
    await sendMessage(userMobileNumber, message);
    await createActivityLog(userMobileNumber, "text", "outbound", message, null);
    return false;
};

const sendWrongMessages = async (userMobileNumber) => {
    let message = "Please write: \n\nStart";
    await sendMessage(userMobileNumber, message);
    await createActivityLog(userMobileNumber, "text", "outbound", message, null);
    return;
};

const getNextCourse = async (userMobileNumber) => {
    const purchaseCourses = await waPurchasedCoursesRepository.getPurchasedCoursesByPhoneNumber(userMobileNumber);
    const courses = await courseRepository.getAll();
    const startedCourses = await waLessonsCompletedRepository.getUniqueStartedCoursesByPhoneNumber(userMobileNumber);
    const notCompletedPurchasedCourse = purchaseCourses.filter(course => !startedCourses.includes(course.dataValues.courseId));
    if (notCompletedPurchasedCourse.length > 0) {
        // Add sequence number to the courses
        for (let i = 0; i < notCompletedPurchasedCourse.length; i++) {
            for (let j = 0; j < courses.length; j++) {
                if (notCompletedPurchasedCourse[i].dataValues.courseId === courses[j].dataValues.CourseId) {
                    notCompletedPurchasedCourse[i].dataValues.sequenceNumber = courses[j].dataValues.SequenceNumber;
                    notCompletedPurchasedCourse[i].dataValues.courseStartDate = courses[j].dataValues.courseStartDate;
                    notCompletedPurchasedCourse[i].dataValues.courseName = courses[j].dataValues.CourseName;
                    break;
                }
            }
        }
        const sortedNotCompletedPurchasedCourse = purchaseCourses.sort((a, b) => a.dataValues.sequenceNumber - b.dataValues.sequenceNumber);
        const nextCourse = sortedNotCompletedPurchasedCourse[0];
        return nextCourse;
    }
    return null;

};

const startCourseForUser = async (userMobileNumber) => {
    const nextCourse = await getNextCourse(userMobileNumber);
    if (!nextCourse) {
        await sendMessage(userMobileNumber, "No available purchased courses. Kindly contact beaj support.");
        await createActivityLog(userMobileNumber, "text", "outbound", "No available purchased courses. Kindly contact beaj support.", null);
        return;
    }
    // Get today's date
    const today = new Date();
    const courseStartDate = new Date(nextCourse.dataValues.courseStartDate);

    // Extract only the year, month, and day to ensure accurate local date comparison
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();

    const courseStartYear = courseStartDate.getFullYear();
    const courseStartMonth = courseStartDate.getMonth();
    const courseStartDateOnly = courseStartDate.getDate();

    console.log(todayYear, todayMonth, todayDate);
    console.log(courseStartYear, courseStartMonth, courseStartDateOnly);
    // Check if today < course start date
    if (todayYear < courseStartYear || (todayYear === courseStartYear && todayMonth < courseStartMonth) || (todayYear === courseStartYear && todayMonth === courseStartMonth && todayDate < courseStartDateOnly)) {
        const formattedStartDate = format(new Date(nextCourse.dataValues.courseStartDate), 'MMMM do, yyyy');
        const message = "Your course will start on " + formattedStartDate + ". Please wait for the course to start.";
        await sendMessage(userMobileNumber, message);
        await createActivityLog(userMobileNumber, "text", "outbound", message, null);
        return;
    }
    // Update engagment type
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "Course Start");

    // Update user progress
    await waUserProgressRepository.update(
        userMobileNumber,
        nextCourse.dataValues.courseId,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
    );


    // Send course_bot_introduction_message
    const courseBotIntroductionMessage = await extractConstantMessage("course_bot_introduction_message");
    await sendMessage(userMobileNumber, courseBotIntroductionMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", courseBotIntroductionMessage, null);

    // Send demo_video
    const demoVideoLink = await extractConstantMessage("demo_video");
    await sendMediaMessage(userMobileNumber, demoVideoLink, 'video');
    await createActivityLog(userMobileNumber, "video", "outbound", demoVideoLink, null);
    await sleep(12000);

    // Extract Level from courseName
    const courseName = nextCourse.dataValues.courseName.split("-");
    const level = courseName[0].trim();

    // Send Button Message
    // "Are you ready to start level"
    await sendButtonMessage(userMobileNumber, "Are you ready to start " + level + "?", [{ id: "lets_start", title: "Let's Start!" }]);
    await createActivityLog(userMobileNumber, "template", "outbound", "Are you ready to start " + level + "?", null);

    // Update acceptable messages list for the user
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["lets start!", "let's start!"]);
    return;
};

const levelCourseStart = async (userMobileNumber, startingLesson, courseId) => {
    // Update user progress
    await waUserProgressRepository.update(
        userMobileNumber,
        courseId,
        startingLesson.dataValues.weekNumber,
        startingLesson.dataValues.dayNumber,
        startingLesson.dataValues.LessonId,
        startingLesson.dataValues.SequenceNumber,
        startingLesson.dataValues.activity,
        null,
        null,
    );

    // Extract Level from courseName using courseId
    const courseName = await courseRepository.getCourseNameById(courseId);
    const level = courseName.split("-")[0].trim();


    // Text Message
    await sendMessage(userMobileNumber, "Great! Let's start " + level + "! 🤩 Here is your first lesson.");
    await createActivityLog(userMobileNumber, "text", "outbound", "Great! Let's start " + level + "! 🤩 Here is your first lesson.", null);
    return;
};

const getDayEndingMessage = (dayNumber) => {
    if (dayNumber == 1) {
        return "Now go to your class-group to *practise vocabulary with your teacher and group!* See you tomorrow!👋🏽";
    } else if (dayNumber == 2 || dayNumber == 3) {
        return "Now go to your class-group to *learn 'Teaching Expressions' with your teacher and group!* See you tomorrow!👋🏽";
    } else if (dayNumber == 4) {
        return "See you tomorrow!👋🏽";
    } else if (dayNumber == 5) {
        return "Now go to your class-group to *reflect with your teacher and group!* See you tomorrow!👋🏽";
    }
};

const endingMessage = async (userMobileNumber, currentUserState, startingLesson) => {
    // If activity is video return
    if (startingLesson.dataValues.activity === 'video') {
        return;
    }

    await waLessonsCompletedRepository.endLessonByPhoneNumberAndLessonId(userMobileNumber, startingLesson.dataValues.LessonId);

    // Activity Complete Sticker
    const activityCompleteSticker = await extractConstantMessage("activity_complete_sticker");
    await sendMediaMessage(userMobileNumber, activityCompleteSticker, 'sticker');
    await createActivityLog(userMobileNumber, "sticker", "outbound", activityCompleteSticker, null);

    await sleep(3000);

    // Check if the lesson is the last lesson of the day
    const lessonLast = await lessonRepository.isLastLessonOfDay(startingLesson.dataValues.LessonId);


    if (currentUserState.dataValues.engagement_type == "Free Demo") {
        let user = await waUsersMetadataRepository.getByPhoneNumber(userMobileNumber);
        let checkRegistrationComplete = user.dataValues.userRegistrationComplete !== null;
        if (checkRegistrationComplete == false && lessonLast == true) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["try demo again", "apply scholarship"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            await sendButtonMessage(userMobileNumber, '👏🏽Demo Complete! 🤓', [{ id: 'try_demo_again', title: 'Try Demo Again' }, { id: 'apply_for_course', title: 'Apply Scholarship' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Try Demo Again or Apply Scholarship", null);

            return;
        } else if (checkRegistrationComplete == true && lessonLast == true) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["try demo again", "i want to start my course"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            await sendButtonMessage(userMobileNumber, '👏🏽Demo Complete! 🤓', [{ id: 'try_demo_again', title: 'Try Demo Again' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Try Demo Again", null);

            return;
        } else if (checkRegistrationComplete == false && lessonLast == false) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["try next activity", "apply scholarship"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            await sendButtonMessage(userMobileNumber, '👏🏽Activity Complete! 🤓', [{ id: 'try_next_activity', title: 'Try Next Activity' }, { id: 'apply_for_course', title: 'Apply Scholarship' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Try Next Activity or Apply Scholarship", null);

            return;
        } else if (checkRegistrationComplete == true && lessonLast == false) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["try next activity", "i want to start my course"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            await sendButtonMessage(userMobileNumber, '👏🏽Activity Complete! 🤓', [{ id: 'try_next_activity', title: 'Try Next Activity' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Try Next Activity", null);

            return;
        }
    }

    // FOR ALL ACTIVITIES
    if (lessonLast) {
        const courseName = await courseRepository.getCourseNameById(currentUserState.currentCourseId);
        const strippedCourseName = courseName.split("-")[0].trim();
        // Lesson Number
        const lessonNumber = (startingLesson.dataValues.weekNumber - 1) * 6 + startingLesson.dataValues.dayNumber;

        // Lesson Complete Message
        const lessonCompleteMessage = "You have completed *" + lessonNumber + " out of 24* lessons in " + strippedCourseName + "!⭐️";
        await sendMessage(userMobileNumber, lessonCompleteMessage);
        await createActivityLog(userMobileNumber, "text", "outbound", lessonCompleteMessage, null);

        // Lesson Complete Image
        // Gold Bars
        const smallCourseName = strippedCourseName.replace(/\s/g, '').toLowerCase();
        const imageTag = "lesson_complete_image_lesson_" + lessonNumber.toString() + "_" + smallCourseName;
        const lessonCompleteImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/" + imageTag + ".jpeg";
        await sendMediaMessage(userMobileNumber, lessonCompleteImage, 'image');
        await createActivityLog(userMobileNumber, "image", "outbound", lessonCompleteImage, null);
        // Sleep
        await sleep(5000);

        // Week end score image
        if (startingLesson.dataValues.dayNumber == 6) {
            const weekEndScore = await weekEndScoreCalculation(userMobileNumber, startingLesson.dataValues.weekNumber, currentUserState.currentCourseId);
            const weekEndScoreImage = await weekEndImage(weekEndScore, startingLesson.dataValues.weekNumber);
            await sendMediaMessage(userMobileNumber, weekEndScoreImage, 'image');
            await createActivityLog(userMobileNumber, "image", "outbound", weekEndScoreImage, null);
            await sleep(5000);

            let weekMessage = "You have unlocked this week's challenge 🧩\nGo to your class-group to solve it. All the best! 👍🏽";
            await sendMessage(userMobileNumber, weekMessage);
            await createActivityLog(userMobileNumber, "text", "outbound", weekMessage, null);
        }

        // Day Ending Message
        if (startingLesson.dataValues.dayNumber == 1 || startingLesson.dataValues.dayNumber == 2 || startingLesson.dataValues.dayNumber == 3 || startingLesson.dataValues.dayNumber == 4 || startingLesson.dataValues.dayNumber == 5) {
            const dayEndingMessage = getDayEndingMessage(startingLesson.dataValues.dayNumber);
            await sendMessage(userMobileNumber, dayEndingMessage);
            await createActivityLog(userMobileNumber, "text", "outbound", dayEndingMessage, null);
        }

        // Update acceptable messages list for the user
        await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start next lesson"]);

        // Sleep
        await sleep(2000);

        await sendButtonMessage(userMobileNumber, 'Are you ready to start your next lesson?', [{ id: 'start_next_lesson', title: 'Start Next Lesson' }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Lesson", null);
    } else {
        // Update acceptable messages list for the user
        await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start next activity"]);

        // Sleep
        await sleep(2000);


        // Reply Buttons
        await sendButtonMessage(userMobileNumber, 'Are you ready to start the next activity?', [{ id: 'start_next_activity', title: 'Start Next Activity' }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Activity", null);
    }
};

const sendCourseLessonToUser = async (userMobileNumber, currentUserState, startingLesson, messageType, messageContent) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (activity === 'video') {
            // Lesson Started Record
            await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date());

            // Send lesson message
            let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
            lessonMessage += "\n\n" + removeHTMLTags(startingLesson.dataValues.text);

            // Text message
            await sendMessage(userMobileNumber, lessonMessage);
            await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

            // Send video content
            const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
            let videoURL = documentFile[0].dataValues.video;

            // Media message
            await sendMediaMessage(userMobileNumber, videoURL, 'video');
            await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null);

            // Sleep
            await sleep(12000);
        }
        else if (activity === 'videoEnd') {
            // Lesson Started Record
            await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date());

            // Send lesson message
            let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
            lessonMessage += "\n\n" + removeHTMLTags(startingLesson.dataValues.text);

            // Text message
            await sendMessage(userMobileNumber, lessonMessage);
            await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

            // Send video content
            const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
            let videoURL = documentFile[0].dataValues.video;

            // Media message
            await sendMediaMessage(userMobileNumber, videoURL, 'video');
            await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null);

            // Sleep
            await sleep(12000);

            // Reset Question Number, Retry Counter, and Activity Type
            await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

            // Ending Message
            await endingMessage(userMobileNumber, currentUserState, startingLesson);
        }
        else if (activity == 'mcqs') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Activity Alias
                const activityAlias = startingLesson.dataValues.activityAlias;
                let lessonText = startingLesson.dataValues.text;
                lessonText = removeHTMLTags(lessonText);
                if (activityAlias == "*End of Week Challenge!* 💪🏽") {
                    // Send lesson message
                    let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                    lessonMessage += "\n\n" + "Answer the following questions.";
                    // Text message
                    await sendMessage(userMobileNumber, lessonMessage);
                    await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                    await sendMessage(userMobileNumber, "Let's Start Questions👇🏽");
                    await createActivityLog(userMobileNumber, "text", "outbound", "Let's Start Questions👇🏽", null);
                } else if (activityAlias == "*Reading Comprehension* 📖") {
                    let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                    lessonMessage += "\n\n" + "Answer the following questions about the reading passage.";
                    // Text message
                    await sendMessage(userMobileNumber, lessonMessage);
                    await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                    await sendMessage(userMobileNumber, "Let's Start Questions👇🏽");
                    await createActivityLog(userMobileNumber, "text", "outbound", "Let's Start Questions👇🏽", null);
                }

                // Lesson Text
                if (lessonText.includes("After listening to the dialogue")) {
                    await sendMessage(userMobileNumber, lessonText);
                    await createActivityLog(userMobileNumber, "text", "outbound", lessonText, null);
                }

                // Send first MCQs question
                const firstMCQsQuestion = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstMCQsQuestion.dataValues.QuestionNumber);

                // Send question
                const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(firstMCQsQuestion.dataValues.Id);
                let mcqMessage = firstMCQsQuestion.dataValues.QuestionText + "\n";
                if (firstMCQsQuestion.dataValues.QuestionText != "Choose the correct sentence.") {
                    mcqMessage += "Choose the correct answer.\n";
                }
                for (let i = 0; i < mcqAnswers.length; i++) {
                    mcqMessage += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                }


                // Reply buttons to answer
                await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `option_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })));
                await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["option a", "option b", "option c"]);
            }
            else {
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
                const submissionDate = new Date();
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
                    await sendMessage(userMobileNumber, "✅ Great!");
                    await createActivityLog(userMobileNumber, "text", "outbound", "✅ Great!", null);
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
                    let mcqMessage = nextMCQsQuestion.dataValues.QuestionText + "\n";
                    if (nextMCQsQuestion.dataValues.QuestionText != "Choose the correct sentence.") {
                        mcqMessage += "Choose the correct answer.\n";
                    }
                    for (let i = 0; i < mcqAnswers.length; i++) {
                        mcqMessage += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                    }

                    // Reply buttons to answer
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `option_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })));
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);

                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["option a", "option b", "option c"]);
                } else {
                    // Calculate total score and send message
                    const totalScore = await waQuestionResponsesRepository.getTotalScore(userMobileNumber, currentUserState.dataValues.currentLessonId);
                    const totalQuestions = await waQuestionResponsesRepository.getTotalQuestions(userMobileNumber, currentUserState.dataValues.currentLessonId);
                    const scorePercentage = (totalScore / totalQuestions) * 100;
                    let message = "*Your score: " + totalScore + "/" + totalQuestions + ".*";
                    if (scorePercentage >= 0 && scorePercentage <= 60) {
                        // message += "\nGood Effort! 👍🏽";
                        // Text message
                        await sendMessage(userMobileNumber, message);
                        await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                        // Sticker
                        const stickerURL = await extractConstantMessage("good_effort_sticker");
                        await sendMediaMessage(userMobileNumber, stickerURL, 'sticker');
                        await createActivityLog(userMobileNumber, "sticker", "outbound", stickerURL, null);
                        await sleep(3000);

                    } else if (scorePercentage >= 61 && scorePercentage <= 79) {
                        // message += "\nWell done! 🌟";
                        // Text message
                        await sendMessage(userMobileNumber, message);
                        await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                        // Sticker
                        const stickerURL = await extractConstantMessage("well_done_sticker");
                        await sendMediaMessage(userMobileNumber, stickerURL, 'sticker');
                        await createActivityLog(userMobileNumber, "sticker", "outbound", stickerURL, null);
                        await sleep(3000);
                    } else if (scorePercentage >= 80) {
                        // message += "\nExcellent 🎉";
                        // Text message
                        await sendMessage(userMobileNumber, message);
                        await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                        // Sticker
                        const stickerURL = await extractConstantMessage("excellent_sticker");
                        await sendMediaMessage(userMobileNumber, stickerURL, 'sticker');
                        await createActivityLog(userMobileNumber, "sticker", "outbound", stickerURL, null);
                        await sleep(3000);
                    }


                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                    // ENDING MESSAGE
                    await endingMessage(userMobileNumber, currentUserState, startingLesson);
                }
            }
        }
        else if (activity == 'watchAndSpeak') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\n\nWatch the videos. Then practice speaking by sending voice messages. 💬";
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Watch and Speak question
                const firstWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFile, 'video');
                await createActivityLog(userMobileNumber, "video", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFile, null);
                await sleep(12000);

                // Send question text
                const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);
                let message = "Question " + firstWatchAndSpeakQuestion.dataValues.questionNumber + " of " + totalQuestions + ":\n\nPuri video dekhein👆🏽. Phir video ke akhri jumley ko ek voice message mein bol kar bhejhein.💬"
                await sendMessage(userMobileNumber, message);
                await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
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

                if (imageUrl) {
                    // Media message
                    await sendMediaMessage(userMobileNumber, imageUrl, 'image');
                    await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null);
                    await sleep(5000);
                }

                // Save user response to the database
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                const submissionDate = new Date();
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
                    await sleep(12000);

                    // Send question text
                    const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);
                    let message = "Question " + nextWatchAndSpeakQuestion.dataValues.questionNumber + " of " + totalQuestions + ":\n\nPuri video dekhein👆🏽. Phir video ke akhri jumley ko ek voice message mein bol kar bhejhein.💬"

                    // Text message
                    await sendMessage(userMobileNumber, message);
                    await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                } else {
                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                    // ENDING MESSAGE
                    await endingMessage(userMobileNumber, currentUserState, startingLesson);
                }
            }
        }
        else if (activity == 'listenAndSpeak') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Lesson Text
                let lessonText = startingLesson.dataValues.text;
                lessonText = removeHTMLTags(lessonText);
                if (lessonText == "Let’s Start Questions👇🏽") {
                    await sendMessage(userMobileNumber, lessonText);
                    await createActivityLog(userMobileNumber, "text", "outbound", lessonText, null);
                }

                // Send lesson message
                let lessonMessage = "Listen to the audio question and send your answer as a voice message.💬";

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
                const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);
                const questionText = firstListenAndSpeakQuestion.dataValues.question.replace(/\\n/g, '\n');
                let message = "Question " + firstListenAndSpeakQuestion.dataValues.questionNumber + " of " + totalQuestions + ":\n\n" + questionText;
                await sendMessage(userMobileNumber, message);
                await createActivityLog(userMobileNumber, "text", "outbound", message, null);

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
                    const recognizedTextWithoutPunctuation = recognizedText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()'"‘’“”?]/g, "").toLowerCase();
                    for (let i = 0; i < answersArray.length; i++) {
                        const answerWithoutPunctuation = answersArray[i].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()'"‘’“”?]/g, "").toLowerCase();
                        if (recognizedTextWithoutPunctuation == answerWithoutPunctuation) {
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
                    const submissionDate = new Date();
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
                        // await sendMediaMessage(userMobileNumber, nextListenAndSpeakQuestion.dataValues.mediaFile, 'audio');
                        // await createActivityLog(userMobileNumber, "audio", "outbound", nextListenAndSpeakQuestion.dataValues.mediaFile, null);

                        // Update acceptable messages list for the user
                        await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                        // await sleep(5000);

                        // Text message
                        const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);
                        const questionText = nextListenAndSpeakQuestion.dataValues.question.replace(/\\n/g, '\n');
                        let message = "Question " + nextListenAndSpeakQuestion.dataValues.questionNumber + " of " + totalQuestions + ":\n\n" + questionText;
                        await sendMessage(userMobileNumber, message);
                        await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                    } else {
                        // Calculate total score and send message
                        const totalScore = await waQuestionResponsesRepository.getTotalScore(userMobileNumber, currentUserState.dataValues.currentLessonId);
                        const totalQuestions = await waQuestionResponsesRepository.getTotalQuestions(userMobileNumber, currentUserState.dataValues.currentLessonId);
                        const scorePercentage = (totalScore / totalQuestions) * 100;
                        let message = "*Your score: " + totalScore + "/" + totalQuestions + ".*";
                        if (scorePercentage >= 0 && scorePercentage <= 60) {
                            // message += "\nGood Effort! 👍🏽";
                            // Text message
                            await sendMessage(userMobileNumber, message);
                            await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                            // Sticker
                            const stickerURL = await extractConstantMessage("good_effort_sticker");
                            await sendMediaMessage(userMobileNumber, stickerURL, 'sticker');
                            await createActivityLog(userMobileNumber, "sticker", "outbound", stickerURL, null);
                            await sleep(3000);
                        } else if (scorePercentage >= 61 && scorePercentage <= 79) {
                            // message += "\nWell done! 🌟";
                            // Text message
                            await sendMessage(userMobileNumber, message);
                            await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                            // Sticker
                            const stickerURL = await extractConstantMessage("well_done_sticker");
                            await sendMediaMessage(userMobileNumber, stickerURL, 'sticker');
                            await createActivityLog(userMobileNumber, "sticker", "outbound", stickerURL, null);
                            await sleep(3000);
                        } else if (scorePercentage >= 80) {
                            // message += "\nExcellent 🎉";
                            // Text message
                            await sendMessage(userMobileNumber, message);
                            await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                            // Sticker
                            const stickerURL = await extractConstantMessage("excellent_sticker");
                            await sendMediaMessage(userMobileNumber, stickerURL, 'sticker');
                            await createActivityLog(userMobileNumber, "sticker", "outbound", stickerURL, null);
                            await sleep(3000);
                        }

                        // Reset Question Number, Retry Counter, and Activity Type
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                        // ENDING MESSAGE
                        await endingMessage(userMobileNumber, currentUserState, startingLesson);
                    }
                } else {
                    // TODO: Handle if no speech recognized
                    console.log("No speech recognized or an error occurred.");
                }
            }
        }
        else if (activity == 'read') {
            if (messageType != 'audio') {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\n\nListen to the passage carefully.";
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
                await sleep(12000);

                // Remove html tags from the text
                const lessonText = startingLesson.dataValues.text;
                const cleanedLessonText = removeHTMLTags(lessonText);

                // Text message
                await sendMessage(userMobileNumber, "Send us a voice message of you reading this passage:\n\n" + cleanedLessonText);
                await createActivityLog(userMobileNumber, "text", "outbound", "Send us a voice message of you reading this passage:\n\n" + cleanedLessonText, null);
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

                if (imageUrl) {
                    // Media message
                    await sendMediaMessage(userMobileNumber, imageUrl, 'image');
                    await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null);
                    await sleep(5000);
                }

                // Save user response to the database
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                const submissionDate = new Date();
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

                // Reset Question Number, Retry Counter, and Activity Type
                await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                // Ending Message
                await endingMessage(userMobileNumber, currentUserState, startingLesson);
            }
        }
        else if (activity == 'conversationalQuestionsBot') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\n\nListen to the audio and send your answer as a voice message.";

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
                    const submissionDate = new Date();
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

                        // ENDING MESSAGE
                        await endingMessage(userMobileNumber, currentUserState, startingLesson);
                    }
                }
            }
        }
        else if (activity == 'conversationalMonologueBot') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\nWatch the video and practice speaking by sending a voice message.💬";
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Conversational Monologue Bot question
                const firstConversationalMonologueBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstConversationalMonologueBotQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstConversationalMonologueBotQuestion.dataValues.mediaFile, 'video');
                await createActivityLog(userMobileNumber, "video", "outbound", firstConversationalMonologueBotQuestion.dataValues.mediaFile, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
            } else if (messageType === 'audio') {
                // Get the current Conversational Monologue Bot question
                const currentConversationalMonologueBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await azureAIServices.azurePronunciationSpeakingAssessment(messageContent.data);

                // Extract user transcription
                const userTranscription = pronunciationAssessment[0].DisplayText;

                // Text message
                await sendMessage(userMobileNumber, "You said: " + userTranscription);
                await createActivityLog(userMobileNumber, "text", "outbound", "You said: " + userTranscription, null);

                // Generate pronunciation assessment message
                const imageUrl = await createAndUploadSpeakingScoreImage(pronunciationAssessment);

                // Media message
                if (imageUrl) {
                    await sendMediaMessage(userMobileNumber, imageUrl, 'image');
                    await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null);
                    await sleep(5000);
                }

                // Save user response to the database
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                const submissionDate = new Date();
                await waQuestionResponsesRepository.create(
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentConversationalMonologueBotQuestion.dataValues.id,
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

                const nextConversationalMonologueBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                if (nextConversationalMonologueBotQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextConversationalMonologueBotQuestion.dataValues.questionNumber);

                    // Send question media file
                    await sendMediaMessage(userMobileNumber, nextConversationalMonologueBotQuestion.dataValues.mediaFile, 'video');
                    await createActivityLog(userMobileNumber, "video", "outbound", nextConversationalMonologueBotQuestion.dataValues.mediaFile, null);
                } else {
                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                    // ENDING MESSAGE
                    await endingMessage(userMobileNumber, currentUserState, startingLesson);
                }
            }
        }
        else if (activity == 'conversationalAgencyBot') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\n\nListen to the audio and send your answer as a voice message.";
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Conversational Agency Bot question
                const firstConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Extract text between <question></question> tags from firstConversationalAgencyBotQuestion.question
                const questionText = firstConversationalAgencyBotQuestion.dataValues.question.match(/<question>(.*?)<\/question>/s)[1].trim();
                const questionAudio = await azureAIServices.azureTextToSpeechAndUpload(questionText);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstConversationalAgencyBotQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, questionAudio, 'audio');
                await createActivityLog(userMobileNumber, "audio", "outbound", questionAudio, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
            }
            else if (messageType === 'audio') {
                // Get the current Conversational Agency Bot question
                const currentConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                const recognizedText = await azureAIServices.openaiSpeechToTextAnyLanguage(messageContent.data);
                if (recognizedText) {
                    console.log("Recognized Text: ", recognizedText);
                    if (currentUserState.dataValues.questionNumber == 1) {
                        const chatThread = await openai.beta.threads.create();
                        await waUserProgressRepository.updateOpenaiThreadId(userMobileNumber, null);
                        await waUserProgressRepository.updateOpenaiThreadId(userMobileNumber, chatThread.id);
                        let firstPrompt = currentConversationalAgencyBotQuestion.dataValues.question;
                        firstPrompt += "\n\n\nMy response: " + recognizedText;

                        await openai.beta.threads.messages.create(
                            chatThread.id,
                            {
                                role: "user", content: firstPrompt
                            }
                        );

                        await openai.beta.threads.runs.create(
                            chatThread.id,
                            { assistant_id: "asst_6zTBy1Esn6WuM9pLujyfT3y8" }
                        );

                        let threadMessages1 = await openai.beta.threads.messages.list(chatThread.id);
                        let attempts = 0;
                        while ((!threadMessages1.data[0].content[0] || threadMessages1.data[0].content[0].text.value == firstPrompt) && attempts < 10) {
                            console.log("Thinking...");
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            threadMessages1 = await openai.beta.threads.messages.list(chatThread.id);
                            attempts++;
                            if (attempts >= 10) {
                                await sendMessage(userMobileNumber, "Please try again.");
                                await createActivityLog(userMobileNumber, "text", "outbound", "Please try again.", null);
                                return;
                            }
                        }

                        // console.log(threadMessages1.data[0].content[0].text.value);
                        const audioLink = await azureAIServices.azureTextToSpeechAndUpload(threadMessages1.data[0].content[0].text.value);
                        await sendMediaMessage(userMobileNumber, audioLink, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", audioLink, null);

                        // Save to question responses
                        const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                        const uniqueID = uuidv4();
                        const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                        const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                        const submissionDate = new Date();
                        await waQuestionResponsesRepository.create(
                            userMobileNumber,
                            currentUserState.dataValues.currentLessonId,
                            currentConversationalAgencyBotQuestion.dataValues.id,
                            activity,
                            startingLesson.dataValues.activityAlias,
                            [recognizedText],
                            [userAudioFileUrl],
                            [threadMessages1.data[0].content[0].text.value],
                            [audioLink],
                            null,
                            null,
                            1,
                            submissionDate
                        );

                        // Update question number
                        await waUserProgressRepository.updateQuestionNumber(userMobileNumber, 2);

                        // Update acceptable messages list for the user
                        await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                        return;
                    }
                    else if (currentUserState.dataValues.questionNumber == 2) {
                        let chatThread = await waUserProgressRepository.getOpenaiThreadId(userMobileNumber);
                        chatThread = chatThread.dataValues.openaiThreadId;
                        let secondPrompt = currentConversationalAgencyBotQuestion.dataValues.question;
                        secondPrompt += "\n\n\nMy response: " + recognizedText;

                        await openai.beta.threads.messages.create(
                            chatThread,
                            {
                                role: "user", content: secondPrompt
                            }
                        );

                        await openai.beta.threads.runs.create(
                            chatThread,
                            { assistant_id: "asst_6zTBy1Esn6WuM9pLujyfT3y8" }
                        );

                        let threadMessages1 = await openai.beta.threads.messages.list(chatThread);
                        let attempts = 0;
                        while ((!threadMessages1.data[0].content[0] || threadMessages1.data[0].content[0].text.value == secondPrompt) && attempts < 10) {
                            console.log("Thinking...");
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            threadMessages1 = await openai.beta.threads.messages.list(chatThread);
                            attempts++;
                            if (attempts >= 10) {
                                await sendMessage(userMobileNumber, "Please try again.");
                                await createActivityLog(userMobileNumber, "text", "outbound", "Please try again.", null);
                                return;
                            }
                        }

                        const audioLink = await azureAIServices.azureTextToSpeechAndUpload(threadMessages1.data[0].content[0].text.value);
                        await sendMediaMessage(userMobileNumber, audioLink, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", audioLink, null);

                        // Save to question responses
                        const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                        const uniqueID = uuidv4();
                        const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                        const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                        const submissionDate = new Date();
                        await waQuestionResponsesRepository.create(
                            userMobileNumber,
                            currentUserState.dataValues.currentLessonId,
                            currentConversationalAgencyBotQuestion.dataValues.id,
                            activity,
                            startingLesson.dataValues.activityAlias,
                            [recognizedText],
                            [userAudioFileUrl],
                            [threadMessages1.data[0].content[0].text.value],
                            [audioLink],
                            null,
                            null,
                            1,
                            submissionDate
                        );

                        // Reset Question Number, Retry Counter, and Activity Type
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                        // ENDING MESSAGE
                        await endingMessage(userMobileNumber, currentUserState, startingLesson);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error sending lesson to user:', error);
        error.fileName = 'chatBotService.js';
        throw error;
    }
};

export {
    sendMessage,
    retrieveMediaURL,
    outlineMessage,
    createActivityLog,
    extractConstantMessage,
    getAcceptableMessagesList,
    nameInputMessage,
    districtInputMessage,
    thankYouMessage,
    demoCourseStart,
    removeUser,
    checkUserMessageAndAcceptableMessages,
    sendWrongMessages,
    getNextCourse,
    startCourseForUser,
    levelCourseStart,
    sendCourseLessonToUser,
    removeUserTillCourse,
    weekEndScoreCalculation,
    teacherInputMessage,
    schoolNameInputMessage,
};
