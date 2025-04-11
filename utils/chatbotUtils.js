import dotenv from "dotenv";
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waUserActivityLogsRepository from "../repositories/waUserActivityLogsRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import speakActivityQuestionRepository from '../repositories/speakActivityQuestionRepository.js';
import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import waPurchasedCoursesRepository from '../repositories/waPurchasedCoursesRepository.js';
import lessonRepository from "../repositories/lessonRepository.js";
import { sendMessage, sendMediaMessage, sendButtonMessage } from "./whatsappUtils.js";
import { createAndUploadMonologueScoreImage } from "./imageGenerationUtils.js";
import { createActivityLog } from "./createActivityLogUtils.js";
import { question_bot_prompt, wrapup_prompt } from "../utils/prompts.js";
import azureBlobStorage from "./azureBlobStorage.js";
import AIServices from '../utils/AIServices.js';
import { endingMessage } from "./endingMessageUtils.js";
import { watchAndImageView } from "../views/watchAndImage.js";
import { speakingPracticeView } from "../views/speakingPractice.js";
import { watchAndAudioView } from "../views/watchAndAudio.js";
import { readView } from "../views/read.js";
import { videoView } from "../views/video.js";
import { videoEndView } from "../views/videoEnd.js";
import { sleep, extractMispronouncedWords } from "./utils.js";

dotenv.config();


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

const getAcceptableMessagesList = async (activityType) => {
    if (activityType === "listenAndSpeak" || activityType === "watchAndSpeak" || activityType === "watchAndAudio" || activityType === "conversationalQuestionsBot" || activityType === "conversationalMonologueBot" || activityType === "conversationalAgencyBot" || activityType === "speakingPractice") {
        return ["audio"];
    } else if (activityType === "watchAndImage") {
        return ["image"];
    }
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
        const demoVideoLink = "https://beajbloblive.blob.core.windows.net/beajdocuments/demovideo6.mp4";
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

const sendCourseLessonToTeacher = async (userMobileNumber, currentUserState, startingLesson, messageType, messageContent) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (activity == 'video') {
            await videoView(userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'videoEnd') {
            await videoEndView(userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'mcqs') {
            await mcqsView(userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'watchAndSpeak') {
            await watchAndSpeakView(userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'watchAndAudio') {
            await watchAndAudioView(userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'watchAndImage') {
            await watchAndImageView(userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'listenAndSpeak') {
            await listenAndSpeakView(userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'read') {
            await readView(userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
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
            await speakingPracticeView(userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
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
        if (activity == 'video') {
            await videoView(userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'videoEnd') {
            await videoEndView(userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'mcqs') {
            await mcqsView(userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'watchAndSpeak') {
            await watchAndSpeakView(userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'listenAndSpeak') {
            await listenAndSpeakView(userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'read') {
            await readView(userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'speakingPractice') {
            await speakingPracticeView(userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
    } catch (error) {
        console.log('Error sending lesson to user:', error);
        error.fileName = 'chatBotService.js';
        throw error;
    }
};

export {
    getAcceptableMessagesList,
    removeUser,
    getNextCourse,
    startCourseForUser,
    levelCourseStart,
    sendCourseLessonToTeacher,
    sendCourseLessonToKid,
    removeUserTillCourse,
    weekEndScoreCalculation
};