import axios from "axios";
import dotenv from "dotenv";
import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waUserActivityLogsRepository from "../repositories/waUserActivityLogsRepository.js";
import waFeedbackRepository from "../repositories/waFeedbackRepository.js";
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
import AIServices from '../utils/AIServices.js';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { createCanvas, registerFont, loadImage } from 'canvas';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import OpenAI from "openai";
import { question_bot_prompt, wrapup_prompt } from "../utils/prompts.js";
import lessonRepository from "../repositories/lessonRepository.js";

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

async function getAudioBufferFromAudioFileUrl(audioUrl) {
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
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
    await waUserProgressRepository.update(phoneNumber, null, null, null, null, null, null, null, null, ["start my course"]);
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
        console.log('Error creating and uploading image:', err);
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

    // Get lessonIds for speakingPractice of that week
    const speakingPracticeLessonIds = await lessonRepository.getLessonIdsByCourseAndWeekAndActivityType(courseId, weekNumber, 'speakingPractice');
    const correctSpeakingPractice = await waQuestionResponsesRepository.monologueScoreForList(phoneNumber, speakingPracticeLessonIds);

    // Calculate sum of scores and sum of total scores and give percentage out of 100
    const totalScore = correctMcqs + correctListenAndSpeak + correctWatchAndSpeak.score + correctRead.score + correctMonologue.score + correctSpeakingPractice.score;
    const totalQuestions = totalMcqs + totalListenAndSpeak + correctWatchAndSpeak.total + correctRead.total + correctMonologue.total + correctSpeakingPractice.total;
    const percentage = Math.round((totalScore / totalQuestions) * 100);
    return percentage;
};

const createAndUploadScoreImage = async (pronunciationAssessment) => {
    try {
        if (pronunciationAssessment === undefined || pronunciationAssessment == [] || pronunciationAssessment == null) {
            return null;
        };

        const fluencyScoreNumber = Math.round(pronunciationAssessment.scoreNumber.fluencyScore);
        let accuracyScoreNumber = Math.round(pronunciationAssessment.scoreNumber.accuracyScore);
        const completenessScoreNumber = Math.round(pronunciationAssessment.scoreNumber.compScore);
        const words = pronunciationAssessment.words;

        const mispronouncedWordsList = pronunciationAssessment.words.filter(word => word.PronunciationAssessment.ErrorType == "Mispronunciation" || word.PronunciationAssessment.AccuracyScore < 70);
        if (mispronouncedWordsList.length == 0) {
            accuracyScoreNumber = 100;
        }

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

        ctx.font = 'bold 30px Arial';
        ctx.fillText('You said:', 50, 410);

        // Create a paragraph format for the text
        ctx.font = '25px Arial';
        const marginLeft = 50;
        const maxWidth = 850;
        let lineHeight = 40;
        let cursorX = marginLeft;
        let cursorY = 450; // Starting Y position for the text

        // Loop through words and handle line breaks
        words.forEach((wordObj, index) => {
            // If undefined, skip the word
            if (wordObj == undefined) {
                return;
            }

            // If not Mispronunciation, Omission, or None, skip the word
            if (!['Mispronunciation', 'Omission', 'None'].includes(wordObj.PronunciationAssessment.ErrorType)) {
                return;
            }
            let word = wordObj.Word;

            // Capitalize only the first letter of the first word
            if (index == 0) {
                word = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            } else {
                word = word.toLowerCase();
            }

            const errorType = wordObj.PronunciationAssessment.ErrorType;
            const wordAccuracyScore = wordObj.PronunciationAssessment.AccuracyScore;
            const wordWidth = ctx.measureText(word).width + 15; // Measure width of the word

            // If the word exceeds the max width, move to a new line
            if (cursorX + wordWidth > maxWidth) {
                cursorX = marginLeft; // Reset X position to the left margin
                cursorY += lineHeight; // Move to the next line
            }

            if (errorType == 'Mispronunciation' || wordAccuracyScore < 70) {
                // Highlight mispronounced words in yellow
                ctx.fillStyle = '#FFD700'; // Yellow
                ctx.fillRect(cursorX - 5, cursorY - 25, wordWidth - 5, 30);
                ctx.fillStyle = '#000000'; // Black text
                ctx.fillText(word, cursorX, cursorY);
            } else if (errorType == 'Omission') {
                // Highlight skipped words in grey
                ctx.fillStyle = '#A9A9A9'; // Grey
                ctx.fillRect(cursorX - 5, cursorY - 25, wordWidth - 5, 30);
                ctx.fillStyle = '#000000'; // Black text
                ctx.fillText(word, cursorX, cursorY);
            } else if (errorType == 'None') {
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
        console.log('Error creating and uploading image:', err);
        throw new Error('Failed to create and upload image');
    }
}

const createAndUploadMonologueScoreImage = async (pronunciationAssessment) => {
    try {
        if (pronunciationAssessment === undefined || pronunciationAssessment == [] || pronunciationAssessment == null) {
            return null;
        };

        const fluencyScoreNumber = Math.round(pronunciationAssessment.scoreNumber.fluencyScore);
        let accuracyScoreNumber = Math.round(pronunciationAssessment.scoreNumber.accuracyScore);
        const words = pronunciationAssessment.words;

        const mispronouncedWordsList = pronunciationAssessment.words.filter(word => word.PronunciationAssessment.ErrorType == "Mispronunciation" || word.PronunciationAssessment.AccuracyScore < 70);
        if (mispronouncedWordsList.length == 0) {
            accuracyScoreNumber = 100;
        }

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
        ctx.fillText('Correct Pronunciation', 50, 120);

        // Draw light magenta background bar for full length
        ctx.fillStyle = '#eecef7';
        ctx.fillRect(50, 125, 790, 40);

        // Draw dark magenta foreground bar for actual score
        ctx.fillStyle = '#cb6ce6';
        ctx.fillRect(50, 125, 790 * (accuracyScoreNumber / 100), 40);

        // Add score text inside the bar
        ctx.fillStyle = '#000000';
        // Position till the end of dark magenta bar
        ctx.fillText(`${accuracyScoreNumber}%`, 50 + 790 * (accuracyScoreNumber / 100) - 70, 155);


        // Add "Pronunciation" Bar with dynamic score
        ctx.font = '25px Arial';
        ctx.fillText('Fluency', 50, 215);

        // Draw light blue background bar for full length
        ctx.fillStyle = '#B2EBF2';
        ctx.fillRect(50, 220, 790, 40);

        // Draw dark blue foreground bar for actual score
        ctx.fillStyle = '#30D5C8';
        ctx.fillRect(50, 220, 790 * (fluencyScoreNumber / 100), 40);

        // Add score text inside the bar
        ctx.fillStyle = '#000000';
        // Position till the end of dark blue bar
        ctx.fillText(`${fluencyScoreNumber}%`, 50 + 790 * (fluencyScoreNumber / 100) - 70, 250);

        ctx.font = 'bold 30px Arial';
        ctx.fillText('You said:', 50, 315);

        // Create a paragraph format for the text
        ctx.font = '25px Arial';
        const marginLeft = 50;
        const maxWidth = 850;
        let lineHeight = 40;
        let cursorX = marginLeft;
        let cursorY = 355; // Starting Y position for the text

        // Loop through words and handle line breaks
        words.forEach((wordObj) => {
            // If undefined, skip the word
            if (wordObj == undefined) {
                return;
            }

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

            if (errorType == 'Mispronunciation' || wordAccuracyScore < 70) {
                // Highlight mispronounced words in yellow
                ctx.fillStyle = '#FFD700'; // Yellow
                ctx.fillRect(cursorX - 5, cursorY - 25, wordWidth - 5, 30);
                ctx.fillStyle = '#000000'; // Black text
                ctx.fillText(word, cursorX, cursorY);
            } else {
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

        // Convert the canvas to a buffer
        const buffer = canvas.toBuffer('image/jpeg');

        // Upload to Azure Blob Storage
        const imageUrl = await azureBlobStorage.uploadImageToBlobStorage(buffer);
        return imageUrl;
    } catch (err) {
        console.log('Error creating and uploading image:', err);
        throw new Error('Failed to create and upload image');
    }
}

const createAndUploadSpeakingPracticeScoreImage = async (pronunciationAssessments) => {
    try {
        if (pronunciationAssessments === undefined || pronunciationAssessments == [] || pronunciationAssessments == null) {
            return null;
        };

        let totalFluencyScore = 0;
        let totalAccuracyScore = 0;
        let allWords = [];

        pronunciationAssessments.forEach(assessment => {
            totalFluencyScore += Math.round(assessment.scoreNumber.fluencyScore || 0);
            totalAccuracyScore += Math.round(assessment.scoreNumber.accuracyScore || 0);
            if (assessment.words && Array.isArray(assessment.words)) {
                allWords = [...allWords, ...assessment.words];
            }
        });

        const avgFluencyScore = Math.round(totalFluencyScore / pronunciationAssessments.length);
        const avgAccuracyScore = Math.round(totalAccuracyScore / pronunciationAssessments.length);

        const width = 900;
        const height = 950;
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
        ctx.fillText('Correct Pronunciation', 50, 120);

        // Draw light magenta background bar for full length
        ctx.fillStyle = '#eecef7';
        ctx.fillRect(50, 125, 790, 40);

        // Draw dark magenta foreground bar for actual score
        ctx.fillStyle = '#cb6ce6';
        ctx.fillRect(50, 125, 790 * (avgAccuracyScore / 100), 40);

        // Add score text inside the bar
        ctx.fillStyle = '#000000';
        // Position till the end of dark magenta bar
        ctx.fillText(`${avgAccuracyScore}%`, 50 + 790 * (avgAccuracyScore / 100) - 70, 155);

        // Add "Pronunciation" Bar with dynamic score
        ctx.font = '25px Arial';
        ctx.fillText('Fluency', 50, 215);

        // Draw light blue background bar for full length
        ctx.fillStyle = '#B2EBF2';
        ctx.fillRect(50, 220, 790, 40);

        // Draw dark blue foreground bar for actual score
        ctx.fillStyle = '#30D5C8';
        ctx.fillRect(50, 220, 790 * (avgFluencyScore / 100), 40);

        // Add score text inside the bar
        ctx.fillStyle = '#000000';
        // Position till the end of dark blue bar
        ctx.fillText(`${avgFluencyScore}%`, 50 + 790 * (avgFluencyScore / 100) - 70, 250);

        ctx.font = 'bold 30px Arial';
        ctx.fillText('You said:', 50, 305);

        // Create a paragraph format for the text
        ctx.font = '17px Arial';
        const marginLeft = 50;
        const maxWidth = 850;
        let lineHeight = 40;
        let cursorX = marginLeft;
        let cursorY = 345; // Starting Y position for the text

        // Loop through words and handle line breaks
        allWords.forEach(wordObj => {
            if (wordObj == undefined) {
                return;
            }
            if (!['Mispronunciation', 'None'].includes(wordObj.PronunciationAssessment.ErrorType)) {
                return;
            }
            const word = wordObj.Word;
            const errorType = wordObj.PronunciationAssessment.ErrorType;
            if (errorType == 'Omission') {
                return;
            }
            const wordAccuracyScore = wordObj.PronunciationAssessment.AccuracyScore;
            const wordWidth = ctx.measureText(word).width + 13; // Measure width of the word

            // If the word exceeds the max width, move to a new line
            if (cursorX + wordWidth > maxWidth) {
                cursorX = marginLeft; // Reset X position to the left margin
                cursorY += lineHeight; // Move to the next line
            }

            if (errorType == 'Mispronunciation' || wordAccuracyScore < 70) {
                // Highlight mispronounced words in yellow
                ctx.fillStyle = '#FFD700'; // Yellow
                ctx.fillRect(cursorX - 5, cursorY - 25, wordWidth - 5, 30);
                ctx.fillStyle = '#000000'; // Black text
                ctx.fillText(word, cursorX, cursorY);
            } else {
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
        ctx.arc(60, 920, 10, 0, 2 * Math.PI);
        ctx.fill(); // Fill the circle
        ctx.fillStyle = '#000000';
        ctx.fillText('Mispronounced Words', 80, 927);

        // Convert the canvas to a buffer
        const buffer = canvas.toBuffer('image/jpeg');

        // Upload to Azure Blob Storage
        const imageUrl = await azureBlobStorage.uploadImageToBlobStorage(buffer);
        return imageUrl;
    } catch (err) {
        console.log('Error creating and uploading image:', err);
        throw new Error('Failed to create and upload image');
    }
}

const extractMispronouncedWords = (results) => {
    if (!results || !results.words) {
        return [];
    }

    const words = Object.values(results.words);
    const mispronouncedWords = words.filter(word => {
        return word &&
            word.PronunciationAssessment &&
            (word.PronunciationAssessment.ErrorType == 'Mispronunciation' ||
                word.PronunciationAssessment.AccuracyScore < 70);
    });

    return mispronouncedWords;
};

const extractTranscript = (results) => {
    if (!results || !results.words) {
        return "";
    }

    const words = Object.values(results.words);
    const transcriptWords = words.filter(word =>
        word &&
        word.PronunciationAssessment &&
        word.PronunciationAssessment.ErrorType !== 'Omission'
    );

    const transcript = transcriptWords.map(word => word.Word).join(" ");

    // Capitalize first letter of the first word if it's alphabetic
    if (transcript.length > 0 && /[a-zA-Z]/.test(transcript[0])) {
        return transcript[0].toUpperCase() + transcript.slice(1);
    }

    return transcript;
};


const getAcceptableMessagesList = async (activityType) => {
    if (activityType === "listenAndSpeak" || activityType === "watchAndSpeak" || activityType === "watchAndAudio" || activityType === "conversationalQuestionsBot" || activityType === "conversationalMonologueBot" || activityType === "conversationalAgencyBot" || activityType === "speakingPractice") {
        return ["audio"];
    } else if (activityType === "watchAndImage") {
        return ["image"];
    }
};

const sendMessage = async (to, body, retryAttempt = 0) => {
    const MAX_RETRIES = 15;

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
        const errData = error.response ? error.response.data : null;
        if (errData && errData.error && errData.error.code === 131056) {
            console.log(`Pair rate limit hit (131056). Attempt ${retryAttempt + 1} of ${MAX_RETRIES}`);
            if (retryAttempt < MAX_RETRIES) {
                const waitTimeSeconds = retryAttempt === 0 ? 1 : Math.min(retryAttempt * 4, 60);
                console.log(`Retrying after ${waitTimeSeconds} seconds...`);
                await new Promise((resolve) => setTimeout(resolve, waitTimeSeconds * 1000));
                return sendMessage(to, body, retryAttempt + 1);
            } else {
                console.log(`Max retries reached. Giving up on message to ${to}.`);
            }
        } else {
            console.log("Error sending message:", errData ? errData : error.message);
        }
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

const createFeedback = async (
    phoneNumber,
    feedbackContent
) => {
    const userCurrentProgress = await waUserProgressRepository.getByPhoneNumber(
        phoneNumber
    );

    const userAcceptableList = userCurrentProgress.acceptableMessages || [];
    if (userAcceptableList.includes("start next activity")) {
        await waUserProgressRepository.updateAcceptableMessagesList(phoneNumber, ["start next activity"]);
    } else if (userAcceptableList.includes("start next lesson")) {
        await waUserProgressRepository.updateAcceptableMessagesList(phoneNumber, ["start next lesson"]);
    }

    let courseId = null,
        lessonId = null,
        weekNumber = null,
        dayNumber = null,
        activityType = null;

    if (userCurrentProgress) {
        courseId = userCurrentProgress.currentCourseId || null;
        lessonId = userCurrentProgress.currentLessonId || null;
        weekNumber = userCurrentProgress.currentWeek || null;
        dayNumber = userCurrentProgress.currentDay || null;
        activityType = await lessonRepository.getActivityByLessonId(lessonId);
    }

    await waFeedbackRepository.create({
        phoneNumber: phoneNumber,
        feedbackContent: feedbackContent,
        courseId: courseId,
        lessonId: lessonId,
        weekNumber: weekNumber,
        dayNumber: dayNumber,
        activityType: activityType,
    });

    return;

};

const createActivityLog = async (
    phoneNumber,
    actionType,
    messageDirection,
    messageContent,
    metadata,
    caption = null
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
        messageContent: [finalMessageContent, caption],
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

const sendMediaMessage = async (to, mediaUrl, mediaType, captionText = null, retryAttempt = 0) => {
    const MAX_RETRIES = 15;
    try {
        if (mediaType == 'video') {
            await axios.post(
                `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'video',
                    video: { link: mediaUrl, caption: captionText },
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
                    image: { link: mediaUrl, caption: captionText },
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
            console.log('Invalid media type:', mediaType);
        }
        let logger = `Outbound Message: User: ${to}, Message Type: ${mediaType}, Message Content: ${mediaUrl}`;
        console.log(logger);
    } catch (error) {
        const errData = error.response ? error.response.data : null;
        if (errData && errData.error && errData.error.code === 131056) {
            console.log(`Pair rate limit hit (131056). Attempt ${retryAttempt + 1} of ${MAX_RETRIES}`);
            if (retryAttempt < MAX_RETRIES) {
                const waitTimeSeconds = retryAttempt === 0 ? 1 : Math.min(retryAttempt * 4, 60);
                console.log(`Retrying after ${waitTimeSeconds} seconds...`);
                await new Promise((resolve) => setTimeout(resolve, waitTimeSeconds * 1000));
                return sendMediaMessage(to, mediaUrl, mediaType, captionText, retryAttempt + 1);
            } else {
                console.log(`Max retries reached. Giving up on message to ${to}.`);
            }
        } else {
            console.log("Error sending message:", errData ? errData : error.message);
        }
    }
};

const sendButtonMessage = async (to, bodyText, buttonOptions, retryAttempt = 0, imageUrl = null, videoUrl = null) => {
    const MAX_RETRIES = 15;

    try {
        if (imageUrl) {
            const response = await axios.post(
                `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: 'interactive',
                    interactive: {
                        type: 'button',
                        header: {
                            type: 'image',
                            image: {
                                link: imageUrl
                            }
                        },
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
        } else if (videoUrl) {
            const response = await axios.post(
                `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: 'interactive',
                    interactive: {
                        type: 'button',
                        header: {
                            type: 'video',
                            video: {
                                link: videoUrl
                            }
                        },
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
        }
        else {
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
        }
        let logger = `Outbound Message: User: ${to}, Message Type: button, Message Content: ${bodyText}`;
        console.log(logger);
    } catch (error) {
        const errData = error.response ? error.response.data : null;
        if (errData && errData.error && errData.error.code === 131056) {
            console.log(`Pair rate limit hit (131056). Attempt ${retryAttempt + 1} of ${MAX_RETRIES}`);
            if (retryAttempt < MAX_RETRIES) {
                const waitTimeSeconds = retryAttempt === 0 ? 1 : Math.min(retryAttempt * 4, 60);
                console.log(`Retrying after ${waitTimeSeconds} seconds...`);
                await new Promise((resolve) => setTimeout(resolve, waitTimeSeconds * 1000));
                if (imageUrl) {
                    return sendButtonMessage(to, bodyText, buttonOptions, retryAttempt + 1, imageUrl);
                } else if (videoUrl) {
                    return sendButtonMessage(to, bodyText, buttonOptions, retryAttempt + 1, null, videoUrl);
                } else {
                    return sendButtonMessage(to, bodyText, buttonOptions, retryAttempt + 1);
                }
            } else {
                console.log(`Max retries reached. Giving up on message to ${to}.`);
            }
        } else {
            console.log("Error sending message:", errData ? errData : error.message);
        }
    }
};

const removeHTMLTags = (text) => {
    return text.replace(/<[^>]*>?/gm, '');
};

const greetingMessage = async (userMobileNumber) => {
    await waUserProgressRepository.create({
        phoneNumber: userMobileNumber,
        engagement_type: "Greeting Message",
        lastUpdated: new Date(),
    });
    const greetingMessage = "Welcome to Beaj Education! 👋\n\nI'm Ms. Beaj - here to guide you!\n\n👇Please choose your course:";
    const greetingImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/greeting_beaj_face.jpeg";
    await sendButtonMessage(userMobileNumber, greetingMessage, [{ id: 'teacher_course', title: 'Teacher Training' }, { id: 'kids_course', title: 'Kids Summer Camp' }], 0, greetingImage);
    await createActivityLog(userMobileNumber, "template", "outbound", greetingMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["teacher training", "kids summer camp"]);
    return;
};

const greetingMessageLoop = async (userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "Greeting Message");
    const greetingMessage = "👇Please choose your course:";
    await sendButtonMessage(userMobileNumber, greetingMessage, [{ id: 'teacher_course', title: 'Teacher Training' }, { id: 'kids_course', title: 'Kids Summer Camp' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", greetingMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["teacher training", "kids summer camp"]);
    return;
};

const kidsChooseClass = async (userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "Choose Class");
    // TODO: Send kids promo video here
    const chooseClassMessage = "🆓 Get a Free Trial!\n\n👇Choose your class:";
    const chooseClassImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/choose_class.jpeg";
    await sendButtonMessage(userMobileNumber, chooseClassMessage, [{ id: 'kids_summer_camp_class_1_or_2', title: 'Grade 1 or 2' }, { id: 'kids_summer_camp_class_5_or_6', title: 'Grade 5 or 6' }], 0, chooseClassImage);
    await createActivityLog(userMobileNumber, "template", "outbound", chooseClassMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["grade 1 or 2", "grade 5 or 6"]);
    return;
};

const kidsConfirmClass = async (userMobileNumber, messageContent) => {
    if (messageContent.toLowerCase() == "grade 1 or 2") {
        await waUserProgressRepository.updateEngagementType(userMobileNumber, "Confirm Class - Level 1");
    } else if (messageContent.toLowerCase() == "grade 5 or 6") {
        await waUserProgressRepository.updateEngagementType(userMobileNumber, "Confirm Class - Level 3");
    }
    const confirmClassMessage = "🚀 Let's begin your *Free Trial* for " + messageContent.charAt(0).toUpperCase() + messageContent.slice(1) + "!";
    await sendButtonMessage(userMobileNumber, confirmClassMessage, [{ id: 'start_free_trial', title: 'Start Free Trial' }, { id: 'no_choose_again', title: 'No, Choose Again' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", confirmClassMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start free trial", "no, choose again"]);
    return;
};


const kidsChooseClassLoop = async (userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "Choose Class");
    const chooseClassMessage = "👇Choose your class:";
    await sendButtonMessage(userMobileNumber, chooseClassMessage, [{ id: 'kids_summer_camp_class_1_or_2', title: 'Grade 1 or 2' }, { id: 'kids_summer_camp_class_5_or_6', title: 'Grade 5 or 6' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", chooseClassMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["grade 1 or 2", "grade 5 or 6"]);
    return;
};

const demoCourseStart = async (userMobileNumber, startingLesson, courseName) => {
    // Update user progress
    await waUserProgressRepository.update(
        userMobileNumber,
        await courseRepository.getCourseIdByName(
            courseName
        ),
        startingLesson.dataValues.weekNumber,
        startingLesson.dataValues.dayNumber,
        startingLesson.dataValues.LessonId,
        startingLesson.dataValues.SequenceNumber,
        startingLesson.dataValues.activity,
        null,
        null,
    );
    await waUserProgressRepository.updateEngagementType(userMobileNumber, courseName);

    let persona = "";
    if (courseName == "Free Trial - Teachers") {
        persona = "teacher";
    } else if (courseName == "Free Trial - Kids - Level 1" || courseName == "Free Trial - Kids - Level 3") {
        persona = "kid";
    }
    await waUserProgressRepository.updatePersona(userMobileNumber, persona);

    // Text Message
    let message = "";
    if (courseName == "Free Trial - Teachers") {
        message = "Great! Let's start your free trial! 🤩 Here is your first lesson.";
    } else if (courseName == "Free Trial - Kids - Level 1" || courseName == "Free Trial - Kids - Level 3") {
        message = "GREAT! 💥\n\nLet's Start Our Adventure! 🤩";
    }
    await sendMessage(userMobileNumber, message);
    await createActivityLog(userMobileNumber, "text", "outbound", message, null);
    return;
};

const endTrial = async (userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "End Trial");
    let endTrialMessage = "You have chosen to end your free trial. Would you like to:";
    const user = await waUsersMetadataRepository.getByPhoneNumber(userMobileNumber);
    if (user.dataValues.userRegistrationComplete) {
        await sendButtonMessage(userMobileNumber, endTrialMessage, [{ id: 'get_another_trial', title: 'Get Another Trial' }]);
    } else {
        await sendButtonMessage(userMobileNumber, endTrialMessage, [{ id: 'get_another_trial', title: 'Get Another Trial' }, { id: 'register', title: 'Register' }]);
    }
    await createActivityLog(userMobileNumber, "template", "outbound", endTrialMessage, null);
    if (user.dataValues.userRegistrationComplete) {
        await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["get another trial"]);
    } else {
        await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["get another trial", "register"]);
    }
    return;
};

const getSchoolName = async (userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "School Name");
    const schoolInputMessage = "Please type your school's name:";
    await sendMessage(userMobileNumber, schoolInputMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", schoolInputMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["text"]);
    return;
};

const confirmSchoolName = async (userMobileNumber, messageContent) => {
    await waUsersMetadataRepository.updateSchoolName(userMobileNumber, messageContent);
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "Confirm School Name");
    const confirmSchoolNameMessage = "Please confirm your school's name: " + messageContent;
    await sendButtonMessage(userMobileNumber, confirmSchoolNameMessage, [{ id: 'yes', title: 'Yes' }, { id: 'no', title: 'No' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", confirmSchoolNameMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["yes", "no"]);
    return;
};

const thankyouMessage = async (userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "Thankyou Message");
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
        ["get another trial"]
    );
    const freeTrialCompleteImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/free_trial_complete.jpeg"
    await sendButtonMessage(userMobileNumber, '👏🏽Trial Complete! 🤓', [{ id: 'get_another_trial', title: 'Get Another Trial' }], 0, freeTrialCompleteImage);
    await createActivityLog(userMobileNumber, "image", "outbound", freeTrialCompleteImage, null);
    await waUsersMetadataRepository.update(userMobileNumber, {
        userRegistrationComplete: new Date()
    });
    return;
};

const checkUserMessageAndAcceptableMessages = async (userMobileNumber, currentUserState, messageType, messageContent) => {
    const acceptableMessagesList = currentUserState.dataValues.acceptableMessages;
    const activityType = currentUserState.dataValues.activityType;
    if (activityType === "listenAndSpeak" || activityType === "watchAndSpeak" || activityType === "watchAndAudio" || activityType === "conversationalQuestionsBot" || activityType === "conversationalMonologueBot" || activityType === "conversationalAgencyBot" || activityType === "read" || activityType === "speakingPractice") {
        if (acceptableMessagesList.includes("audio") && messageType === "audio") {
            return true;
        } else if (messageContent.toLowerCase() == "next" && (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3")) {
            return true;
        }
    }
    if (activityType === "watchAndImage" && messageType === "image") {
        return true;
    }
    if (activityType === "watchAndImage" && messageType != "image") {
        await sendMessage(userMobileNumber, "Image bhejain.");
        await createActivityLog(userMobileNumber, "text", "outbound", "Image bhejain.", null);
        return false;
    }
    if (messageType === "text" && acceptableMessagesList.includes("text")) {
        return true;
    }
    if (acceptableMessagesList.includes("yes") && acceptableMessagesList.includes("no")) {
        if (messageContent.toLowerCase() == "yes" || messageContent.toLowerCase() == "no" || messageContent.toLowerCase() == "no, try again") {
            return true;
        } else {
            await sendMessage(userMobileNumber, "yes or no type kerain.");
            await createActivityLog(userMobileNumber, "text", "outbound", "yes or no type kerain.", null);
            return false;
        }
    }
    if (acceptableMessagesList.includes(messageContent.toLowerCase())) {
        return true;
    }

    // If list has "option a", "option b", "option c" then "option a", "option b", "option c" type kerain.
    if (acceptableMessagesList.includes("option a") && acceptableMessagesList.includes("option b") && acceptableMessagesList.includes("option c")) {
        await sendMessage(userMobileNumber, "option a, option b, ya option c mein se koi aik button press kerain.");
        await createActivityLog(userMobileNumber, "text", "outbound", "option a, option b, ya option c mein se koi aik button press kerain.", null);
        return false;
    }
    // If list has "a", "b", "c" then "a", "b", "c" type kerain.
    if (acceptableMessagesList.includes("a") && acceptableMessagesList.includes("b") && acceptableMessagesList.includes("c")) {
        await sendMessage(userMobileNumber, "a, b, ya c mein se koi aik button press kerain.");
        await createActivityLog(userMobileNumber, "text", "outbound", "a, b, ya c mein se koi aik button press kerain.", null);
        return false;
    }
    // If list has "audio"
    if (acceptableMessagesList.includes("audio")) {
        await sendMessage(userMobileNumber, "Voice message record karke bhejain.");
        await createActivityLog(userMobileNumber, "text", "outbound", "Voice message record karke bhejain.", null);
        return false;
    }
    // If list has "text"
    if (acceptableMessagesList.includes("text")) {
        await sendMessage(userMobileNumber, "Text message type kerain.");
        await createActivityLog(userMobileNumber, "text", "outbound", "Text message type kerain.", null);
        return false;
    }
    if (acceptableMessagesList.includes("start")) {
        await sendMessage(userMobileNumber, "Please write: \n\nstart");
        await createActivityLog(userMobileNumber, "text", "outbound", "Please write: \n\nstart", null);
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
        const sortedNotCompletedPurchasedCourse = notCompletedPurchasedCourse.sort((a, b) => a.dataValues.sequenceNumber - b.dataValues.sequenceNumber);
        const nextCourse = sortedNotCompletedPurchasedCourse[0];
        return nextCourse;
    }
    return null;

};

const startCourseForUser = async (userMobileNumber, numbers_to_ignore) => {
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

    // Check if today < course start date
    if (todayYear < courseStartYear || (todayYear === courseStartYear && todayMonth < courseStartMonth) || (todayYear === courseStartYear && todayMonth === courseStartMonth && todayDate < courseStartDateOnly)) {
        if (!numbers_to_ignore.includes(userMobileNumber)) {
            const formattedStartDate = format(new Date(nextCourse.dataValues.courseStartDate), 'MMMM do, yyyy');
            const message = "Your course will start on " + formattedStartDate + ". Please wait for the course to start.";
            await sendMessage(userMobileNumber, message);
            await createActivityLog(userMobileNumber, "text", "outbound", message, null);
            return;
        }
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

    // Extract Level from courseName
    const courseName = nextCourse.dataValues.courseName.split("-");
    const level = courseName[0].trim();

    // Send course_bot_introduction_message
    let intro_message = "Assalam o Alaikum 👋\n\nWelcome to Beaj Self Development Course for Teachers " + level + "!";
    if (level == "Level 1") {
        intro_message += "\n\nMa'am Zainab Qureshi, Ma'am Fizza Hasan and Ma'am Sameen Shahid will be your instructors.";
    }
    await sendMessage(userMobileNumber, intro_message);
    await createActivityLog(userMobileNumber, "text", "outbound", intro_message, null);


    if (level == "Level 1") {
        // Send demo_video
        const demoVideoLink = await extractConstantMessage("demo_video");
        await sendMediaMessage(userMobileNumber, demoVideoLink, 'video');
        await createActivityLog(userMobileNumber, "video", "outbound", demoVideoLink, null);
        await sleep(12000);
    }

    // Send Button Message
    // "Are you ready to start level"
    await sendButtonMessage(userMobileNumber, "Are you ready to start " + level + "?", [{ id: "lets_start", title: "Start" }]);
    await createActivityLog(userMobileNumber, "template", "outbound", "Are you ready to start " + level + "?", null);

    // Update acceptable messages list for the user
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start"]);
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
    await sendMessage(userMobileNumber, "Great! Let's start " + level + "! 🤩");
    await createActivityLog(userMobileNumber, "text", "outbound", "Great! Let's start " + level + "! 🤩", null);
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

const endingMessage = async (userMobileNumber, currentUserState, startingLesson, message = null) => {
    // If activity is video return
    if (startingLesson.dataValues.activity === 'video') {
        return;
    }

    await waLessonsCompletedRepository.endLessonByPhoneNumberAndLessonId(userMobileNumber, startingLesson.dataValues.LessonId);

    // Check if the lesson is the last lesson of the day
    const lessonLast = await lessonRepository.isLastLessonOfDay(startingLesson.dataValues.LessonId);

    // Activity Complete Sticker - only send if not last lesson
    if (!lessonLast && currentUserState.dataValues.persona == "teacher") {
        const activityCompleteSticker = await extractConstantMessage("activity_complete_sticker");
        await sendMediaMessage(userMobileNumber, activityCompleteSticker, 'sticker');
        await createActivityLog(userMobileNumber, "sticker", "outbound", activityCompleteSticker, null);
    }
    if (!lessonLast && currentUserState.dataValues.persona == "kid") {
        if (!(currentUserState.dataValues.currentWeek == 1 && currentUserState.dataValues.currentDay == 1 && currentUserState.dataValues.currentLesson_sequence == 1)) {
            if (startingLesson.dataValues.activityAlias != "🧠 *Let's Think!*") {
                const challengeCompleteSticker = "https://beajbloblive.blob.core.windows.net/beajdocuments/challenge_complete_with_text.webp"
                await sendMediaMessage(userMobileNumber, challengeCompleteSticker, 'sticker');
                await createActivityLog(userMobileNumber, "sticker", "outbound", challengeCompleteSticker, null);
            }
        }
    }

    await sleep(3000);


    if (currentUserState.dataValues.engagement_type == "Free Trial - Teachers") {
        let user = await waUsersMetadataRepository.getByPhoneNumber(userMobileNumber);
        let checkRegistrationComplete = user.dataValues.userRegistrationComplete !== null;
        if (checkRegistrationComplete == false && lessonLast == true) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["get another trial", "register"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            await sendButtonMessage(userMobileNumber, '👏🏽Trial Complete! 🤓', [{ id: 'get_another_trial', title: 'Get Another Trial' }, { id: 'register', title: 'Register' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "get another trial or register", null);

            return;
        } else if (checkRegistrationComplete == true && lessonLast == true) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["get another trial"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            await sendButtonMessage(userMobileNumber, '👏🏽Trial Complete! 🤓', [{ id: 'get_another_trial', title: 'Get Another Trial' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "get another trial", null);

            return;
        } else if (checkRegistrationComplete == false && lessonLast == false) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start next activity", "end trial"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            await sendButtonMessage(userMobileNumber, '👏🏽Activity Complete! 🤓', [{ id: 'start_next_activity', title: 'Start Next Activity' }, { id: 'end_trial', title: 'End Trial' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Activity or End Trial", null);

            return;
        } else if (checkRegistrationComplete == true && lessonLast == false) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start next activity", "end trial"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            await sendButtonMessage(userMobileNumber, '👏🏽Activity Complete! 🤓', [{ id: 'start_next_activity', title: 'Start Next Activity' }, { id: 'end_trial', title: 'End Trial' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Activity or End Trial", null);

            return;
        }
    }
    else if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
        let user = await waUsersMetadataRepository.getByPhoneNumber(userMobileNumber);
        let checkRegistrationComplete = user.dataValues.userRegistrationComplete !== null;
        if (currentUserState.dataValues.currentWeek == 1 && currentUserState.dataValues.currentDay == 1 && currentUserState.dataValues.currentLesson_sequence == 1) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start challenge", "end trial"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            const readyImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/ready_for_your_first_challenge.jpeg"
            await sendButtonMessage(userMobileNumber, 'Ready for your first challenge? 💪', [{ id: 'start_challenge', title: 'Start Challenge' }, { id: 'end_trial', title: 'End Trial' }], 0, readyImage);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start Challenge or End Trial", null);

            return;
        }

        if (checkRegistrationComplete == false && lessonLast == true) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["get another trial", "register"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            if (message == null) {
                await sendButtonMessage(userMobileNumber, '👏🏽Trial Complete! 🤓', [{ id: 'get_another_trial', title: 'Get Another Trial' }, { id: 'register', title: 'Register' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", "get another trial or register", null);
            } else {
                message += "\n\n👏🏽Trial Complete! 🤓";
                await sendButtonMessage(userMobileNumber, message, [{ id: 'get_another_trial', title: 'Get Another Trial' }, { id: 'register', title: 'Register' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", message, null);
            }

            return;
        } else if (checkRegistrationComplete == true && lessonLast == true) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["get another trial"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            if (message == null) {
                await sendButtonMessage(userMobileNumber, '👏🏽Trial Complete! 🤓', [{ id: 'get_another_trial', title: 'Get Another Trial' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", "get another trial", null);
            } else {
                message += "\n\n👏🏽Trial Complete! 🤓";
                await sendButtonMessage(userMobileNumber, message, [{ id: 'get_another_trial', title: 'Get Another Trial' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", message, null);
            }

            return;
        } else if (checkRegistrationComplete == false && lessonLast == false) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start next challenge", "end trial"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            if (message == null) {
                await sendButtonMessage(userMobileNumber, 'Challenge Complete! 💪🏽', [{ id: 'start_next_challenge', title: 'Start Next Challenge' }, { id: 'end_trial', title: 'End Trial' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Challenge or End Trial", null);
            } else {
                await sendButtonMessage(userMobileNumber, message, [{ id: 'start_next_challenge', title: 'Start Next Challenge' }, { id: 'end_trial', title: 'End Trial' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", message, null);
            }

            return;
        } else if (checkRegistrationComplete == true && lessonLast == false) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start next challenge", "end trial"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            if (message == null) {
                await sendButtonMessage(userMobileNumber, 'Challenge Complete! 💪🏽', [{ id: 'start_next_challenge', title: 'Start Next Challenge' }, { id: 'end_trial', title: 'End Trial' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Challenge or End Trial", null);
            } else {
                await sendButtonMessage(userMobileNumber, message, [{ id: 'start_next_challenge', title: 'Start Next Challenge' }, { id: 'end_trial', title: 'End Trial' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", message, null);
            }

            return;
        }
    }



    // FOR ALL ACTIVITIES
    if (lessonLast) {
        const courseName = await courseRepository.getCourseNameById(currentUserState.currentCourseId);
        const strippedCourseName = courseName.split("-")[0].trim();
        // Lesson Number
        const lessonNumber = (startingLesson.dataValues.weekNumber - 1) * 6 + startingLesson.dataValues.dayNumber;

        let goldBarCaption = "";

        // Lesson Complete Message
        let lessonCompleteMessage = "";
        if (lessonNumber == 24 && strippedCourseName == "Level 3") {
            lessonCompleteMessage = "You have completed all 3 levels of the Beaj Self-Development Course! 🌟";
        } else {
            lessonCompleteMessage = "You have completed *" + lessonNumber + " out of 24* lessons in " + strippedCourseName + "!⭐️";
        }
        goldBarCaption = lessonCompleteMessage;
        // await sendMessage(userMobileNumber, lessonCompleteMessage);
        // await createActivityLog(userMobileNumber, "text", "outbound", lessonCompleteMessage, null);

        // Day Ending Message
        if (startingLesson.dataValues.dayNumber >= 1 && startingLesson.dataValues.dayNumber <= 5) {
            const dayEndingMessage = getDayEndingMessage(startingLesson.dataValues.dayNumber);
            goldBarCaption += "\n\n" + dayEndingMessage;
            // await sendMessage(userMobileNumber, dayEndingMessage);
            // await createActivityLog(userMobileNumber, "text", "outbound", dayEndingMessage, null);
        }

        // Lesson Complete Image
        // Gold Bars
        const smallCourseName = strippedCourseName.replace(/\s/g, '').toLowerCase();
        const imageTag = "lesson_complete_image_lesson_" + lessonNumber.toString() + "_" + smallCourseName;
        let fileExtnesion = ".jpg";
        let lessonCompleteImage = "";
        if (lessonNumber == 24 && strippedCourseName == "Level 3") {
            lessonCompleteImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/course_end_gold_bars" + fileExtnesion;
        } else {
            lessonCompleteImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/" + imageTag + fileExtnesion;
        }
        await sendMediaMessage(userMobileNumber, lessonCompleteImage, 'image', goldBarCaption);
        await createActivityLog(userMobileNumber, "image", "outbound", lessonCompleteImage, null, goldBarCaption);
        // Sleep
        await sleep(5000);

        // Week end score image
        if (startingLesson.dataValues.dayNumber == 6) {
            let weekMessage = ""
            if (strippedCourseName == "Level 3") {
                weekMessage = "Thank You for staying with us till the end! 👍🏽";
            }

            const weekEndScore = await weekEndScoreCalculation(userMobileNumber, startingLesson.dataValues.weekNumber, currentUserState.currentCourseId);
            const weekEndScoreImage = await weekEndImage(weekEndScore, startingLesson.dataValues.weekNumber);
            await sendMediaMessage(userMobileNumber, weekEndScoreImage, 'image', weekMessage);
            await createActivityLog(userMobileNumber, "image", "outbound", weekEndScoreImage, null, weekMessage);
            await sleep(5000);

            // await sendMessage(userMobileNumber, weekMessage);
            // await createActivityLog(userMobileNumber, "text", "outbound", weekMessage, null);
        }

        // Feedback Message
        const randomNumber = Math.floor(Math.random() * 100) + 1;
        if (randomNumber >= 75) {
            let cleanedAlias = startingLesson.dataValues.activityAlias.replace(/\?/g, '');
            let feedbackMessage = "We need your feedback to keep improving our course. How would you rate " + cleanedAlias + " activity?";
            await sendButtonMessage(userMobileNumber, feedbackMessage, [{ id: 'feedback_1', title: 'It was great 😁' }, { id: 'feedback_2', title: 'It can be improved 🤔' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", feedbackMessage, null);
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start next lesson", "it was great 😁", "it can be improved 🤔"]);
        } else {
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start next lesson"]);
        }


        // Sleep
        await sleep(4000);

        if (lessonNumber == 24 && strippedCourseName == "Level 3") {
            const congratsImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/congratulations.jpeg";
            await sendMediaMessage(userMobileNumber, congratsImage, 'image', null);
            await createActivityLog(userMobileNumber, "image", "outbound", congratsImage, null);
            await sleep(5000);
        } else {
            await sendButtonMessage(userMobileNumber, 'Are you ready to start your next lesson?', [{ id: 'start_next_lesson', title: 'Start Next Lesson' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Lesson", null);
        }
    } else {
        // Feedback Message
        const randomNumber = Math.floor(Math.random() * 100) + 1;
        if (randomNumber >= 75) {
            let cleanedAlias = startingLesson.dataValues.activityAlias.replace(/\?/g, '');
            let feedbackMessage = "We need your feedback to keep improving our course. How would you rate " + cleanedAlias + " activity?";
            await sendButtonMessage(userMobileNumber, feedbackMessage, [{ id: 'feedback_1', title: 'It was great 😁' }, { id: 'feedback_2', title: 'It can be improved 🤔' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", feedbackMessage, null);
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start next activity", "it was great 😁", "it can be improved 🤔"]);
        } else {
            await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start next activity"]);
        }

        // Sleep
        await sleep(2000);

        // Reply Buttons
        await sendButtonMessage(userMobileNumber, 'Are you ready to start the next activity?', [{ id: 'start_next_activity', title: 'Start Next Activity' }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Activity", null);
    }
};

const sendCourseLessonToTeacher = async (userMobileNumber, currentUserState, startingLesson, messageType, messageContent) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (activity === 'video') {
            // Lesson Started Record
            await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date());

            // Send lesson message
            let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
            lessonMessage += "\n\n" + removeHTMLTags(startingLesson.dataValues.text);

            // Send video content
            const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
            let videoURL = documentFile[0].dataValues.video;

            // Media message
            await sendMediaMessage(userMobileNumber, videoURL, 'video', lessonMessage);
            await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null, lessonMessage);

            // Sleep
            await sleep(12000);
        }
        else if (activity === 'videoEnd') {
            // Lesson Started Record
            await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date());

            // Send lesson message
            let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
            lessonMessage += "\n\n" + removeHTMLTags(startingLesson.dataValues.text);

            // Send video content
            const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
            let videoURL = documentFile[0].dataValues.video;

            // Media message
            await sendMediaMessage(userMobileNumber, videoURL, 'video', lessonMessage);
            await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null, lessonMessage);

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
                const questionText = firstMCQsQuestion.dataValues.QuestionText.replace(/\\n/g, '\n');
                let mcqMessage = questionText + "\n\n";
                if (!questionText.includes("Choose the correct sentence:") && !questionText.includes("What is the correct question") && !questionText.includes("Which is a correct question") && !questionText.includes("Which sentence is correct?")) {
                    mcqMessage += "Choose the correct answer:\n";
                }
                for (let i = 0; i < mcqAnswers.length; i++) {
                    mcqMessage += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                }

                const mcqImage = firstMCQsQuestion.dataValues.QuestionImageUrl;
                const mcqVideo = firstMCQsQuestion.dataValues.QuestionVideoUrl;
                const mcqType = firstMCQsQuestion.dataValues.QuestionType;

                if (mcqType == 'Text') {
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `option_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })));
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                }
                else if (mcqType == 'Text+Image') {
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `option_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })), 0, mcqImage);
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                }
                else if (mcqType == 'Text+Video') {
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `option_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })), 0, null, mcqVideo);
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                }
                else if (mcqType == 'Image') {
                    await sendButtonMessage(userMobileNumber, "", mcqAnswers.map((answer, index) => ({ id: `option_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })), 0, mcqImage);
                    await createActivityLog(userMobileNumber, "template", "outbound", "", null);
                }

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
                let selectedAnswerIndex = -1;
                for (let i = 0; i < mcqAnswers.length; i++) {
                    let matchWith = `option ${String.fromCharCode(65 + i)}`.toLowerCase();
                    if (userAnswer == matchWith) {
                        selectedAnswerIndex = i;
                        if (mcqAnswers[i].dataValues.IsCorrect === true) {
                            isCorrectAnswer = true;
                        }
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

                // Check if custom feedback exists for the selected answer
                if (selectedAnswerIndex !== -1) {
                    const selectedAnswer = mcqAnswers[selectedAnswerIndex];
                    const customFeedbackText = selectedAnswer.dataValues.CustomAnswerFeedbackText;
                    const customFeedbackImage = selectedAnswer.dataValues.CustomAnswerFeedbackImage;
                    const customFeedbackAudio = selectedAnswer.dataValues.CustomAnswerFeedbackAudio;

                    // If not null based on the user selection send all the custom feedback which is not null
                    if (customFeedbackText) {
                        await sendMessage(userMobileNumber, customFeedbackText);
                        await createActivityLog(userMobileNumber, "text", "outbound", customFeedbackText, null);
                    }
                    if (customFeedbackImage) {
                        await sendMediaMessage(userMobileNumber, customFeedbackImage, 'image');
                        await createActivityLog(userMobileNumber, "image", "outbound", customFeedbackImage, null);
                        await sleep(2000);
                    }
                    if (customFeedbackAudio) {
                        await sendMediaMessage(userMobileNumber, customFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", customFeedbackAudio, null);
                        await sleep(5000);
                    }

                    if (!customFeedbackText && !customFeedbackImage && !customFeedbackAudio) {
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
                    }
                } else {
                    // Fallback for invalid selection
                    await sendMessage(userMobileNumber, "Invalid option selected. Please try again.");
                    await createActivityLog(userMobileNumber, "text", "outbound", "Invalid option selected. Please try again.", null);
                    return;
                }

                // Get next MCQ question
                const nextMCQsQuestion = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                if (nextMCQsQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextMCQsQuestion.dataValues.QuestionNumber);

                    // Send question
                    const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(nextMCQsQuestion.dataValues.Id);
                    const questionText = nextMCQsQuestion.dataValues.QuestionText.replace(/\\n/g, '\n');
                    let mcqMessage = questionText + "\n\n";
                    if (!questionText.includes("Choose the correct sentence:") && !questionText.includes("What is the correct question") && !questionText.includes("Which is a correct question") && !questionText.includes("Which sentence is correct?")) {
                        mcqMessage += "Choose the correct answer:\n";
                    }
                    for (let i = 0; i < mcqAnswers.length; i++) {
                        mcqMessage += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                    }

                    // Reply buttons to answer
                    const mcqImage = nextMCQsQuestion.dataValues.QuestionImageUrl;
                    const mcqVideo = nextMCQsQuestion.dataValues.QuestionVideoUrl;
                    const mcqType = nextMCQsQuestion.dataValues.QuestionType;

                    if (mcqType == 'Text') {
                        await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `option_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })));
                        await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                    }
                    else if (mcqType == 'Text+Image') {
                        await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `option_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })), 0, mcqImage);
                        await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                    }
                    else if (mcqType == 'Text+Video') {
                        await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `option_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })), 0, null, mcqVideo);
                        await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                    }
                    else if (mcqType == 'Image') {
                        await sendButtonMessage(userMobileNumber, "", mcqAnswers.map((answer, index) => ({ id: `option_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })), 0, mcqImage);
                        await createActivityLog(userMobileNumber, "template", "outbound", "", null);
                    }

                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["option a", "option b", "option c"]);
                } else {
                    // Calculate total score and send message
                    const totalScore = await waQuestionResponsesRepository.getTotalScore(userMobileNumber, currentUserState.dataValues.currentLessonId);
                    const totalQuestions = await waQuestionResponsesRepository.getTotalQuestions(userMobileNumber, currentUserState.dataValues.currentLessonId);
                    const scorePercentage = (totalScore / totalQuestions) * 100;
                    let message = "*Your score: " + totalScore + "/" + totalQuestions + ".*";
                    if (scorePercentage >= 0 && scorePercentage <= 60) {
                        message += "\n\nGood Effort! 👍🏽";
                        // Text message
                        await sendMessage(userMobileNumber, message);
                        await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                    } else if (scorePercentage >= 61 && scorePercentage <= 79) {
                        message += "\n\nWell done! 🌟";
                        // Text message
                        await sendMessage(userMobileNumber, message);
                        await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                    } else if (scorePercentage >= 80) {
                        message += "\n\nExcellent 🎉";
                        // Text message
                        await sendMessage(userMobileNumber, message);
                        await createActivityLog(userMobileNumber, "text", "outbound", message, null);
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

                const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);
                let videoCaptionText = "Question " + firstWatchAndSpeakQuestion.dataValues.questionNumber + " of " + totalQuestions + ":\n\nPuri video dekhein👆🏽. Phir video ke akhri jumley ko ek voice message mein bol kar bhejhein.💬"

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFile, 'video', videoCaptionText);
                await createActivityLog(userMobileNumber, "video", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFile, null, videoCaptionText);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
            }
            else if (messageType === 'audio') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                const retryCounter = currentUserState.dataValues.retryCounter;
                if (retryCounter == 0 || retryCounter == null) {
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
                        null,
                        [userAudioFileUrl],
                        null,
                        null,
                        null,
                        null,
                        1,
                        submissionDate
                    );

                    // Confirmation message asking to retry with yes and no buttons
                    await sendButtonMessage(userMobileNumber, "Submit response? 🧐", [{ id: "yes", title: "Yes" }, { id: "no", title: "No, try again" }]);
                    await createActivityLog(userMobileNumber, "template", "outbound", "Submit response? 🧐", null);

                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["yes", "no", "no, try again"]);
                    return;
                }
                else {
                    // Get the current Watch And Speak question
                    const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                    // Azure Pronunciation Assessment
                    const pronunciationAssessment = await AIServices.azurePronunciationAssessment(messageContent.data, currentWatchAndSpeakQuestion.dataValues.answer[0]);

                    // Extract user transcription from words
                    const userTranscription = extractTranscript(pronunciationAssessment);

                    // Generate pronunciation assessment message
                    const imageUrl = await createAndUploadScoreImage(pronunciationAssessment);

                    if (imageUrl) {
                        // Media message
                        await sendMediaMessage(userMobileNumber, imageUrl, 'image', "You said: " + userTranscription);
                        await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null, "You said: " + userTranscription);
                        await sleep(5000);
                    }

                    const submissionDate = new Date();
                    const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                    const uniqueID = uuidv4();
                    const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                    const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                    // Update user response to the database
                    await waQuestionResponsesRepository.updateReplace(
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentWatchAndSpeakQuestion.dataValues.id,
                        activity,
                        startingLesson.dataValues.activityAlias,
                        [userTranscription],
                        [userAudioFileUrl],
                        [imageUrl],
                        null,
                        [pronunciationAssessment],
                        null,
                        retryCounter + 1,
                        submissionDate
                    );

                    const nextWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                    if (nextWatchAndSpeakQuestion) {
                        // Update acceptable messages list for the user
                        await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                        await waUserProgressRepository.updateRetryCounter(userMobileNumber, 0);

                        // Update question number
                        await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.questionNumber);

                        const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);
                        let videoCaptionText = "Question " + nextWatchAndSpeakQuestion.dataValues.questionNumber + " of " + totalQuestions + ":\n\nPuri video dekhein👆🏽. Phir video ke akhri jumley ko ek voice message mein bol kar bhejhein.💬"

                        // Send question media file
                        await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFile, 'video', videoCaptionText);
                        await createActivityLog(userMobileNumber, "video", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFile, null, videoCaptionText);

                    } else {
                        // Reset Question Number, Retry Counter, and Activity Type
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                        // ENDING MESSAGE
                        await endingMessage(userMobileNumber, currentUserState, startingLesson);
                    }
                    return;
                }
            }
            else if (messageContent == 'yes') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                const audioUrl = await waQuestionResponsesRepository.getAudioUrlForPhoneNumberQuestionIdAndLessonId(userMobileNumber, currentWatchAndSpeakQuestion.dataValues.id, currentUserState.dataValues.currentLessonId);
                const audioBuffer = await getAudioBufferFromAudioFileUrl(audioUrl);

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await AIServices.azurePronunciationAssessment(audioBuffer, currentWatchAndSpeakQuestion.dataValues.answer[0]);

                // Extract user transcription from words
                const userTranscription = extractTranscript(pronunciationAssessment);

                // Generate pronunciation assessment message
                const imageUrl = await createAndUploadScoreImage(pronunciationAssessment);

                if (imageUrl) {
                    // Media message
                    await sendMediaMessage(userMobileNumber, imageUrl, 'image', "You said: " + userTranscription);
                    await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null, "You said: " + userTranscription);
                    await sleep(5000);
                }
                const submissionDate = new Date();
                const retryCounter = currentUserState.dataValues.retryCounter;

                // Update user response to the database
                await waQuestionResponsesRepository.updateReplace(
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentWatchAndSpeakQuestion.dataValues.id,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    [userTranscription],
                    [audioUrl],
                    [imageUrl],
                    null,
                    [pronunciationAssessment],
                    null,
                    retryCounter + 1,
                    submissionDate
                );

                const nextWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                if (nextWatchAndSpeakQuestion) {
                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                    await waUserProgressRepository.updateRetryCounter(userMobileNumber, 0);

                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.questionNumber);

                    const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);
                    let videoCaptionText = "Question " + nextWatchAndSpeakQuestion.dataValues.questionNumber + " of " + totalQuestions + ":\n\nPuri video dekhein👆🏽. Phir video ke akhri jumley ko ek voice message mein bol kar bhejhein.💬"

                    // Send question media file
                    await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFile, 'video', videoCaptionText);
                    await createActivityLog(userMobileNumber, "video", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFile, null, videoCaptionText);

                    return;
                } else {
                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                    // ENDING MESSAGE
                    await endingMessage(userMobileNumber, currentUserState, startingLesson);
                }
                return;
            }
            else if (messageContent == 'no, try again' || messageContent == 'no') {
                // Send message to try again
                await sendMessage(userMobileNumber, "Okay record your voice message again.");
                await createActivityLog(userMobileNumber, "text", "outbound", "Okay record your voice message again.", null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);

                // Update retry counter
                await waUserProgressRepository.updateRetryCounter(userMobileNumber, currentUserState.dataValues.retryCounter + 1);
                return;
            }
        }
        else if (activity == 'watchAndAudio') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\n\nWatch the video 👇🏽 and send your response as a voice message.";
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

                // Lesson Text
                let lessonText = startingLesson.dataValues.text;
                lessonText = removeHTMLTags(lessonText);
                lessonText = lessonText.replace(/\\n/g, '\n');
                await sendMessage(userMobileNumber, lessonText);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonText, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
            } else if (messageType === 'audio') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

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
                    null,
                    [userAudioFileUrl],
                    null,
                    null,
                    null,
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
                } else {
                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                    // ENDING MESSAGE
                    await endingMessage(userMobileNumber, currentUserState, startingLesson);
                }
            }
        }
        else if (activity == 'watchAndImage') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\n\nWatch the videos. Then send an image response.";
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Watch and Speak question
                const firstWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFile, 'video');
                await createActivityLog(userMobileNumber, "video", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFile, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["image"]);
            } else if (messageType === 'image') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Save user response to the database
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userImage = `${timestamp}-${uniqueID}-` + "imageFile.jpg";
                const userImageFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userImage);
                const submissionDate = new Date();
                await waQuestionResponsesRepository.create(
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentWatchAndSpeakQuestion.dataValues.id,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    null,
                    [userImageFileUrl],
                    null,
                    null,
                    null,
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
                if (lessonText == "Let's Start Questions👇🏽") {
                    await sendMessage(userMobileNumber, lessonText);
                    await createActivityLog(userMobileNumber, "text", "outbound", lessonText, null);
                }

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\n\nListen to the audio question and send your answer as a voice message.💬";

                // Text message
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Listen and Speak question
                const firstListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstListenAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                const mediaType = firstListenAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';
                await sendMediaMessage(userMobileNumber, firstListenAndSpeakQuestion.dataValues.mediaFile, mediaType);
                await createActivityLog(userMobileNumber, mediaType, "outbound", firstListenAndSpeakQuestion.dataValues.mediaFile, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                await sleep(5000);

                // Send question text
                const questionText = firstListenAndSpeakQuestion.dataValues.question.replace(/\\n/g, '\n');
                await sendMessage(userMobileNumber, questionText);
                await createActivityLog(userMobileNumber, "text", "outbound", questionText, null);

                return;
            } else if (messageType === 'audio') {
                // Get the current Listen and Speak question
                const currentListenAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                const answersArray = currentListenAndSpeakQuestion.dataValues.answer;
                let prompt = answersArray[0];
                let recognizedText = await AIServices.openaiSpeechToTextWithPrompt(messageContent.data, prompt);
                if (recognizedText) {
                    // Checking if user response is correct or not

                    let userAnswerIsCorrect = false;
                    const recognizedTextCleaned = recognizedText.replace(/[^a-z0-9 ]/gi, "").toLowerCase().trim();
                    for (let i = 0; i < answersArray.length; i++) {
                        const answerCleaned = answersArray[i].replace(/[^a-z0-9 ]/gi, "").toLowerCase().trim();
                        if (recognizedTextCleaned == answerCleaned) {
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
                        let correctMessage = "You said:\n\n" + recognizedText + "\n✅ Great!";
                        await sendMessage(userMobileNumber, correctMessage);
                        await createActivityLog(userMobileNumber, "text", "outbound", correctMessage, null);
                    }
                    // If user response is incorrect
                    else {
                        if (retryCounter !== 2) {
                            // Update retry counter
                            await waUserProgressRepository.updateRetryCounter(userMobileNumber, currentUserState.dataValues.retryCounter + 1);

                            // Text message
                            let wrongMessage = "You said:\n\n" + recognizedText + "\n❌ Try Again!";
                            await sendMessage(userMobileNumber, wrongMessage);
                            await createActivityLog(userMobileNumber, "text", "outbound", wrongMessage, null);
                            return;
                        } else if (retryCounter == 2) {
                            // Reset retry counter
                            await waUserProgressRepository.updateRetryCounter(userMobileNumber, 0);

                            // Text message
                            let wrongMessage = "You said:\n\n" + recognizedText + "\n❌ The correct answer is: " + answersArray[0];
                            await sendMessage(userMobileNumber, wrongMessage);
                            await createActivityLog(userMobileNumber, "text", "outbound", wrongMessage, null);
                        }
                    }
                    const nextListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                    if (nextListenAndSpeakQuestion) {
                        // Update question number
                        await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextListenAndSpeakQuestion.dataValues.questionNumber);

                        const mediaType = nextListenAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';
                        if (mediaType == 'video') {
                            await sendMediaMessage(userMobileNumber, nextListenAndSpeakQuestion.dataValues.mediaFile, 'video');
                            await createActivityLog(userMobileNumber, "video", "outbound", nextListenAndSpeakQuestion.dataValues.mediaFile, null);
                        }

                        // Update acceptable messages list for the user
                        await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                        if (mediaType == 'video') {
                            await sleep(5000);
                        }


                        // Text message
                        const questionText = nextListenAndSpeakQuestion.dataValues.question.replace(/\\n/g, '\n');
                        await sendMessage(userMobileNumber, questionText);
                        await createActivityLog(userMobileNumber, "text", "outbound", questionText, null);
                    } else {
                        // Calculate total score and send message
                        const totalScore = await waQuestionResponsesRepository.getTotalScore(userMobileNumber, currentUserState.dataValues.currentLessonId);
                        const totalQuestions = await waQuestionResponsesRepository.getTotalQuestions(userMobileNumber, currentUserState.dataValues.currentLessonId);
                        const scorePercentage = (totalScore / totalQuestions) * 100;
                        let message = "*Your score: " + totalScore + "/" + totalQuestions + ".*";
                        if (scorePercentage >= 0 && scorePercentage <= 60) {
                            message += "\n\nGood Effort! 👍🏽";
                            // Text message
                            await sendMessage(userMobileNumber, message);
                            await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                        } else if (scorePercentage >= 61 && scorePercentage <= 79) {
                            message += "\n\nWell done! 🌟";
                            // Text message
                            await sendMessage(userMobileNumber, message);
                            await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                        } else if (scorePercentage >= 80) {
                            message += "\n\nExcellent 🎉";
                            // Text message
                            await sendMessage(userMobileNumber, message);
                            await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                        }

                        // Reset Question Number, Retry Counter, and Activity Type
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                        // ENDING MESSAGE
                        await endingMessage(userMobileNumber, currentUserState, startingLesson);
                    }
                } else {
                    let logger = `No speech recognized or an error occurred. User: ${userMobileNumber}, Message Type: ${messageType}, Message Content: ${messageContent}`;
                    console.log(logger);
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

                // Remove HTML tags from the text
                const textWithoutHtmlTags = removeHTMLTags(lessonText);

                // Remove punctuation from the text
                const textWithoutPunctuationAndHtmlTags = textWithoutHtmlTags.replace(/[^a-z0-9 ]/gi, "").toLowerCase().trim();

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await AIServices.azurePronunciationAssessment(messageContent.data, textWithoutPunctuationAndHtmlTags);

                // Extract user transcription from words
                const userTranscription = extractTranscript(pronunciationAssessment);

                const imageUrl = await createAndUploadScoreImage(pronunciationAssessment);

                if (imageUrl) {
                    // Media message
                    await sendMediaMessage(userMobileNumber, imageUrl, 'image', "You said: " + userTranscription);
                    await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null, "You said: " + userTranscription);
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
                    [imageUrl],
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
                const recognizedText = await AIServices.elevenLabsSpeechToText(messageContent.data);
                if (recognizedText) {
                    const recordExists = await waQuestionResponsesRepository.checkRecordExistsForPhoneNumberAndLessonId(userMobileNumber, currentUserState.dataValues.currentLessonId);
                    let openaiFeedbackTranscript = null;
                    let openaiFeedbackAudio = null;
                    let initialFeedbackResponse = null;
                    if (recordExists) {
                        const message = `Please wait for an answer. \n\nYou said: ${recognizedText}`;
                        await sendMessage(userMobileNumber, message);
                        await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                        // Get all previous messages
                        let previousMessages = await waQuestionResponsesRepository.getPreviousMessages(userMobileNumber, currentUserState.dataValues.currentLessonId);

                        // Append transcript
                        let currentMessage = { role: "user", content: await question_bot_prompt() + "\n\nQuestion: " + currentConversationBotQuestion.dataValues.question + "\n\nUser Response: " + recognizedText };
                        previousMessages.push(currentMessage);

                        // OpenAI Feedback
                        openaiFeedbackTranscript = await AIServices.openaiFeedback(previousMessages);
                        initialFeedbackResponse = openaiFeedbackTranscript;

                        // Extract corrected version of the answer
                        const correctedVersion = openaiFeedbackTranscript.match(/\[IMPROVED\](.*?)\[\/IMPROVED\]/);
                        if (correctedVersion) {
                            openaiFeedbackTranscript = openaiFeedbackTranscript.replace(/\[IMPROVED\](.*?)\[\/IMPROVED\]/, '');
                        }

                        // ElevenLabs Text to Speech
                        openaiFeedbackAudio = await AIServices.elevenLabsTextToSpeechAndUpload(openaiFeedbackTranscript);

                        // Media message
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);
                        await sleep(5000);

                        // Send corrected version of the answer
                        if (correctedVersion) {
                            let correctMessage = "A corrected version of your answer is: " + correctedVersion[1] + "\n\n\n*Now try speaking the improved version by sending a voice message* 💬";
                            await sendMessage(userMobileNumber, correctMessage);
                            await createActivityLog(userMobileNumber, "text", "outbound", correctMessage, null);
                        }
                    } else {
                        let finalMessages = null;
                        let latestBotResponse = await waQuestionResponsesRepository.getLatestBotResponse(userMobileNumber, currentUserState.dataValues.currentLessonId);
                        let improvedVersion = latestBotResponse.match(/\[IMPROVED\](.*?)\[\/IMPROVED\]/);
                        let userResponse = "[USER_RESPONSE]" + recognizedText + "[/USER_RESPONSE]\n\n\n" + improvedVersion + "[/IMPROVED]";

                        // OpenAI Feedback
                        openaiFeedbackTranscript = await AIServices.openaiCustomFeedback(await wrapup_prompt(), userResponse);
                        initialFeedbackResponse = openaiFeedbackTranscript;

                        if (openaiFeedbackTranscript.toLowerCase().includes("can be improved")) {
                            openaiFeedbackAudio = "https://beajbloblive.blob.core.windows.net/beajdocuments/better.mp3";
                        } else if (openaiFeedbackTranscript.toLowerCase().includes("it was great")) {
                            openaiFeedbackAudio = "https://beajbloblive.blob.core.windows.net/beajdocuments/ok.mp3";
                        }

                        // Media message
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);
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
                        currentConversationBotQuestion.dataValues.id,
                        activity,
                        startingLesson.dataValues.activityAlias,
                        [recognizedText],
                        [userAudioFileUrl],
                        [initialFeedbackResponse],
                        [openaiFeedbackAudio],
                        null,
                        null,
                        1,
                        submissionDate
                    );

                    if (recordExists) {
                        return;
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
                lessonMessage += "\n\nWatch the video 👇🏽 and practice speaking by sending a voice message.💬";
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

                // Extract user transcription
                const userTranscription = await AIServices.openaiSpeechToText(messageContent.data);

                let disclaimerAndUserTranscriptionMessage = "This chatbot's speech-to-text may not recognize proper nouns accurately or may skip some words—please bear with us while we improve it.";

                // Text message
                disclaimerAndUserTranscriptionMessage += "\n\nYou said: " + userTranscription;
                await sendMessage(userMobileNumber, disclaimerAndUserTranscriptionMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", disclaimerAndUserTranscriptionMessage, null);

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await AIServices.azurePronunciationAssessment(messageContent.data, userTranscription);

                // Extract mispronounced words
                const mispronouncedWords = extractMispronouncedWords(pronunciationAssessment);

                // Generate pronunciation assessment message
                const imageUrl = await createAndUploadMonologueScoreImage(pronunciationAssessment);

                // Media message
                if (imageUrl) {
                    await sendMediaMessage(userMobileNumber, imageUrl, 'image');
                    await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null);
                    await sleep(5000);
                }

                let correctedAudio = "";
                if (mispronouncedWords.length > 0) {
                    let modelResponse = "It looks like you've mispronounced a few words in your response. Here are the corrections:\n\n";
                    for (const word of mispronouncedWords) {
                        modelResponse += word.Word + (word === mispronouncedWords[mispronouncedWords.length - 1] ? "" : "...");
                    }
                    correctedAudio = await AIServices.elevenLabsTextToSpeechAndUpload(modelResponse);
                    await sendMediaMessage(userMobileNumber, correctedAudio, 'audio');
                    await createActivityLog(userMobileNumber, "audio", "outbound", correctedAudio, null);
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
                    [imageUrl],
                    [correctedAudio],
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
            if (currentUserState.dataValues.questionNumber == null) {
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
                let questionAudio = "";
                if (firstConversationalAgencyBotQuestion.dataValues.mediaFile != null && firstConversationalAgencyBotQuestion.dataValues.mediaFile.includes("http")) {
                    questionAudio = firstConversationalAgencyBotQuestion.dataValues.mediaFile;
                } else {
                    questionAudio = await AIServices.elevenLabsTextToSpeechAndUpload(questionText);
                }

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
                let waitingMessage = "Please wait for an answer...";
                await sendMessage(userMobileNumber, waitingMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", waitingMessage, null);
                const recognizedText = await AIServices.azureSpeechToTextAnyLanguage(messageContent.data);
                if (recognizedText != null && recognizedText != "") {
                    if (currentUserState.dataValues.questionNumber == 1) {
                        // Language Detection
                        let modelLanguagePrompt = "Detect the majority of the language used in the provided text. Respond in one word only. The two options are: English or Urdu. You must respond with only one word."
                        const languageDetectionFeedback = await AIServices.openaiCustomFeedback(recognizedText, modelLanguagePrompt);
                        if (languageDetectionFeedback.toLowerCase().includes("english")) {
                            modelLanguagePrompt = "Respond in simple and easy-to-understand English within 100 words."
                        } else {
                            modelLanguagePrompt = "Use simple, easy-to-understand Urdu language, not jargon to respond within 100 words."
                        }
                        let firstPrompt = currentConversationalAgencyBotQuestion.dataValues.question + "\n\n\n" + modelLanguagePrompt;
                        firstPrompt += "\n\n\nMy response: " + recognizedText;

                        let messagesArray = [
                            {
                                role: "system",
                                content: "You are a Teacher-Coach working with teachers from low-resource backgrounds in Pakistan. Your approach is focused on the importance of nervous system regulation and relationship-based education."
                            },
                            {
                                role: "user",
                                content: firstPrompt
                            }
                        ]

                        let openaiFeedbackTranscript = await AIServices.openaiFeedback(messagesArray);
                        let initialFeedbackResponse = openaiFeedbackTranscript;

                        let openaiFeedbackAudio = await AIServices.elevenLabsTextToSpeechAndUpload(initialFeedbackResponse);
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);

                        await sleep(5000);

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
                            [initialFeedbackResponse],
                            [openaiFeedbackAudio],
                            null,
                            null,
                            1,
                            submissionDate
                        );

                        const nextConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                        if (nextConversationalAgencyBotQuestion) {
                            // Update question number
                            await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextConversationalAgencyBotQuestion.dataValues.questionNumber);
                        } else {
                            // Reset Question Number, Retry Counter, and Activity Type
                            await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                            // ENDING MESSAGE
                            await endingMessage(userMobileNumber, currentUserState, startingLesson);
                        }
                    } else {
                        const previousConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber - 1);
                        // Language Detection
                        let modelLanguagePrompt = "Detect the majority of the language used in the provided text. Respond in one word only. The two options are: English or Urdu. You must respond with only one word."
                        const languageDetectionFeedback = await AIServices.openaiCustomFeedback(recognizedText, modelLanguagePrompt);
                        if (languageDetectionFeedback.toLowerCase().includes("english")) {
                            modelLanguagePrompt = "Respond in simple and easy-to-understand English."
                        } else {
                            modelLanguagePrompt = "Use simple, easy-to-understand Urdu language, not jargon to respond."
                        }
                        let secondPrompt = currentConversationalAgencyBotQuestion.dataValues.question + "\n\n\n" + modelLanguagePrompt;
                        secondPrompt += "\n\n\nMy response: " + recognizedText;

                        let previousMessages = await waQuestionResponsesRepository.getPreviousMessagesForAgencyBot(userMobileNumber, currentUserState.dataValues.currentLessonId, previousConversationalAgencyBotQuestion.dataValues.question);
                        previousMessages.push({
                            role: "user",
                            content: secondPrompt
                        });

                        let messagesArray = [
                            {
                                role: "system",
                                content: "You are a Teacher-Coach working with teachers from low-resource backgrounds in Pakistan. Your approach is focused on the importance of nervous system regulation and relationship-based education."
                            }
                        ]

                        previousMessages.forEach(message => {
                            messagesArray.push(message);
                        });

                        let openaiFeedbackTranscript = await AIServices.openaiFeedback(messagesArray);
                        let initialFeedbackResponse = openaiFeedbackTranscript;

                        let openaiFeedbackAudio = await AIServices.elevenLabsTextToSpeechAndUpload(initialFeedbackResponse);
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);

                        await sleep(5000);

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
                            [initialFeedbackResponse],
                            [openaiFeedbackAudio],
                            null,
                            null,
                            1,
                            submissionDate
                        );

                        const nextConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                        if (nextConversationalAgencyBotQuestion) {
                            // Update question number
                            await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextConversationalAgencyBotQuestion.dataValues.questionNumber);
                        } else {
                            // Reset Question Number, Retry Counter, and Activity Type
                            await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                            // ENDING MESSAGE
                            await endingMessage(userMobileNumber, currentUserState, startingLesson);
                        }
                    }
                }
            }
        }
        else if (activity == 'speakingPractice') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\n\nListen to the audio and respond to the question by sending a voice message.💬";
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Speaking Practice question
                const firstSpeakingPracticeQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstSpeakingPracticeQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstSpeakingPracticeQuestion.dataValues.mediaFile, 'audio');
                await createActivityLog(userMobileNumber, "audio", "outbound", firstSpeakingPracticeQuestion.dataValues.mediaFile, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
            } else if (messageType === 'audio') {
                // Get the current Speaking Practice question
                const currentSpeakingPracticeQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Extract user transcription
                const userTranscription = await AIServices.openaiSpeechToText(messageContent.data);

                let disclaimerAndUserTranscriptionMessage = "This chatbot's speech-to-text may not recognize proper nouns accurately or may skip some words—please bear with us while we improve it.";
                disclaimerAndUserTranscriptionMessage += "\n\nYou said: " + userTranscription;
                await sendMessage(userMobileNumber, disclaimerAndUserTranscriptionMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", disclaimerAndUserTranscriptionMessage, null);

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await AIServices.azurePronunciationAssessment(messageContent.data, userTranscription);

                // Save user response to the database
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                const submissionDate = new Date();
                await waQuestionResponsesRepository.create(
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentSpeakingPracticeQuestion.dataValues.id,
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

                const nextSpeakingPracticeQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                if (nextSpeakingPracticeQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextSpeakingPracticeQuestion.dataValues.questionNumber);

                    // Send question media file
                    await sendMediaMessage(userMobileNumber, nextSpeakingPracticeQuestion.dataValues.mediaFile, 'audio');
                    await createActivityLog(userMobileNumber, "audio", "outbound", nextSpeakingPracticeQuestion.dataValues.mediaFile, null);
                } else {
                    const pronunciationAssessments = await waQuestionResponsesRepository.getAllJsonFeedbacksForPhoneNumberAndLessonId(userMobileNumber, currentUserState.dataValues.currentLessonId);
                    const imageUrl = await createAndUploadSpeakingPracticeScoreImage(pronunciationAssessments);

                    // Media message
                    if (imageUrl) {
                        await sendMediaMessage(userMobileNumber, imageUrl, 'image');
                        await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null);
                        await sleep(5000);
                    }

                    // Extract mispronounced words in a loop using pronunciationAssessments and extractMispronouncedWords function
                    let mispronouncedWords = [];
                    for (const assessment of pronunciationAssessments) {
                        const singleMispronouncedWords = extractMispronouncedWords(assessment);
                        mispronouncedWords.push(...singleMispronouncedWords);
                    }

                    // Remove duplicates from mispronouncedWords
                    mispronouncedWords = [...new Set(mispronouncedWords)];


                    let correctedAudio = "";
                    if (mispronouncedWords.length > 0) {
                        let modelResponse = "It looks like you've mispronounced a few words in your response. Here are the corrections:\n\n";
                        for (const word of mispronouncedWords) {
                            modelResponse += word.Word + (word === mispronouncedWords[mispronouncedWords.length - 1] ? "" : "...");
                        }
                        correctedAudio = await AIServices.elevenLabsTextToSpeechAndUpload(modelResponse);
                        await sendMediaMessage(userMobileNumber, correctedAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", correctedAudio, null);
                        await sleep(5000);
                    }


                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                    // ENDING MESSAGE
                    await endingMessage(userMobileNumber, currentUserState, startingLesson);
                }
            }
        }
    } catch (error) {
        console.log('Error sending lesson to user:', error);
        error.fileName = 'chatBotService.js';
        throw error;
    }
};

const sendCourseLessonToKid = async (userMobileNumber, currentUserState, startingLesson, messageType, messageContent) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (activity === 'video') {
            // Lesson Started Record
            await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date());

            // Send lesson message
            let lessonMessage = startingLesson.dataValues.activityAlias + "\n\n" + startingLesson.dataValues.text;

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
            let lessonMessage = startingLesson.dataValues.activityAlias + "\n\n" + startingLesson.dataValues.text;

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
                let message = activityAlias + "\n\n" + startingLesson.dataValues.text;

                await sendMessage(userMobileNumber, message);
                await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                // Send first MCQs question
                const firstMCQsQuestion = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstMCQsQuestion.dataValues.QuestionNumber);
                const totalQuestions = await multipleChoiceQuestionRepository.getTotalQuestions(currentUserState.dataValues.currentLessonId);

                // Send question
                const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(firstMCQsQuestion.dataValues.Id);
                const questionText = firstMCQsQuestion.dataValues.QuestionText.replace(/\\n/g, '\n');

                const mcqType = firstMCQsQuestion.dataValues.QuestionType;

                let mcqMessage = "";
                if (mcqType == 'Text') {
                    mcqMessage = "👉 *Q" + firstMCQsQuestion.dataValues.QuestionNumber + " of " + totalQuestions + "*\n\n" + questionText + "\n\n";
                } else {
                    mcqMessage = "👉 *Q" + firstMCQsQuestion.dataValues.QuestionNumber + " of " + totalQuestions + "*\n\n";
                }
                if (!questionText.includes("Choose the correct sentence:") && !questionText.includes("What is the correct question") && !questionText.includes("Which is a correct question") && !questionText.includes("Which sentence is correct?")) {
                    mcqMessage += "Choose the correct answer:\n";
                }
                if (mcqType == 'Text') {
                    for (let i = 0; i < mcqAnswers.length; i++) {
                        mcqMessage += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                    }
                }

                const mcqImage = firstMCQsQuestion.dataValues.QuestionImageUrl;
                const mcqVideo = firstMCQsQuestion.dataValues.QuestionVideoUrl;

                if (mcqType == 'Text') {
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })));
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                }
                else if (mcqType == 'Text+Image') {
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })), 0, mcqImage);
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                }
                else if (mcqType == 'Text+Video') {
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })), 0, null, mcqVideo);
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                }
                else if (mcqType == 'Image') {
                    await sendButtonMessage(userMobileNumber, "", mcqAnswers.map((answer, index) => ({ id: `${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })), 0, mcqImage);
                    await createActivityLog(userMobileNumber, "template", "outbound", "", null);
                }

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["a", "b", "c"]);
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
                let selectedAnswerIndex = -1;
                for (let i = 0; i < mcqAnswers.length; i++) {
                    let matchWith = `${String.fromCharCode(65 + i)}`.toLowerCase();
                    if (userAnswer == matchWith) {
                        selectedAnswerIndex = i;
                        if (mcqAnswers[i].dataValues.IsCorrect === true) {
                            isCorrectAnswer = true;
                        }
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

                // Check if custom feedback exists for the selected answer
                if (selectedAnswerIndex !== -1) {
                    const selectedAnswer = mcqAnswers[selectedAnswerIndex];
                    const customFeedbackText = selectedAnswer.dataValues.CustomAnswerFeedbackText;
                    const customFeedbackImage = selectedAnswer.dataValues.CustomAnswerFeedbackImage;
                    const customFeedbackAudio = selectedAnswer.dataValues.CustomAnswerFeedbackAudio;

                    // If both image and text are available, send image with caption
                    if (customFeedbackImage && customFeedbackText) {
                        await sendMediaMessage(userMobileNumber, customFeedbackImage, 'image', customFeedbackText);
                        await createActivityLog(userMobileNumber, "image", "outbound", customFeedbackImage, customFeedbackText);
                        await sleep(2000);
                    } else {
                        // Otherwise send them separately if they exist
                        if (customFeedbackText) {
                            await sendMessage(userMobileNumber, customFeedbackText);
                            await createActivityLog(userMobileNumber, "text", "outbound", customFeedbackText, null);
                        }
                        if (customFeedbackImage) {
                            await sendMediaMessage(userMobileNumber, customFeedbackImage, 'image');
                            await createActivityLog(userMobileNumber, "image", "outbound", customFeedbackImage, null);
                            await sleep(2000);
                        }
                    }

                    // Send audio if it exists
                    if (customFeedbackAudio) {
                        await sendMediaMessage(userMobileNumber, customFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", customFeedbackAudio, null);
                        await sleep(5000);
                    }

                    if (!customFeedbackText && !customFeedbackImage && !customFeedbackAudio) {
                        // Correct Answer Feedback
                        if (isCorrectAnswer) {
                            // Text message
                            await sendMessage(userMobileNumber, "✅ That's right!");
                            await createActivityLog(userMobileNumber, "text", "outbound", "✅ That's right!", null);
                        }
                        // Incorrect Answer Feedback
                        else {
                            let correctAnswer = "❌ The correct answer is ";
                            for (let i = 0; i < mcqAnswers.length; i++) {
                                if (mcqAnswers[i].dataValues.IsCorrect === true) {
                                    correctAnswer += String.fromCharCode(65 + i) + ": " + mcqAnswers[i].dataValues.AnswerText;
                                }
                            }
                            // Text message
                            await sendMessage(userMobileNumber, correctAnswer);
                            await createActivityLog(userMobileNumber, "text", "outbound", correctAnswer, null);
                        }
                    }
                } else {
                    // Fallback for invalid selection
                    await sendMessage(userMobileNumber, "Invalid option selected. Please try again.");
                    await createActivityLog(userMobileNumber, "text", "outbound", "Invalid option selected. Please try again.", null);
                    return;
                }

                // Get next MCQ question
                const nextMCQsQuestion = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                if (nextMCQsQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextMCQsQuestion.dataValues.QuestionNumber);
                    const totalQuestions = await multipleChoiceQuestionRepository.getTotalQuestions(currentUserState.dataValues.currentLessonId);

                    const mcqType = nextMCQsQuestion.dataValues.QuestionType;

                    // Send question
                    const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(nextMCQsQuestion.dataValues.Id);
                    const questionText = nextMCQsQuestion.dataValues.QuestionText.replace(/\\n/g, '\n');
                    let mcqMessage = "";
                    if (mcqType == 'Text') {
                        mcqMessage = "👉 *Q" + nextMCQsQuestion.dataValues.QuestionNumber + " of " + totalQuestions + "*\n\n" + questionText + "\n\n";
                    } else {
                        mcqMessage = "👉 *Q" + nextMCQsQuestion.dataValues.QuestionNumber + " of " + totalQuestions + "*\n\n";
                    }
                    if (!questionText.includes("Choose the correct sentence:") && !questionText.includes("What is the correct question") && !questionText.includes("Which is a correct question") && !questionText.includes("Which sentence is correct?")) {
                        mcqMessage += "Choose the correct answer:\n";
                    }
                    if (mcqType == 'Text') {
                        for (let i = 0; i < mcqAnswers.length; i++) {
                            mcqMessage += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                        }
                    }

                    // Reply buttons to answer
                    const mcqImage = nextMCQsQuestion.dataValues.QuestionImageUrl;
                    const mcqVideo = nextMCQsQuestion.dataValues.QuestionVideoUrl;

                    if (mcqType == 'Text') {
                        await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })));
                        await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                    }
                    else if (mcqType == 'Text+Image') {
                        await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })), 0, mcqImage);
                        await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                    }
                    else if (mcqType == 'Text+Video') {
                        await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })), 0, null, mcqVideo);
                        await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                    }
                    else if (mcqType == 'Image') {
                        await sendButtonMessage(userMobileNumber, "", mcqAnswers.map((answer, index) => ({ id: `${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })), 0, mcqImage);
                        await createActivityLog(userMobileNumber, "template", "outbound", "", null);
                    }

                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["a", "b", "c"]);
                } else {
                    // const thumbs_up_sticker = "https://beajbloblive.blob.core.windows.net/beajdocuments/thumbs_up.webp"
                    // await sendMediaMessage(userMobileNumber, thumbs_up_sticker, 'sticker');
                    // await createActivityLog(userMobileNumber, "sticker", "outbound", thumbs_up_sticker, null);
                    // await sleep(2000);

                    // Calculate total score and send message
                    const totalScore = await waQuestionResponsesRepository.getTotalScore(userMobileNumber, currentUserState.dataValues.currentLessonId);
                    const totalQuestions = await waQuestionResponsesRepository.getTotalQuestions(userMobileNumber, currentUserState.dataValues.currentLessonId);
                    const scorePercentage = (totalScore / totalQuestions) * 100;
                    let message = "*Your score: " + totalScore + "/" + totalQuestions + ".*";
                    if (scorePercentage >= 0 && scorePercentage <= 60) {
                        message += "\n\nGood Effort! 👍🏽";
                        // Text message
                        // await sendMessage(userMobileNumber, message);
                        // await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                    } else if (scorePercentage >= 61 && scorePercentage <= 79) {
                        message += "\n\nWell done! 🌟";
                        // Text message
                        // await sendMessage(userMobileNumber, message);
                        // await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                    } else if (scorePercentage >= 80) {
                        message += "\n\nExcellent 🎉";
                        // Text message
                        // await sendMessage(userMobileNumber, message);
                        // await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                    }


                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                    // ENDING MESSAGE
                    await endingMessage(userMobileNumber, currentUserState, startingLesson, message);
                }
            }
        }
        else if (activity == 'watchAndSpeak') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = startingLesson.dataValues.activityAlias + "\n\n" + startingLesson.dataValues.text;
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Watch and Speak question
                const firstWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.questionNumber);

                const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);

                // Send question media file
                let instructions = "👉 *Q" + firstWatchAndSpeakQuestion.dataValues.questionNumber + " of " + totalQuestions + "*\n\n";
                instructions += "Record your answer as a voice message";
                if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                    instructions += "\nOR\n Type “next” to skip challenge";
                }
                await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFile, 'video', instructions);
                await createActivityLog(userMobileNumber, "video", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFile, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                return;
            }
            else if (messageType === 'audio') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                const retryCounter = currentUserState.dataValues.retryCounter;
                if (retryCounter == 0 || retryCounter == null) {
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
                        null,
                        [userAudioFileUrl],
                        null,
                        null,
                        null,
                        null,
                        1,
                        submissionDate
                    );

                    // Confirmation message asking to retry with yes and no buttons
                    await sendButtonMessage(userMobileNumber, "Submit response? 🧐", [{ id: "yes", title: "Yes" }, { id: "no", title: "No, try again" }]);
                    await createActivityLog(userMobileNumber, "template", "outbound", "Submit response? 🧐", null);

                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["yes", "no", "no, try again"]);
                    return;
                }
                else {
                    // Get the current Watch And Speak question
                    const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                    // Azure Pronunciation Assessment
                    const pronunciationAssessment = await AIServices.azurePronunciationAssessment(messageContent.data, currentWatchAndSpeakQuestion.dataValues.answer[0]);

                    // Extract user transcription from words
                    const userTranscription = extractTranscript(pronunciationAssessment);

                    // Generate pronunciation assessment message
                    const imageUrl = await createAndUploadScoreImage(pronunciationAssessment);

                    if (imageUrl) {
                        // Media message
                        await sendMediaMessage(userMobileNumber, imageUrl, 'image', "You said: " + userTranscription);
                        await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null, "You said: " + userTranscription);
                        await sleep(5000);
                    }

                    const submissionDate = new Date();
                    const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                    const uniqueID = uuidv4();
                    const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                    const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                    // Update user response to the database
                    await waQuestionResponsesRepository.updateReplace(
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentWatchAndSpeakQuestion.dataValues.id,
                        activity,
                        startingLesson.dataValues.activityAlias,
                        [userTranscription],
                        [userAudioFileUrl],
                        [imageUrl],
                        null,
                        [pronunciationAssessment],
                        null,
                        retryCounter + 1,
                        submissionDate
                    );

                    const nextWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                    if (nextWatchAndSpeakQuestion) {
                        // Update acceptable messages list for the user
                        await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                        await waUserProgressRepository.updateRetryCounter(userMobileNumber, 0);

                        // Update question number
                        await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.questionNumber);

                        const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);

                        // Send question media file
                        let instructions = "👉 *Q" + nextWatchAndSpeakQuestion.dataValues.questionNumber + " of " + totalQuestions + "*\n\n";
                        instructions += "Record your answer as a voice message";
                        if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                            instructions += "\nOR\n Type “next” to skip challenge";
                        }
                        await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFile, 'video', instructions);
                        await createActivityLog(userMobileNumber, "video", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFile, null);
                    } else {
                        // Reset Question Number, Retry Counter, and Activity Type
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                        // ENDING MESSAGE
                        await endingMessage(userMobileNumber, currentUserState, startingLesson);
                    }
                    return;
                }
            }
            else if (messageContent == 'yes') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                const audioUrl = await waQuestionResponsesRepository.getAudioUrlForPhoneNumberQuestionIdAndLessonId(userMobileNumber, currentWatchAndSpeakQuestion.dataValues.id, currentUserState.dataValues.currentLessonId);
                const audioBuffer = await getAudioBufferFromAudioFileUrl(audioUrl);

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await AIServices.azurePronunciationAssessment(audioBuffer, currentWatchAndSpeakQuestion.dataValues.answer[0]);

                // Extract user transcription from words
                const userTranscription = extractTranscript(pronunciationAssessment);

                // Generate pronunciation assessment message
                const imageUrl = await createAndUploadScoreImage(pronunciationAssessment);

                if (imageUrl) {
                    // Media message
                    await sendMediaMessage(userMobileNumber, imageUrl, 'image', "You said: " + userTranscription);
                    await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null, "You said: " + userTranscription);
                    await sleep(5000);
                }
                const submissionDate = new Date();
                const retryCounter = currentUserState.dataValues.retryCounter;

                // Update user response to the database
                await waQuestionResponsesRepository.updateReplace(
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentWatchAndSpeakQuestion.dataValues.id,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    [userTranscription],
                    [audioUrl],
                    [imageUrl],
                    null,
                    [pronunciationAssessment],
                    null,
                    retryCounter + 1,
                    submissionDate
                );

                const nextWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                if (nextWatchAndSpeakQuestion) {
                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                    await waUserProgressRepository.updateRetryCounter(userMobileNumber, 0);

                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.questionNumber);

                    const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);

                    // Send question media file
                    let instructions = "👉 *Q" + nextWatchAndSpeakQuestion.dataValues.questionNumber + " of " + totalQuestions + "*\n\n";
                    instructions += "Record your answer as a voice message";
                    if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                        instructions += "\nOR\n Type “next” to skip challenge";
                    }
                    await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFile, 'video', instructions);
                    await createActivityLog(userMobileNumber, "video", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFile, null);
                    return;
                } else {
                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                    // ENDING MESSAGE
                    await endingMessage(userMobileNumber, currentUserState, startingLesson);
                }
                return;
            }
            else if (messageContent == 'no, try again' || messageContent == 'no') {
                // Send message to try again
                await sendMessage(userMobileNumber, "Okay record your voice message again.");
                await createActivityLog(userMobileNumber, "text", "outbound", "Okay record your voice message again.", null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);

                // Update retry counter
                await waUserProgressRepository.updateRetryCounter(userMobileNumber, currentUserState.dataValues.retryCounter + 1);
                return;
            }
        }
        else if (activity == 'watchAndAudio') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\n\nWatch the video 👇🏽 and send your response as a voice message.";
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

                // Lesson Text
                let lessonText = startingLesson.dataValues.text;
                lessonText = removeHTMLTags(lessonText);
                lessonText = lessonText.replace(/\\n/g, '\n');
                await sendMessage(userMobileNumber, lessonText);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonText, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
            } else if (messageType === 'audio') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

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
                    null,
                    [userAudioFileUrl],
                    null,
                    null,
                    null,
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
                } else {
                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                    // ENDING MESSAGE
                    await endingMessage(userMobileNumber, currentUserState, startingLesson);
                }
            }
        }
        else if (activity == 'watchAndImage') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\n\nWatch the videos. Then send an image response.";
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Watch and Speak question
                const firstWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFile, 'video');
                await createActivityLog(userMobileNumber, "video", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFile, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["image"]);
            } else if (messageType === 'image') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Save user response to the database
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userImage = `${timestamp}-${uniqueID}-` + "imageFile.jpg";
                const userImageFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userImage);
                const submissionDate = new Date();
                await waQuestionResponsesRepository.create(
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentWatchAndSpeakQuestion.dataValues.id,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    null,
                    [userImageFileUrl],
                    null,
                    null,
                    null,
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

                let lessonMessage = startingLesson.dataValues.activityAlias + "\n\n" + startingLesson.dataValues.text;

                // Text message
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Listen and Speak question
                const firstListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstListenAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                const mediaType = firstListenAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';
                await sendMediaMessage(userMobileNumber, firstListenAndSpeakQuestion.dataValues.mediaFile, mediaType);
                await createActivityLog(userMobileNumber, mediaType, "outbound", firstListenAndSpeakQuestion.dataValues.mediaFile, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                if (mediaType == 'video') {
                    await sleep(5000);
                } else {
                    await sleep(2000);
                }

                // Send question text
                if (firstListenAndSpeakQuestion.dataValues.question != null && firstListenAndSpeakQuestion.dataValues.question != "") {
                    const questionText = firstListenAndSpeakQuestion.dataValues.question.replace(/\\n/g, '\n');
                    await sendMessage(userMobileNumber, questionText);
                    await createActivityLog(userMobileNumber, "text", "outbound", questionText, null);
                }

                const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);

                // Instructions
                let instructions = "👉 *Q" + firstListenAndSpeakQuestion.dataValues.questionNumber + " of " + totalQuestions + "*\n\n";
                instructions += "Record your answer as a voice message";
                if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                    instructions += "\nOR\n Type “next” to skip challenge";
                }
                await sendMessage(userMobileNumber, instructions);
                await createActivityLog(userMobileNumber, "text", "outbound", instructions, null);

                return;
            } else if (messageType === 'audio') {
                // Get the current Listen and Speak question
                const currentListenAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                const answersArray = currentListenAndSpeakQuestion.dataValues.answer;
                let prompt = answersArray[0];
                let recognizedText = await AIServices.openaiSpeechToTextWithPrompt(messageContent.data, prompt);
                if (recognizedText) {
                    // Checking if user response is correct or not

                    let userAnswerIsCorrect = false;
                    const recognizedTextCleaned = recognizedText.replace(/[^a-z0-9 ]/gi, "").toLowerCase().trim();
                    for (let i = 0; i < answersArray.length; i++) {
                        const answerCleaned = answersArray[i].replace(/[^a-z0-9 ]/gi, "").toLowerCase().trim();
                        if (recognizedTextCleaned == answerCleaned) {
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
                        let correctMessage = "You said:\n\n" + recognizedText + "\n✅ That's right!";
                        await sendMessage(userMobileNumber, correctMessage);
                        await createActivityLog(userMobileNumber, "text", "outbound", correctMessage, null);
                    }
                    // If user response is incorrect
                    else {
                        if (retryCounter !== 2) {
                            // Update retry counter
                            await waUserProgressRepository.updateRetryCounter(userMobileNumber, currentUserState.dataValues.retryCounter + 1);

                            // Text message
                            let wrongMessage = "You said:\n\n" + recognizedText + "\n❌ Try Again!";
                            await sendMessage(userMobileNumber, wrongMessage);
                            await createActivityLog(userMobileNumber, "text", "outbound", wrongMessage, null);
                            return;
                        } else if (retryCounter == 2) {
                            // Reset retry counter
                            await waUserProgressRepository.updateRetryCounter(userMobileNumber, 0);

                            // Text message
                            let wrongMessage = "You said:\n\n" + recognizedText + "\n❌ The correct answer is: " + answersArray[0];
                            await sendMessage(userMobileNumber, wrongMessage);
                            await createActivityLog(userMobileNumber, "text", "outbound", wrongMessage, null);
                        }
                    }
                    const nextListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                    if (nextListenAndSpeakQuestion) {
                        // Update question number
                        await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextListenAndSpeakQuestion.dataValues.questionNumber);

                        const mediaType = nextListenAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';
                        if (mediaType == 'video') {
                            await sendMediaMessage(userMobileNumber, nextListenAndSpeakQuestion.dataValues.mediaFile, 'video');
                            await createActivityLog(userMobileNumber, "video", "outbound", nextListenAndSpeakQuestion.dataValues.mediaFile, null);
                        }

                        // Update acceptable messages list for the user
                        await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                        if (mediaType == 'video') {
                            await sleep(5000);
                        } else {
                            await sleep(2000);
                        }


                        // Text message
                        const questionText = nextListenAndSpeakQuestion.dataValues.question.replace(/\\n/g, '\n');
                        if (questionText != null && questionText != "") {
                            await sendMessage(userMobileNumber, questionText);
                            await createActivityLog(userMobileNumber, "text", "outbound", questionText, null);
                        }

                        // Instructions
                        const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);
                        let instructions = "👉 *Q" + nextListenAndSpeakQuestion.dataValues.questionNumber + " of " + totalQuestions + "*\n\n";
                        instructions += "Record your answer as a voice message";
                        if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                            instructions += "\nOR\n Type “next” to skip challenge";
                        }
                        await sendMessage(userMobileNumber, instructions);
                        await createActivityLog(userMobileNumber, "text", "outbound", instructions, null);
                    } else {
                        // const thumbs_up_sticker = "https://beajbloblive.blob.core.windows.net/beajdocuments/thumbs_up.webp"
                        // await sendMediaMessage(userMobileNumber, thumbs_up_sticker, 'sticker');
                        // await createActivityLog(userMobileNumber, "sticker", "outbound", thumbs_up_sticker, null);
                        // await sleep(2000);

                        // Calculate total score and send message
                        const totalScore = await waQuestionResponsesRepository.getTotalScore(userMobileNumber, currentUserState.dataValues.currentLessonId);
                        const totalQuestions = await waQuestionResponsesRepository.getTotalQuestions(userMobileNumber, currentUserState.dataValues.currentLessonId);
                        const scorePercentage = (totalScore / totalQuestions) * 100;
                        let message = "Your score: " + totalScore + "/" + totalQuestions + ".";
                        if (scorePercentage >= 0 && scorePercentage <= 60) {
                            message += "\n\nGood Effort! 👍🏽";
                            // Text message
                            // await sendMessage(userMobileNumber, message);
                            // await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                        } else if (scorePercentage >= 61 && scorePercentage <= 79) {
                            message += "\n\nWell done! 🌟";
                            // Text message
                            // await sendMessage(userMobileNumber, message);
                            // await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                        } else if (scorePercentage >= 80) {
                            message += "\n\nExcellent 🎉";
                            // Text message
                            // await sendMessage(userMobileNumber, message);
                            // await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                        }

                        // Reset Question Number, Retry Counter, and Activity Type
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                        // ENDING MESSAGE
                        await endingMessage(userMobileNumber, currentUserState, startingLesson, message);
                    }
                } else {
                    let logger = `No speech recognized or an error occurred. User: ${userMobileNumber}, Message Type: ${messageType}, Message Content: ${messageContent}`;
                    console.log(logger);
                }
            }
        }
        else if (activity == 'read') {
            if (messageType != 'audio') {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = startingLesson.dataValues.activityAlias + "\n\n" + "🧏 Listen first, then practice reading.";
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send video content
                const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
                let videoURL = documentFile[0].dataValues.video;

                // Media message
                const lessonText = startingLesson.dataValues.text;
                let instructionMessage = "Send us a voice message of you reading this passage:\n\n" + lessonText;
                if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                    instructionMessage += "\n\nOR\n\n Type “next” to skip challenge";
                }
                await sendMediaMessage(userMobileNumber, videoURL, 'video', instructionMessage);
                await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
            } else if (messageType == 'audio') {
                // Get the current Read question text
                const lessonText = startingLesson.dataValues.text;

                // Remove HTML tags from the text
                const textWithoutHtmlTags = removeHTMLTags(lessonText);

                // Remove punctuation from the text
                const textWithoutPunctuationAndHtmlTags = textWithoutHtmlTags.replace(/[^a-z0-9 ]/gi, "").toLowerCase().trim();

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await AIServices.azurePronunciationAssessment(messageContent.data, textWithoutPunctuationAndHtmlTags);

                // Extract user transcription from words
                const userTranscription = extractTranscript(pronunciationAssessment);

                const imageUrl = await createAndUploadScoreImage(pronunciationAssessment);

                if (imageUrl) {
                    // Media message
                    await sendMediaMessage(userMobileNumber, imageUrl, 'image', "You said: " + userTranscription);
                    await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null, "You said: " + userTranscription);
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
                    [imageUrl],
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
                const recognizedText = await AIServices.elevenLabsSpeechToText(messageContent.data);
                if (recognizedText) {
                    const recordExists = await waQuestionResponsesRepository.checkRecordExistsForPhoneNumberAndLessonId(userMobileNumber, currentUserState.dataValues.currentLessonId);
                    let openaiFeedbackTranscript = null;
                    let openaiFeedbackAudio = null;
                    let initialFeedbackResponse = null;
                    if (recordExists) {
                        const message = `Please wait for an answer. \n\nYou said: ${recognizedText}`;
                        await sendMessage(userMobileNumber, message);
                        await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                        // Get all previous messages
                        let previousMessages = await waQuestionResponsesRepository.getPreviousMessages(userMobileNumber, currentUserState.dataValues.currentLessonId);

                        // Append transcript
                        let currentMessage = { role: "user", content: await question_bot_prompt() + "\n\nQuestion: " + currentConversationBotQuestion.dataValues.question + "\n\nUser Response: " + recognizedText };
                        previousMessages.push(currentMessage);

                        // OpenAI Feedback
                        openaiFeedbackTranscript = await AIServices.openaiFeedback(previousMessages);
                        initialFeedbackResponse = openaiFeedbackTranscript;

                        // Extract corrected version of the answer
                        const correctedVersion = openaiFeedbackTranscript.match(/\[IMPROVED\](.*?)\[\/IMPROVED\]/);
                        if (correctedVersion) {
                            openaiFeedbackTranscript = openaiFeedbackTranscript.replace(/\[IMPROVED\](.*?)\[\/IMPROVED\]/, '');
                        }

                        // ElevenLabs Text to Speech
                        openaiFeedbackAudio = await AIServices.elevenLabsTextToSpeechAndUpload(openaiFeedbackTranscript);

                        // Media message
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);
                        await sleep(5000);

                        // Send corrected version of the answer
                        if (correctedVersion) {
                            let correctMessage = "A corrected version of your answer is: " + correctedVersion[1] + "\n\n\n*Now try speaking the improved version by sending a voice message* 💬";
                            await sendMessage(userMobileNumber, correctMessage);
                            await createActivityLog(userMobileNumber, "text", "outbound", correctMessage, null);
                        }
                    } else {
                        let finalMessages = null;
                        let latestBotResponse = await waQuestionResponsesRepository.getLatestBotResponse(userMobileNumber, currentUserState.dataValues.currentLessonId);
                        let improvedVersion = latestBotResponse.match(/\[IMPROVED\](.*?)\[\/IMPROVED\]/);
                        let userResponse = "[USER_RESPONSE]" + recognizedText + "[/USER_RESPONSE]\n\n\n" + improvedVersion + "[/IMPROVED]";

                        // OpenAI Feedback
                        openaiFeedbackTranscript = await AIServices.openaiCustomFeedback(await wrapup_prompt(), userResponse);
                        initialFeedbackResponse = openaiFeedbackTranscript;

                        if (openaiFeedbackTranscript.toLowerCase().includes("can be improved")) {
                            openaiFeedbackAudio = "https://beajbloblive.blob.core.windows.net/beajdocuments/better.mp3";
                        } else if (openaiFeedbackTranscript.toLowerCase().includes("it was great")) {
                            openaiFeedbackAudio = "https://beajbloblive.blob.core.windows.net/beajdocuments/ok.mp3";
                        }

                        // Media message
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);
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
                        currentConversationBotQuestion.dataValues.id,
                        activity,
                        startingLesson.dataValues.activityAlias,
                        [recognizedText],
                        [userAudioFileUrl],
                        [initialFeedbackResponse],
                        [openaiFeedbackAudio],
                        null,
                        null,
                        1,
                        submissionDate
                    );

                    if (recordExists) {
                        return;
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
                lessonMessage += "\n\nWatch the video 👇🏽 and practice speaking by sending a voice message.💬";
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

                // Extract user transcription
                const userTranscription = await AIServices.openaiSpeechToText(messageContent.data);

                let disclaimerAndUserTranscriptionMessage = "This chatbot's speech-to-text may not recognize proper nouns accurately or may skip some words—please bear with us while we improve it.";

                // Text message
                disclaimerAndUserTranscriptionMessage += "\n\nYou said: " + userTranscription;
                await sendMessage(userMobileNumber, disclaimerAndUserTranscriptionMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", disclaimerAndUserTranscriptionMessage, null);

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await AIServices.azurePronunciationAssessment(messageContent.data, userTranscription);

                // Extract mispronounced words
                const mispronouncedWords = extractMispronouncedWords(pronunciationAssessment);

                // Generate pronunciation assessment message
                const imageUrl = await createAndUploadMonologueScoreImage(pronunciationAssessment);

                // Media message
                if (imageUrl) {
                    await sendMediaMessage(userMobileNumber, imageUrl, 'image');
                    await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null);
                    await sleep(5000);
                }

                let correctedAudio = "";
                if (mispronouncedWords.length > 0) {
                    let modelResponse = "It looks like you've mispronounced a few words in your response. Here are the corrections:\n\n";
                    for (const word of mispronouncedWords) {
                        modelResponse += word.Word + (word === mispronouncedWords[mispronouncedWords.length - 1] ? "" : "...");
                    }
                    correctedAudio = await AIServices.elevenLabsTextToSpeechAndUpload(modelResponse);
                    await sendMediaMessage(userMobileNumber, correctedAudio, 'audio');
                    await createActivityLog(userMobileNumber, "audio", "outbound", correctedAudio, null);
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
                    [imageUrl],
                    [correctedAudio],
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
            if (currentUserState.dataValues.questionNumber == null) {
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
                let questionAudio = "";
                if (firstConversationalAgencyBotQuestion.dataValues.mediaFile != null && firstConversationalAgencyBotQuestion.dataValues.mediaFile.includes("http")) {
                    questionAudio = firstConversationalAgencyBotQuestion.dataValues.mediaFile;
                } else {
                    questionAudio = await AIServices.elevenLabsTextToSpeechAndUpload(questionText);
                }

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
                let waitingMessage = "Please wait for an answer...";
                await sendMessage(userMobileNumber, waitingMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", waitingMessage, null);
                const recognizedText = await AIServices.azureSpeechToTextAnyLanguage(messageContent.data);
                if (recognizedText != null && recognizedText != "") {
                    if (currentUserState.dataValues.questionNumber == 1) {
                        // Language Detection
                        let modelLanguagePrompt = "Detect the majority of the language used in the provided text. Respond in one word only. The two options are: English or Urdu. You must respond with only one word."
                        const languageDetectionFeedback = await AIServices.openaiCustomFeedback(recognizedText, modelLanguagePrompt);
                        if (languageDetectionFeedback.toLowerCase().includes("english")) {
                            modelLanguagePrompt = "Respond in simple and easy-to-understand English within 100 words."
                        } else {
                            modelLanguagePrompt = "Use simple, easy-to-understand Urdu language, not jargon to respond within 100 words."
                        }
                        let firstPrompt = currentConversationalAgencyBotQuestion.dataValues.question + "\n\n\n" + modelLanguagePrompt;
                        firstPrompt += "\n\n\nMy response: " + recognizedText;

                        let messagesArray = [
                            {
                                role: "system",
                                content: "You are a Teacher-Coach working with teachers from low-resource backgrounds in Pakistan. Your approach is focused on the importance of nervous system regulation and relationship-based education."
                            },
                            {
                                role: "user",
                                content: firstPrompt
                            }
                        ]

                        let openaiFeedbackTranscript = await AIServices.openaiFeedback(messagesArray);
                        let initialFeedbackResponse = openaiFeedbackTranscript;

                        let openaiFeedbackAudio = await AIServices.elevenLabsTextToSpeechAndUpload(initialFeedbackResponse);
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);

                        await sleep(5000);

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
                            [initialFeedbackResponse],
                            [openaiFeedbackAudio],
                            null,
                            null,
                            1,
                            submissionDate
                        );

                        const nextConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                        if (nextConversationalAgencyBotQuestion) {
                            // Update question number
                            await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextConversationalAgencyBotQuestion.dataValues.questionNumber);
                        } else {
                            // Reset Question Number, Retry Counter, and Activity Type
                            await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                            // ENDING MESSAGE
                            await endingMessage(userMobileNumber, currentUserState, startingLesson);
                        }
                    } else {
                        const previousConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber - 1);
                        // Language Detection
                        let modelLanguagePrompt = "Detect the majority of the language used in the provided text. Respond in one word only. The two options are: English or Urdu. You must respond with only one word."
                        const languageDetectionFeedback = await AIServices.openaiCustomFeedback(recognizedText, modelLanguagePrompt);
                        if (languageDetectionFeedback.toLowerCase().includes("english")) {
                            modelLanguagePrompt = "Respond in simple and easy-to-understand English."
                        } else {
                            modelLanguagePrompt = "Use simple, easy-to-understand Urdu language, not jargon to respond."
                        }
                        let secondPrompt = currentConversationalAgencyBotQuestion.dataValues.question + "\n\n\n" + modelLanguagePrompt;
                        secondPrompt += "\n\n\nMy response: " + recognizedText;

                        let previousMessages = await waQuestionResponsesRepository.getPreviousMessagesForAgencyBot(userMobileNumber, currentUserState.dataValues.currentLessonId, previousConversationalAgencyBotQuestion.dataValues.question);
                        previousMessages.push({
                            role: "user",
                            content: secondPrompt
                        });

                        let messagesArray = [
                            {
                                role: "system",
                                content: "You are a Teacher-Coach working with teachers from low-resource backgrounds in Pakistan. Your approach is focused on the importance of nervous system regulation and relationship-based education."
                            }
                        ]

                        previousMessages.forEach(message => {
                            messagesArray.push(message);
                        });

                        let openaiFeedbackTranscript = await AIServices.openaiFeedback(messagesArray);
                        let initialFeedbackResponse = openaiFeedbackTranscript;

                        let openaiFeedbackAudio = await AIServices.elevenLabsTextToSpeechAndUpload(initialFeedbackResponse);
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);

                        await sleep(5000);

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
                            [initialFeedbackResponse],
                            [openaiFeedbackAudio],
                            null,
                            null,
                            1,
                            submissionDate
                        );

                        const nextConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                        if (nextConversationalAgencyBotQuestion) {
                            // Update question number
                            await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextConversationalAgencyBotQuestion.dataValues.questionNumber);
                        } else {
                            // Reset Question Number, Retry Counter, and Activity Type
                            await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                            // ENDING MESSAGE
                            await endingMessage(userMobileNumber, currentUserState, startingLesson);
                        }
                    }
                }
            }
        }
        else if (activity == 'speakingPractice') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\n\nListen to the audio and respond to the question by sending a voice message.💬";
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Speaking Practice question
                const firstSpeakingPracticeQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstSpeakingPracticeQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstSpeakingPracticeQuestion.dataValues.mediaFile, 'audio');
                await createActivityLog(userMobileNumber, "audio", "outbound", firstSpeakingPracticeQuestion.dataValues.mediaFile, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
            } else if (messageType === 'audio') {
                // Get the current Speaking Practice question
                const currentSpeakingPracticeQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Extract user transcription
                const userTranscription = await AIServices.openaiSpeechToText(messageContent.data);

                let disclaimerAndUserTranscriptionMessage = "This chatbot's speech-to-text may not recognize proper nouns accurately or may skip some words—please bear with us while we improve it.";
                disclaimerAndUserTranscriptionMessage += "\n\nYou said: " + userTranscription;
                await sendMessage(userMobileNumber, disclaimerAndUserTranscriptionMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", disclaimerAndUserTranscriptionMessage, null);

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await AIServices.azurePronunciationAssessment(messageContent.data, userTranscription);

                // Save user response to the database
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                const submissionDate = new Date();
                await waQuestionResponsesRepository.create(
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentSpeakingPracticeQuestion.dataValues.id,
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

                const nextSpeakingPracticeQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                if (nextSpeakingPracticeQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextSpeakingPracticeQuestion.dataValues.questionNumber);

                    // Send question media file
                    await sendMediaMessage(userMobileNumber, nextSpeakingPracticeQuestion.dataValues.mediaFile, 'audio');
                    await createActivityLog(userMobileNumber, "audio", "outbound", nextSpeakingPracticeQuestion.dataValues.mediaFile, null);
                } else {
                    const pronunciationAssessments = await waQuestionResponsesRepository.getAllJsonFeedbacksForPhoneNumberAndLessonId(userMobileNumber, currentUserState.dataValues.currentLessonId);
                    const imageUrl = await createAndUploadSpeakingPracticeScoreImage(pronunciationAssessments);

                    // Media message
                    if (imageUrl) {
                        await sendMediaMessage(userMobileNumber, imageUrl, 'image');
                        await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null);
                        await sleep(5000);
                    }

                    // Extract mispronounced words in a loop using pronunciationAssessments and extractMispronouncedWords function
                    let mispronouncedWords = [];
                    for (const assessment of pronunciationAssessments) {
                        const singleMispronouncedWords = extractMispronouncedWords(assessment);
                        mispronouncedWords.push(...singleMispronouncedWords);
                    }

                    // Remove duplicates from mispronouncedWords
                    mispronouncedWords = [...new Set(mispronouncedWords)];


                    let correctedAudio = "";
                    if (mispronouncedWords.length > 0) {
                        let modelResponse = "It looks like you've mispronounced a few words in your response. Here are the corrections:\n\n";
                        for (const word of mispronouncedWords) {
                            modelResponse += word.Word + (word === mispronouncedWords[mispronouncedWords.length - 1] ? "" : "...");
                        }
                        correctedAudio = await AIServices.elevenLabsTextToSpeechAndUpload(modelResponse);
                        await sendMediaMessage(userMobileNumber, correctedAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", correctedAudio, null);
                        await sleep(5000);
                    }


                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                    // ENDING MESSAGE
                    await endingMessage(userMobileNumber, currentUserState, startingLesson);
                }
            }
        }
    } catch (error) {
        console.log('Error sending lesson to user:', error);
        error.fileName = 'chatBotService.js';
        throw error;
    }
};

export {
    sendMessage,
    retrieveMediaURL,
    greetingMessage,
    createActivityLog,
    extractConstantMessage,
    getAcceptableMessagesList,
    demoCourseStart,
    removeUser,
    checkUserMessageAndAcceptableMessages,
    getNextCourse,
    startCourseForUser,
    levelCourseStart,
    sendCourseLessonToTeacher,
    sendCourseLessonToKid,
    removeUserTillCourse,
    weekEndScoreCalculation,
    createFeedback,
    sendButtonMessage,
    kidsChooseClass,
    kidsConfirmClass,
    kidsChooseClassLoop,
    endTrial,
    greetingMessageLoop,
    getSchoolName,
    confirmSchoolName,
    thankyouMessage
};
