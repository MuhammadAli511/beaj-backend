import dotenv from "dotenv";
import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";
import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import waConstantsRepository from "../repositories/waConstantsRepository.js";
import waPurchasedCoursesRepository from "../repositories/waPurchasedCoursesRepository.js";
import { removeUser, startCourseForUser, levelCourseStart, sendCourseLessonToTeacher, sendCourseLessonToKid, removeUserTillCourse, } from "../utils/chatbotUtils.js";
import {
    demoCourseStart,
    greetingMessage,
    kidsChooseClass,
    kidsConfirmClass,
    kidsChooseClassLoop,
    endTrial,
    greetingMessageLoop,
    getSchoolName,
    confirmSchoolName,
    thankyouMessage
} from "../utils/trialflowUtils.js";
import { sendMessage, sendButtonMessage, retrieveMediaURL } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { createFeedback } from "../utils/createFeedbackUtils.js";
import { checkUserMessageAndAcceptableMessages, getAcceptableMessagesList } from "../utils/utils.js";
import { runWithContext } from "../utils/requestContext.js";

dotenv.config();
const whatsappVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

let activity_types_to_repeat = [
    "mcqs",
    "watchAndSpeak",
    "listenAndSpeak",
    "read",
    "conversationalQuestionsBot",
    "conversationalMonologueBot",
    "speakingPractice",
    "conversationalAgencyBot",
    "watchAndAudio",
    "watchAndImage",
];

let text_message_types = [
    "text",
    "interactive",
    "button"
];

const verifyWebhookService = async (req, res) => {
    try {
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];

        if (mode && token === whatsappVerifyToken) {
            console.log("Webhook verified");
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } catch (error) {
        console.error("Error in verifyWebhookService:", error);
        error.fileName = "chatBotService.js";
        throw error;
    }
};

const uploadUserDataService = async (users) => {
    let count = 0;
    const t1Course = await courseRepository.getCourseByCourseName("Level 1 - T1 - January 27, 2025");
    const t2Course = await courseRepository.getCourseByCourseName("Level 1 - T2 - January 27, 2025");
    if (!t1Course || !t2Course) {
        throw new Error("Course not found");
    }
    for (const user of users) {
        const newPhoneNumber = user.phone_number;
        const userExists = await waUsersMetadataRepository.getByPhoneNumber(newPhoneNumber);
        if (userExists) {
            console.log(`${newPhoneNumber}`);
            continue;
        }
        await waUsersMetadataRepository.create({
            phoneNumber: newPhoneNumber,
            userClickedLink: new Date(),
            userRegistrationComplete: new Date(),
            name: user.s0_name,
            targetGroup: user["Target.Group"],
            cohort: user.cohort_assignment,
            isTeacher: user.school_role == "Teacher" || user.school_role == "Both" ? "Yes" : "No",
            schoolName: user.schoolname,
        });
        await waUserProgressRepository.create({
            phoneNumber: newPhoneNumber,
            persona: user.school_role,
            engagement_type: "",
            acceptableMessages: ["start my course"],
            lastUpdated: new Date(),
        });
        if (user["Target.Group"] == "T1" || user["Target.Group"] == "T2") {
            await waPurchasedCoursesRepository.create({
                phoneNumber: newPhoneNumber,
                courseId: user["Target.Group"] == "T1" ? t1Course.dataValues.CourseId : t2Course.dataValues.CourseId,
                courseCategoryId: user["Target.Group"] == "T1" ? t1Course.dataValues.CourseCategoryId : t2Course.dataValues.CourseCategoryId,
                courseStartDate: new Date(),
                purchaseDate: new Date(),
            });
        }
        count++;
        // console.log(`${count}`);
    }
    return count;
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
            const botPhoneNumberId = body.entry[0].changes[0].value.metadata.phone_number_id;
            if (botPhoneNumberId == null) {
                console.log("Bot phone number id is null");
                return;
            }

            // Wrap the webhook handling logic with the context containing the bot phone number ID
            await runWithContext({ botPhoneNumberId }, async () => {
                const message = body.entry[0].changes[0].value.messages[0];
                const userMobileNumber = "+" + message.from;
                let messageContent;
                let messageType = message.type;
                let logger = `Inbound Message: User: ${userMobileNumber}, Bot ID: ${botPhoneNumberId}, Message Type: ${message.type}, Message Content: ${message.text?.body ||
                    message.image?.id || message.audio?.id || message.video?.id || message.interactive?.button_reply?.title || message.button?.text}`;
                console.log(logger);

                if (message.type === "image") {
                    createActivityLog(userMobileNumber, "image", "inbound", message, null);
                    messageContent = await retrieveMediaURL(message.image.id);
                } else if (message.type === "audio") {
                    createActivityLog(userMobileNumber, "audio", "inbound", message, null);
                    messageContent = await retrieveMediaURL(message.audio.id);
                } else if (message.type === "video") {
                    createActivityLog(userMobileNumber, "video", "inbound", message, null);
                    messageContent = await retrieveMediaURL(message.video.id);
                } else if (message.type === "text") {
                    messageContent = message.text?.body.toLowerCase().trim() || "";
                    createActivityLog(userMobileNumber, "text", "inbound", message.text?.body, null);
                } else if (message.type === "interactive") {
                    messageContent = message.interactive.button_reply.title.toLowerCase().trim();
                    createActivityLog(userMobileNumber, "template", "inbound", messageContent, null);
                } else if (message.type == "button") {
                    messageContent = message.button.text.toLowerCase().trim();
                    createActivityLog(userMobileNumber, "template", "inbound", messageContent, null);
                } else {
                    return;
                }

                const botStatus = await waConstantsRepository.getByKey("BOT_STATUS");
                if (!botStatus || botStatus.dataValues.constantValue != "Active") {
                    await sendMessage(userMobileNumber, "Sorry, We are currently not accepting any messages. Please try again later.");
                    await createActivityLog(userMobileNumber, "text", "outbound", "Sorry, We are currently not accepting any messages. Please try again later.", null);
                    return;
                }

                // Check if user exists in the database
                let user = await waUsersMetadataRepository.getByPhoneNumber(userMobileNumber);
                let currentUserState = await waUserProgressRepository.getByPhoneNumber(userMobileNumber);

                // If message is reset, delete user from database
                if (text_message_types.includes(message.type) && messageContent.toLowerCase() == "reset course") {
                    await removeUserTillCourse(userMobileNumber);
                    return;
                }

                // If message is reset, delete user from database
                if (text_message_types.includes(message.type) && messageContent.toLowerCase() == "reset all") {
                    await removeUser(userMobileNumber);
                    return;
                }

                // DEMO COURSE
                // Step 1: If user does not exist
                if (!user) {
                    await waUsersMetadataRepository.create({ phoneNumber: userMobileNumber, userClickedLink: new Date(), });
                    await greetingMessage(userMobileNumber);
                    return;
                }

                if (user && currentUserState) {
                    const messageAuth = await checkUserMessageAndAcceptableMessages(userMobileNumber, currentUserState, messageType, messageContent);
                    if (messageAuth === false) {
                        return;
                    }
                }

                // DEMO COURSE
                // Kids Summer Camp Trial
                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "kids summer camp") &&
                    (currentUserState.dataValues.engagement_type == "Greeting Message")
                ) {
                    await kidsChooseClass(userMobileNumber);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    ((messageContent.toLowerCase() == "grade 1 or 2") || (messageContent.toLowerCase() == "grades 3 to 6")) &&
                    (currentUserState.dataValues.engagement_type == "Choose Class")
                ) {
                    await kidsConfirmClass(userMobileNumber, messageContent);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "no, choose again") &&
                    (currentUserState.dataValues.engagement_type == "Confirm Class - Level 1" || currentUserState.dataValues.engagement_type == "Confirm Class - Level 3")
                ) {
                    await kidsChooseClassLoop(userMobileNumber);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "end now") &&
                    (currentUserState.dataValues.engagement_type == "Free Trial - Teachers" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3")
                ) {
                    await endTrial(userMobileNumber);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "get another trial") &&
                    (currentUserState.dataValues.engagement_type == "End Now" || currentUserState.dataValues.engagement_type == "Free Trial - Teachers" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3")
                ) {
                    await greetingMessageLoop(userMobileNumber);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "register") &&
                    (currentUserState.dataValues.engagement_type == "End Now" || currentUserState.dataValues.engagement_type == "Free Trial - Teachers" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3")
                ) {
                    await getSchoolName(userMobileNumber);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (currentUserState.dataValues.engagement_type == "School Name")
                ) {
                    await confirmSchoolName(userMobileNumber, messageContent);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "yes") &&
                    (currentUserState.dataValues.engagement_type == "Confirm School Name")
                ) {
                    await thankyouMessage(userMobileNumber);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "no") &&
                    (currentUserState.dataValues.engagement_type == "Confirm School Name")
                ) {
                    await getSchoolName(userMobileNumber);
                    return;
                }

                if (currentUserState.dataValues.engagement_type == "Thankyou Message") {
                    if (messageContent.toLowerCase() == "get another trial") {
                        await greetingMessageLoop(userMobileNumber);
                        return;
                    } else {
                        await sendMessage(userMobileNumber, "Your free trial is complete. We will get back to you soon.");
                        return;
                    }
                }

                // Teacher Training Trial
                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "teacher training" || messageContent.toLowerCase() == "start free trial") &&
                    (currentUserState.dataValues.engagement_type == "Greeting Message" || currentUserState.dataValues.engagement_type == "Confirm Class - Level 1" || currentUserState.dataValues.engagement_type == "Confirm Class - Level 3")
                ) {
                    if (user.dataValues.freeDemoStarted == null) {
                        await waUsersMetadataRepository.update(userMobileNumber, { freeDemoStarted: new Date() });
                    }

                    let courseName = "";
                    if (currentUserState.dataValues.engagement_type == "Confirm Class - Level 1") {
                        courseName = "Free Trial - Kids - Level 1";
                    } else if (currentUserState.dataValues.engagement_type == "Confirm Class - Level 3") {
                        courseName = "Free Trial - Kids - Level 3";
                    } else {
                        courseName = "Free Trial - Teachers";
                    }

                    // Delete all question responses for the user
                    await waQuestionResponsesRepository.deleteByPhoneNumber(userMobileNumber);
                    const startingLesson = await lessonRepository.getNextLesson(await courseRepository.getCourseIdByName(courseName), 1, null, null);
                    await demoCourseStart(userMobileNumber, startingLesson, courseName);
                    // Send first lesson to user
                    currentUserState = await waUserProgressRepository.getByPhoneNumber(userMobileNumber);
                    if (courseName == "Free Trial - Teachers") {
                        await sendCourseLessonToTeacher(userMobileNumber, currentUserState, startingLesson, messageType, messageContent);
                    } else {
                        await sendCourseLessonToKid(userMobileNumber, currentUserState, startingLesson, messageType, messageContent);
                    }
                    if (startingLesson.dataValues.activity == "video") {
                        const nextLesson = await lessonRepository.getNextLesson(
                            currentUserState.dataValues.currentCourseId,
                            currentUserState.dataValues.currentWeek,
                            currentUserState.dataValues.currentDay,
                            currentUserState.dataValues.currentLesson_sequence
                        );

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
                        if (courseName == "Free Trial - Teachers") {
                            await sendCourseLessonToTeacher(userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
                        } else {
                            await sendCourseLessonToKid(userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
                        }
                    }
                    return;

                }

                // If user completes an activity and wants to try the next activity
                if (text_message_types.includes(message.type)) {
                    if (messageContent.toLowerCase().includes("start next activity") || messageContent.toLowerCase().includes("next challenge") || messageContent.toLowerCase().includes("start challenge") || messageContent.toLowerCase().includes("next")) {
                        if (currentUserState.dataValues.engagement_type == "Free Trial - Teachers" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                            // Get next lesson to send user
                            const nextLesson = await lessonRepository.getNextLesson(
                                currentUserState.dataValues.currentCourseId,
                                currentUserState.dataValues.currentWeek,
                                currentUserState.dataValues.currentDay,
                                currentUserState.dataValues.currentLesson_sequence
                            );

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
                            let latestUserState = await waUserProgressRepository.getByPhoneNumber(userMobileNumber);

                            // Send next lesson to user
                            if (currentUserState.dataValues.engagement_type == "Free Trial - Teachers") {
                                await sendCourseLessonToTeacher(userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
                            } else {
                                await sendCourseLessonToKid(userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
                            }

                            if (nextLesson.dataValues.activity == "video") {
                                const nextLesson = await lessonRepository.getNextLesson(
                                    latestUserState.dataValues.currentCourseId,
                                    latestUserState.dataValues.currentWeek,
                                    latestUserState.dataValues.currentDay,
                                    latestUserState.dataValues.currentLesson_sequence
                                );

                                // Mark previous lesson as completed
                                const currentLesson = await lessonRepository.getCurrentLesson(latestUserState.dataValues.currentLessonId);
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
                                latestUserState = await waUserProgressRepository.getByPhoneNumber(userMobileNumber);

                                // Send next lesson to user
                                if (currentUserState.dataValues.engagement_type == "Free Trial - Teachers") {
                                    await sendCourseLessonToTeacher(userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
                                } else {
                                    await sendCourseLessonToKid(userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
                                }
                            }
                            return;
                        }
                    }
                }

                // Teacher Training Trial
                // Kids Summer Camp Trial
                if (
                    currentUserState.dataValues.activityType && activity_types_to_repeat.includes(currentUserState.dataValues.activityType)
                ) {
                    if (currentUserState.dataValues.engagement_type == "Free Trial - Teachers" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                        // Get the current lesson for next question
                        const currentLesson = await lessonRepository.getCurrentLesson(currentUserState.dataValues.currentLessonId);

                        // Get acceptable messages for the next question
                        const acceptableMessagesList = await getAcceptableMessagesList(currentLesson.dataValues.activity);

                        // Update acceptable messages list for the user
                        await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, acceptableMessagesList);

                        // Update user progress to next question
                        if (currentUserState.dataValues.engagement_type == "Free Trial - Teachers") {
                            await sendCourseLessonToTeacher(userMobileNumber, currentUserState, currentLesson, messageType, messageContent);
                        } else {
                            await sendCourseLessonToKid(userMobileNumber, currentUserState, currentLesson, messageType, messageContent);
                        }
                        return;
                    }
                }

                let numbers_to_ignore = [
                    "+923008400080",
                    "+923303418882",
                    "+923345520552",
                    "+923225036358",
                    "+923365560202",
                    "+923328251950",
                    "+923225812411",
                    "+923232658153",
                    "+923390001510",
                    "+923288954660",
                    "+923704558660"
                ];

                // START MAIN COURSE
                if (
                    text_message_types.includes(message.type) &&
                    messageContent.toLowerCase().includes("start my course")
                ) {
                    await startCourseForUser(userMobileNumber, numbers_to_ignore);
                    return;
                }

                // NORMAL COURSE
                currentUserState = await waUserProgressRepository.getByPhoneNumber(
                    userMobileNumber
                );
                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "start" || messageContent.toLowerCase() == "start!")
                ) {
                    if (currentUserState.dataValues.engagement_type == "Course Start") {
                        const startingLesson = await lessonRepository.getNextLesson(currentUserState.dataValues.currentCourseId, 1, null, null);
                        await levelCourseStart(userMobileNumber, startingLesson, currentUserState.dataValues.currentCourseId);
                        // Send first lesson to user
                        currentUserState = await waUserProgressRepository.getByPhoneNumber(userMobileNumber);
                        await sendCourseLessonToTeacher(userMobileNumber, currentUserState, startingLesson, messageType, messageContent);
                        if (startingLesson.dataValues.activity == "video") {
                            const nextLesson = await lessonRepository.getNextLesson(
                                currentUserState.dataValues.currentCourseId,
                                currentUserState.dataValues.currentWeek,
                                currentUserState.dataValues.currentDay,
                                currentUserState.dataValues.currentLesson_sequence
                            );

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
                            await sendCourseLessonToTeacher(userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
                        }
                        return;
                    }
                }

                if (text_message_types.includes(message.type) && currentUserState.dataValues.activityType == "watchAndSpeak") {
                    const currentLesson = await lessonRepository.getCurrentLesson(currentUserState.dataValues.currentLessonId);
                    if (messageContent.toLowerCase().includes("yes") || messageContent.toLowerCase().includes("no")) {
                        await sendCourseLessonToTeacher(userMobileNumber, currentUserState, currentLesson, messageType, messageContent);
                        return;
                    }
                }


                if (text_message_types.includes(message.type)) {
                    if (
                        messageContent.toLowerCase().includes("start next activity") ||
                        messageContent.toLowerCase().includes("start next lesson") ||
                        messageContent.toLowerCase().includes("it was great") ||
                        messageContent.toLowerCase().includes("it was great 😁") ||
                        messageContent.toLowerCase().includes("it can be improved") ||
                        messageContent.toLowerCase().includes("it can be improved 🤔") ||
                        messageContent.toLowerCase().includes("yes") ||
                        messageContent.toLowerCase().includes("no, try again") ||
                        messageContent.toLowerCase().includes("no")
                    ) {
                        if (
                            messageContent.toLowerCase().includes("it was great") ||
                            messageContent.toLowerCase().includes("it was great 😁") ||
                            messageContent.toLowerCase().includes("it can be improved") ||
                            messageContent.toLowerCase().includes("it can be improved 🤔")
                        ) {
                            await createFeedback(userMobileNumber, messageContent);
                            return;
                        }
                        // Get next lesson to send user
                        const nextLesson = await lessonRepository.getNextLesson(
                            currentUserState.dataValues.currentCourseId,
                            currentUserState.dataValues.currentWeek,
                            currentUserState.dataValues.currentDay,
                            currentUserState.dataValues.currentLesson_sequence
                        );

                        if (!nextLesson) {
                            // Check if current lesson
                            const lessonNumberCheck = (currentUserState.dataValues.currentWeek - 1) * 6 + currentUserState.dataValues.currentDay;
                            if (lessonNumberCheck >= 24) {
                                await sendButtonMessage(userMobileNumber, 'You have completed all the lessons in this course. Click the button below to proceed', [{ id: 'start_my_course', title: 'Start my course' }]);
                                await createActivityLog(userMobileNumber, "template", "outbound", "You have completed all the lessons in this course. Click the button below to proceed", null);
                                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start my course"]);
                                return;
                            }
                            await sendMessage(userMobileNumber, "Please wait for the next lesson to start.");
                            await createActivityLog(userMobileNumber, "text", "outbound", "Please wait for the next lesson to start.", null);
                            return;
                        }

                        // Daily blocking
                        if (!numbers_to_ignore.includes(userMobileNumber)) {
                            const course = await courseRepository.getById(
                                currentUserState.dataValues.currentCourseId
                            );
                            const courseStartDate = new Date(course.dataValues.courseStartDate);
                            const today = new Date();

                            // Calculate the number of days from the start date needed for the current day's content
                            const lessonDayNumber = (nextLesson.dataValues.weekNumber - 1) * 6 + nextLesson.dataValues.dayNumber;
                            const daysRequiredForCurrentLesson = lessonDayNumber - 1; // As before

                            // Add days to course start date, skipping Sundays
                            let dayUnlockDate = new Date(courseStartDate);
                            let daysAdded = 0;

                            while (daysAdded < daysRequiredForCurrentLesson) {
                                dayUnlockDate.setDate(dayUnlockDate.getDate() + 1);
                                if (dayUnlockDate.getDay() !== 0) {
                                    daysAdded++;
                                }
                            }

                            // Extract year, month, and date for comparison
                            const todayYear = today.getFullYear();
                            const todayMonth = today.getMonth();
                            const todayDate = today.getDate();

                            const dayUnlockDateYear = dayUnlockDate.getFullYear();
                            const dayUnlockDateMonth = dayUnlockDate.getMonth();
                            const dayUnlockDateDate = dayUnlockDate.getDate();

                            // Check if today is before the unlock date
                            if (
                                todayYear < dayUnlockDateYear ||
                                (todayYear == dayUnlockDateYear &&
                                    todayMonth < dayUnlockDateMonth) ||
                                (todayYear == dayUnlockDateYear &&
                                    todayMonth == dayUnlockDateMonth &&
                                    todayDate < dayUnlockDateDate)
                            ) {
                                const message = "Please wait for the next day's content to unlock.";
                                await sendMessage(userMobileNumber, message);
                                await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                                return;
                            }
                        }

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
                        let latestUserState = await waUserProgressRepository.getByPhoneNumber(userMobileNumber);

                        // Send next lesson to user
                        await sendCourseLessonToTeacher(userMobileNumber, latestUserState, nextLesson, messageType, messageContent);

                        if (nextLesson.dataValues.activity == "video") {
                            const nextLesson = await lessonRepository.getNextLesson(
                                latestUserState.dataValues.currentCourseId,
                                latestUserState.dataValues.currentWeek,
                                latestUserState.dataValues.currentDay,
                                latestUserState.dataValues.currentLesson_sequence
                            );

                            // Mark previous lesson as completed
                            const currentLesson = await lessonRepository.getCurrentLesson(latestUserState.dataValues.currentLessonId);
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
                            latestUserState = await waUserProgressRepository.getByPhoneNumber(userMobileNumber);

                            // Send next lesson to user
                            await sendCourseLessonToTeacher(userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
                        }
                        return;
                    }
                }
                if (
                    currentUserState.dataValues.activityType && activity_types_to_repeat.includes(currentUserState.dataValues.activityType)
                ) {
                    // Get the current lesson for next question
                    const currentLesson = await lessonRepository.getCurrentLesson(currentUserState.dataValues.currentLessonId);

                    // Get acceptable messages for the next question
                    const acceptableMessagesList = await getAcceptableMessagesList(currentLesson.dataValues.activity);

                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, acceptableMessagesList);

                    // Update user progress to next question
                    await sendCourseLessonToTeacher(userMobileNumber, currentUserState, currentLesson, messageType, messageContent);
                    return;
                }
            });
        }
    } catch (error) {
        console.error("Error in chatBotService:", error);
        error.fileName = "chatBotService.js";
        throw error;
    }
};

export default { webhookService, verifyWebhookService, uploadUserDataService };
