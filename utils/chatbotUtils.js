import dotenv from "dotenv";
import { format } from 'date-fns';
import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waUserActivityLogsRepository from "../repositories/waUserActivityLogsRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import waPurchasedCoursesRepository from '../repositories/waPurchasedCoursesRepository.js';
import waConstantsRepository from "../repositories/waConstantsRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";
import { sendMessage, sendMediaMessage, sendButtonMessage } from "./whatsappUtils.js";
import { createActivityLog } from "./createActivityLogUtils.js";
import { watchAndImageView } from "../views/watchAndImage.js";
import { speakingPracticeView } from "../views/speakingPractice.js";
import { watchAndAudioView } from "../views/watchAndAudio.js";
import { readView } from "../views/read.js";
import { videoView } from "../views/video.js";
import { videoEndView } from "../views/videoEnd.js";
import { sleep } from "./utils.js";
import { conversationalQuestionsBotView } from "../views/conversationalQuestionsBot.js";
import { conversationalMonologueBotView } from "../views/conversationalMonologueBot.js";
import { watchAndSpeakView } from "../views/watchAndSpeak.js";
import { mcqsView } from "../views/mcqs.js";
import { listenAndSpeakView } from "../views/listenAndSpeak.js";
import { conversationalAgencyBotView } from "../views/conversationalAgencyBot.js";
import waActiveSessionRepository from "../repositories/waActiveSessionRepository.js";
import waProfileRepository from "../repositories/waProfileRepository.js";
import { feedbackMcqsView } from "../views/feedbackMcqs.js";
import { feedbackAudioView } from "../views/feedbackAudio.js";

dotenv.config();


const removeUser = async (phoneNumber) => {
    await waUsersMetadataRepository.deleteByPhoneNumber(phoneNumber);
    await waUserProgressRepository.deleteByPhoneNumber(phoneNumber);
    await waUserActivityLogsRepository.deleteByPhoneNumber(phoneNumber);
    await waLessonsCompletedRepository.deleteByPhoneNumber(phoneNumber);
    await waQuestionResponsesRepository.deleteByPhoneNumber(phoneNumber);
    await waActiveSessionRepository.deleteByPhoneNumber(phoneNumber);
    await waProfileRepository.deleteByPhoneNumber(phoneNumber);
    await waPurchasedCoursesRepository.deleteByPhoneNumber(phoneNumber);

    await sendMessage(phoneNumber, "Your data has been removed. Please start again using the link provided.");
};

const removeUserTillCourse = async (profileId, phoneNumber) => {
    await waUserProgressRepository.update(profileId, phoneNumber, null, null, null, null, null, null, null, null, ["start my course"]);
    await waUserProgressRepository.updateEngagementType(profileId, phoneNumber, "School Input");
    await waUserActivityLogsRepository.deleteByPhoneNumber(phoneNumber);
    await waLessonsCompletedRepository.deleteByPhoneNumber(phoneNumber);
    await waQuestionResponsesRepository.deleteByPhoneNumber(phoneNumber);
    await sendMessage(phoneNumber, "Your data has been removed. Please start again using the link provided.");
};

const weekEndScoreCalculation = async (profileId, phoneNumber, weekNumber, courseId) => {
    // Get lessonIds for mcqs of that week
    const mcqLessonIds = await lessonRepository.getLessonIdsByCourseAndWeekAndActivityType(courseId, weekNumber, 'mcqs');
    const correctMcqs = await waQuestionResponsesRepository.getTotalScoreForList(profileId, phoneNumber, mcqLessonIds);
    const totalMcqs = await waQuestionResponsesRepository.getTotalQuestionsForList(profileId, phoneNumber, mcqLessonIds);

    // Get lessonIds for listenAndSpeak of that week
    const listenAndSpeakLessonIds = await lessonRepository.getLessonIdsByCourseAndWeekAndActivityType(courseId, weekNumber, 'listenAndSpeak');
    const correctListenAndSpeak = await waQuestionResponsesRepository.getTotalScoreForList(profileId, phoneNumber, listenAndSpeakLessonIds);
    const totalListenAndSpeak = await waQuestionResponsesRepository.getTotalQuestionsForList(profileId, phoneNumber, listenAndSpeakLessonIds);

    // Get lessonIds for watchAndSpeak of that week
    const watchAndSpeakLessonIds = await lessonRepository.getLessonIdsByCourseAndWeekAndActivityType(courseId, weekNumber, 'watchAndSpeak');
    const correctWatchAndSpeak = await waQuestionResponsesRepository.watchAndSpeakScoreForList(profileId, phoneNumber, watchAndSpeakLessonIds);

    // Get lessonIds for read of that week
    const readLessonIds = await lessonRepository.getLessonIdsByCourseAndWeekAndActivityType(courseId, weekNumber, 'read');
    const correctRead = await waQuestionResponsesRepository.readScoreForList(profileId, phoneNumber, readLessonIds);

    // Get lessonIds for conversationalMonologueBot of that week
    const monologueLessonIds = await lessonRepository.getLessonIdsByCourseAndWeekAndActivityType(courseId, weekNumber, 'conversationalMonologueBot');
    const correctMonologue = await waQuestionResponsesRepository.monologueScoreForList(profileId, phoneNumber, monologueLessonIds);

    // Get lessonIds for speakingPractice of that week
    const speakingPracticeLessonIds = await lessonRepository.getLessonIdsByCourseAndWeekAndActivityType(courseId, weekNumber, 'speakingPractice');
    const correctSpeakingPractice = await waQuestionResponsesRepository.monologueScoreForList(profileId, phoneNumber, speakingPracticeLessonIds);

    // Calculate sum of scores and sum of total scores and give percentage out of 100
    const totalScore = correctMcqs + correctListenAndSpeak + correctWatchAndSpeak.score + correctRead.score + correctMonologue.score + correctSpeakingPractice.score;
    const totalQuestions = totalMcqs + totalListenAndSpeak + correctWatchAndSpeak.total + correctRead.total + correctMonologue.total + correctSpeakingPractice.total;
    const percentage = Math.round((totalScore / totalQuestions) * 100);
    return percentage;
};

const getNextCourse = async (userProfileId) => {
    const purchaseCourses = await waPurchasedCoursesRepository.getPurchasedCoursesByProfileId(userProfileId);
    const courses = await courseRepository.getAll();
    const startedCourses = await waLessonsCompletedRepository.getUniqueStartedCoursesByProfileId(userProfileId);
    const notCompletedPurchasedCourse = purchaseCourses.filter(course => !startedCourses.includes(course.dataValues.courseId));
    if (notCompletedPurchasedCourse.length > 0) {
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

const startCourseForUser = async (profileId, userMobileNumber, numbers_to_ignore) => {
    const nextCourse = await getNextCourse(profileId);
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
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Course Start");

    // Update user progress
    await waUserProgressRepository.update(
        profileId,
        userMobileNumber,
        nextCourse.dataValues.courseId,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null
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
        const demoVideo = await waConstantsRepository.getByKey("DEMO_VIDEO");
        await sendMediaMessage(userMobileNumber, demoVideo.dataValues.constantValue, 'video', null, 0, "WA_Constants", demoVideo.dataValues.id, demoVideo.dataValues.constantMediaId, "constantMediaId");
        await createActivityLog(userMobileNumber, "video", "outbound", demoVideo.dataValues.constantValue, null);
        await sleep(12000);
    }

    // Send Button Message
    // "Are you ready to start level"
    await sendButtonMessage(userMobileNumber, "Are you ready to start " + level + "?", [{ id: "lets_start", title: "Start" }]);
    await createActivityLog(userMobileNumber, "template", "outbound", "Are you ready to start " + level + "?", null);

    // Update acceptable messages list for the user
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start"]);
    return;
};

const levelCourseStart = async (profileId, userMobileNumber, startingLesson, courseId) => {
    // Update user progress
    await waUserProgressRepository.update(
        profileId,
        userMobileNumber,
        courseId,
        startingLesson.dataValues.weekNumber,
        startingLesson.dataValues.dayNumber,
        startingLesson.dataValues.LessonId,
        startingLesson.dataValues.SequenceNumber,
        startingLesson.dataValues.activity,
        null,
        null,
        null
    );

    // Extract Level from courseName using courseId
    const courseName = await courseRepository.getCourseNameById(courseId);
    const level = courseName.split("-")[0].trim();


    // Text Message
    await sendMessage(userMobileNumber, "Great! Let's start " + level + "! 🤩");
    await createActivityLog(userMobileNumber, "text", "outbound", "Great! Let's start " + level + "! 🤩", null);
    return;
};

const sendCourseLessonToTeacher = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (activity == 'video') {
            await videoView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'videoEnd') {
            await videoEndView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'mcqs') {
            await mcqsView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'watchAndSpeak') {
            await watchAndSpeakView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'watchAndAudio') {
            await watchAndAudioView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'watchAndImage') {
            await watchAndImageView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'listenAndSpeak') {
            await listenAndSpeakView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'read') {
            await readView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'conversationalQuestionsBot') {
            await conversationalQuestionsBotView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'conversationalMonologueBot') {
            await conversationalMonologueBotView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'conversationalAgencyBot') {
            await conversationalAgencyBotView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'speakingPractice') {
            await speakingPracticeView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'feedbackAudio') {
            await feedbackAudioView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'feedbackMcqs') {
            await feedbackMcqsView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }

    } catch (error) {
        console.log('Error sending lesson to user:', error);
        error.fileName = 'chatBotService.js';
        throw error;
    }
};

const sendCourseLessonToKid = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (activity == 'video') {
            await videoView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'videoEnd') {
            await videoEndView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'mcqs') {
            await mcqsView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'watchAndSpeak') {
            await watchAndSpeakView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'listenAndSpeak') {
            await listenAndSpeakView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'read') {
            await readView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'speakingPractice') {
            await speakingPracticeView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
    } catch (error) {
        console.log('Error sending lesson to user:', error);
        error.fileName = 'chatBotService.js';
        throw error;
    }
};

export {
    removeUser,
    getNextCourse,
    startCourseForUser,
    levelCourseStart,
    sendCourseLessonToTeacher,
    sendCourseLessonToKid,
    weekEndScoreCalculation,
    removeUserTillCourse
};