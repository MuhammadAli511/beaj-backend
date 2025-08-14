import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";
import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import waConstantsRepository from "../repositories/waConstantsRepository.js";
import waActiveSessionRepository from "../repositories/waActiveSessionRepository.js";
import waProfileRepository from "../repositories/waProfileRepository.js";
import { startCourseForUser, sendCourseLesson, talkToBeajRep } from "../utils/chatbotUtils.js";
import { demoCourseStart } from "../utils/trialflowUtils.js";
import { sendMessage, sendButtonMessage, retrieveMediaURL, sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { createFeedback } from "../utils/createFeedbackUtils.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import { checkUserMessageAndAcceptableMessages, getAcceptableMessagesList, sleep, getDaysPerWeek, getTotalLessonsForCourse, getLevelFromCourseName } from "../utils/utils.js";
import { runWithContext } from "../utils/requestContext.js";
import {
    activity_types_to_repeat, text_message_types, beaj_team_numbers, feedback_acceptable_messages,
    next_activity_acceptable_messages, special_commands, talk_to_beaj_rep_messages
} from "../constants/constants.js";
import { specialCommandFlow } from "../flows/specialCommandFlows.js";
import { marketingBotFlow } from "../flows/marketingBotFlows.js";
import teachersTrialFlowDriver from "../flows/teacherTrialFlow.js";
import kidsTrialFlowDriver from "../flows/kidsTrialFlow.js";
import { chooseProfileFlow, userSwitchingFlow } from "../flows/profileFlows.js";
import dotenv from 'dotenv';
dotenv.config();
const whatsappVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
const studentBotPhoneNumberId = process.env.STUDENT_BOT_PHONE_NUMBER_ID;
const teacherBotPhoneNumberId = process.env.TEACHER_BOT_PHONE_NUMBER_ID;
const marketingBotPhoneNumberId = process.env.MARKETING_BOT_PHONE_NUMBER_ID;


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

const getCombinedUserDataService = async () => {
    return await waUsersMetadataRepository.getCombinedUserData();
};

const webhookService = async (body, res) => {
    try {
        res.sendStatus(200);
        if (
            body.entry?.[0]?.changes?.[0]?.value?.messages &&
            body.entry[0].changes[0].value.statuses == undefined
        ) {
            const botPhoneNumberId = body.entry[0].changes[0].value.metadata.phone_number_id;
            if (botPhoneNumberId == null || botPhoneNumberId == undefined || botPhoneNumberId == "") {
                console.log("Bot phone number id is null");
                return;
            }

            const message = body.entry[0].changes[0].value.messages[0];
            const userMobileNumber = "+" + message.from;
            const activeSession = await waActiveSessionRepository.getByPhoneNumberAndBotPhoneNumberId(userMobileNumber, botPhoneNumberId);
            const userProfileExists = await waProfileRepository.getByPhoneNumberAndBotPhoneNumberId(userMobileNumber, botPhoneNumberId);
            let profileId = null;
            let userExists = false;
            let chooseProfile = false;
            if (activeSession) {
                profileId = activeSession.dataValues.profile_id;
                userExists = true;
            }
            else if (!activeSession && !userProfileExists) {
                let profile_type = "";
                if (botPhoneNumberId == teacherBotPhoneNumberId) {
                    profile_type = "teacher";
                } else if (botPhoneNumberId == studentBotPhoneNumberId) {
                    profile_type = "student";
                } else if (botPhoneNumberId == marketingBotPhoneNumberId) {
                    profile_type = "marketing";
                } else {
                    throw new Error(`Unhandled botPhoneNumberId ${botPhoneNumberId}`);
                }
                let profile = await waProfileRepository.create({
                    phone_number: userMobileNumber,
                    bot_phone_number_id: botPhoneNumberId,
                    profile_type: profile_type
                });
                profileId = profile.dataValues.profile_id;
                await waUsersMetadataRepository.create({ profile_id: profileId, phoneNumber: userMobileNumber, userClickedLink: new Date() });
                await waActiveSessionRepository.create({ phone_number: userMobileNumber, bot_phone_number_id: botPhoneNumberId, profile_id: profileId });
                userExists = false;
            } else {
                const profiles = await waProfileRepository.getAllSortOnProfileId(userMobileNumber);
                profileId = profiles[0].dataValues.profile_id;
                chooseProfile = true;
            }

            let messageContent;
            let buttonId = null;
            let messageType = message.type;
            let logger = `Inbound Message: User: ${userMobileNumber}, Bot ID: ${botPhoneNumberId}, Message Type: ${message.type}, Message Content: ${message.text?.body ||
                message.image?.id || message.audio?.id || message.video?.id || message.interactive?.button_reply?.title || message.button?.text}`;
            console.log(logger);

            // Wrap the webhook handling logic with the context containing the bot phone number ID
            await runWithContext({ botPhoneNumberId, profileId, userMobileNumber }, async () => {
                // INBOUND MESSAGES LOGGING
                let inboundUploadedImage = null;
                if (message.type === "image") {
                    inboundUploadedImage = await createActivityLog(userMobileNumber, "image", "inbound", message, null);
                    messageContent = await retrieveMediaURL(message.image.id);
                } else if (message.type === "audio") {
                    await createActivityLog(userMobileNumber, "audio", "inbound", message, null);
                    messageContent = await retrieveMediaURL(message.audio.id);
                } else if (message.type === "video") {
                    await createActivityLog(userMobileNumber, "video", "inbound", message, null);
                    messageContent = await retrieveMediaURL(message.video.id);
                } else if (message.type === "text") {
                    messageContent = message.text?.body.toLowerCase().trim() || "";
                    createActivityLog(userMobileNumber, "text", "inbound", message.text?.body, null);
                } else if (message.type === "interactive") {
                    messageContent = message.interactive.button_reply.title.toLowerCase().trim();
                    buttonId = message.interactive.button_reply.id;
                    createActivityLog(userMobileNumber, "template", "inbound", messageContent, null);
                } else if (message.type == "button") {
                    messageContent = message.button.text.toLowerCase().trim();
                    createActivityLog(userMobileNumber, "template", "inbound", messageContent, null);
                } else {
                    return;
                }

                // CHECKING IF BOT IS ACTIVE
                const botStatus = await waConstantsRepository.getByKey("BOT_STATUS");
                if (!botStatus || botStatus.dataValues.constantValue != "Active") {
                    await sendMessage(userMobileNumber, "Sorry, We are currently not accepting any messages. Please try again later.");
                    await createActivityLog(userMobileNumber, "text", "outbound", "Sorry, We are currently not accepting any messages. Please try again later.", null);
                    return;
                }

                // SPECIAL COMMANDS
                if (special_commands.includes(messageContent.toLowerCase()) && message.type == "text") {
                    await specialCommandFlow(profileId, userMobileNumber, messageContent);
                    return;
                };

                // MARKETING BOT
                if (botPhoneNumberId == marketingBotPhoneNumberId) {
                    await marketingBotFlow(profileId, messageContent, messageType, userMobileNumber);
                    return;
                }

                // CHECKING FOR ACCEPTABLE MESSAGES
                if (currentUserState) {
                    const messageAuth = await checkUserMessageAndAcceptableMessages(profileId, userMobileNumber, currentUserState, messageType, messageContent);
                    if (messageAuth === false) {
                        return;
                    }
                }

                // CHOOSING PROFILE FLOW
                if ((chooseProfile) || (text_message_types.includes(message.type) && messageContent.toLowerCase().includes("change user"))) {
                    await chooseProfileFlow(profileId, userMobileNumber, botPhoneNumberId, chooseProfile);
                    return;
                }

                // USER SWITCHING FLOW
                if (currentUserState && currentUserState.dataValues.engagement_type == "Choose User") {
                    await userSwitchingFlow(profileId, userMobileNumber, botPhoneNumberId, messageContent, activeSession);
                    return;
                }

                // TALK TO BEAJ REP
                if (text_message_types.includes(message.type) && talk_to_beaj_rep_messages.includes(messageContent.toLowerCase())) {
                    await talkToBeajRep(profileId, userMobileNumber);
                    return;
                }

                // GETTING CURRENT USER STATE
                let currentUserState = await waUserProgressRepository.getByProfileId(profileId);
                let currentUserMetadata = await waUsersMetadataRepository.getByProfileId(profileId);
                let persona = currentUserState.dataValues.persona == "kid" || currentUserState.dataValues.persona == "parent or student" || currentUserState.dataValues.persona == "school admin" ? "kid" : "teacher";

                // TRIAL FLOW ROUTING
                if (!userExists) {
                    if (botPhoneNumberId == studentBotPhoneNumberId) {
                        await kidsTrialFlowDriver(profileId, userMobileNumber, "New User", messageContent, messageType, inboundUploadedImage);
                    } else {
                        await teachersTrialFlowDriver(profileId, userMobileNumber, "New User", messageContent, messageType, inboundUploadedImage);
                    }
                    return;
                } else if (currentUserState.dataValues.engagement_type != "Course Start") {
                    const messageAuth = await checkUserMessageAndAcceptableMessages(profileId, userMobileNumber, currentUserState, messageType, messageContent);
                    if (messageAuth === false) {
                        return;
                    }
                    if (botPhoneNumberId == studentBotPhoneNumberId) {
                        await kidsTrialFlowDriver(profileId, userMobileNumber, currentUserState.dataValues.engagement_type, messageContent, messageType, inboundUploadedImage);
                    } else {
                        await teachersTrialFlowDriver(profileId, userMobileNumber, currentUserState.dataValues.engagement_type, messageContent, messageType, inboundUploadedImage);
                    }
                    return;
                }


                // MAIN COURSE START FLOW - SENDING "START"
                if (text_message_types.includes(message.type) && start_course_acceptable_messages.includes(messageContent.toLowerCase())) {
                    await startCourseForUser(profileId, userMobileNumber, beaj_team_numbers);
                    return;
                }



                // TRIAL START FLOW
                if (
                    text_message_types.includes(message.type) &&
                    (
                        messageContent.toLowerCase() == "start" ||
                        messageContent.toLowerCase() == "start free trial" ||
                        messageContent.toLowerCase() == "class 1 or 2" ||
                        messageContent.toLowerCase() == "class 3 to 6"
                    ) &&
                    (
                        currentUserState.dataValues.engagement_type == "Greeting Message" ||
                        currentUserState.dataValues.engagement_type == "Confirm Class - Level 1" ||
                        currentUserState.dataValues.engagement_type == "Confirm Class - Level 3" ||
                        currentUserState.dataValues.engagement_type == "Choose Class"
                    )
                ) {
                    await waUsersMetadataRepository.updateFreeDemoStarted(profileId, userMobileNumber);

                    let courseName = "";
                    if (currentUserState.dataValues.engagement_type == "Choose Class" || currentUserState.dataValues.engagement_type == "Confirm Class - Level 1" || currentUserState.dataValues.engagement_type == "Confirm Class - Level 3") {
                        if (messageContent.toLowerCase() == "class 1 or 2") {
                            courseName = "Free Trial - Kids - Level 1";
                        } else if (messageContent.toLowerCase() == "class 3 to 6") {
                            courseName = "Free Trial - Kids - Level 3";
                        }
                        persona = "kid";
                    } else {
                        courseName = "Free Trial - Teachers";
                        persona = "teacher";
                    }

                    // Delete all question responses for the user
                    await waQuestionResponsesRepository.deleteByProfileId(profileId);
                    const startingLesson = await lessonRepository.getNextLesson(await courseRepository.getCourseIdByName(courseName), 1, null, null);
                    await demoCourseStart(profileId, userMobileNumber, startingLesson, courseName);
                    // Send first lesson to user
                    currentUserState = await waUserProgressRepository.getByProfileId(profileId);
                    await sendCourseLesson(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona, buttonId);
                    if (startingLesson.dataValues.activity == "video") {
                        const nextLesson = await lessonRepository.getNextLesson(
                            currentUserState.dataValues.currentCourseId,
                            currentUserState.dataValues.currentWeek,
                            currentUserState.dataValues.currentDay,
                            currentUserState.dataValues.currentLesson_sequence
                        );

                        // Mark previous lesson as completed
                        const currentLesson = await lessonRepository.getCurrentLesson(currentUserState.dataValues.currentLessonId);
                        await waLessonsCompletedRepository.endLessonByPhoneNumberLessonIdAndProfileId(userMobileNumber, currentLesson.dataValues.LessonId, profileId);

                        // Get acceptable messages for the next question/lesson
                        const acceptableMessagesList = await getAcceptableMessagesList(nextLesson.dataValues.activity);

                        // Update user progress to next lesson
                        await waUserProgressRepository.update(
                            profileId,
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
                        const latestUserState = await waUserProgressRepository.getByProfileId(profileId);

                        // Send next lesson to user
                        await sendCourseLesson(profileId, userMobileNumber, latestUserState, nextLesson, messageType, messageContent, persona, buttonId);
                    }
                    return;

                }

                // MOVING NEXT ACTIVITY TRIAL
                if (text_message_types.includes(message.type) && next_activity_acceptable_messages.includes(messageContent.toLowerCase())) {
                    if (currentUserState.dataValues.engagement_type == "Free Trial - Teachers" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                        // Get next lesson to send user
                        const nextLesson = await lessonRepository.getNextLesson(
                            currentUserState.dataValues.currentCourseId,
                            currentUserState.dataValues.currentWeek,
                            currentUserState.dataValues.currentDay,
                            currentUserState.dataValues.currentLesson_sequence
                        );

                        let theStartingLesson = await lessonRepository.getByLessonId(currentUserState.dataValues.currentLessonId);

                        // If next and nextLesson not available call ending message
                        if (!nextLesson) {
                            await endingMessage(profileId, userMobileNumber, currentUserState, theStartingLesson);
                            return;
                        }

                        // Get acceptable messages for the next question/lesson
                        const acceptableMessagesList = await getAcceptableMessagesList(nextLesson.dataValues.activity);

                        // Update user progress to next lesson
                        await waUserProgressRepository.update(
                            profileId,
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
                        let latestUserState = await waUserProgressRepository.getByProfileId(profileId);

                        // Send next lesson to user
                        await sendCourseLesson(profileId, userMobileNumber, latestUserState, nextLesson, messageType, messageContent, persona, buttonId);

                        if (nextLesson.dataValues.activity == "video") {
                            const nextLesson = await lessonRepository.getNextLesson(
                                latestUserState.dataValues.currentCourseId,
                                latestUserState.dataValues.currentWeek,
                                latestUserState.dataValues.currentDay,
                                latestUserState.dataValues.currentLesson_sequence
                            );

                            // Mark previous lesson as completed
                            const currentLesson = await lessonRepository.getCurrentLesson(latestUserState.dataValues.currentLessonId);
                            await waLessonsCompletedRepository.endLessonByPhoneNumberLessonIdAndProfileId(userMobileNumber, currentLesson.dataValues.LessonId, profileId);

                            // Get acceptable messages for the next question/lesson
                            const acceptableMessagesList = await getAcceptableMessagesList(nextLesson.dataValues.activity);

                            // Update user progress to next lesson
                            await waUserProgressRepository.update(
                                profileId,
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
                            latestUserState = await waUserProgressRepository.getByProfileId(profileId);

                            // Send next lesson to user
                            await sendCourseLesson(profileId, userMobileNumber, latestUserState, nextLesson, messageType, messageContent, persona, buttonId);
                        }
                        return;
                    }
                }


                // MAIN COURSE START FLOW - TRIGGERING ON "START"
                currentUserState = await waUserProgressRepository.getByProfileId(profileId);
                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "start" || messageContent.toLowerCase() == "start!")
                ) {
                    if (currentUserState.dataValues.engagement_type == "Course Start") {
                        if (currentUserState.dataValues.persona == "kid") {
                            const courseName = await courseRepository.getCourseNameById(currentUserState.dataValues.currentCourseId);
                            if (!courseName.toLowerCase().includes("assessment")) {
                                const level = getLevelFromCourseName(courseName);
                                let imageUrl = "https://beajbloblive.blob.core.windows.net/beajdocuments/kids_badges_level" + level + "_day_1_start.jpg";
                                let captionText = "💥 Let's begin your 1st adventure!";
                                await sendMediaMessage(userMobileNumber, imageUrl, 'image', captionText);
                                await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null, captionText);
                                await sleep(2000);
                            }
                        }
                        const startingLesson = await lessonRepository.getNextLesson(currentUserState.dataValues.currentCourseId, 1, null, null);
                        await waUserProgressRepository.update(profileId, userMobileNumber, currentUserState.dataValues.currentCourseId, startingLesson.dataValues.weekNumber, startingLesson.dataValues.dayNumber, startingLesson.dataValues.LessonId, startingLesson.dataValues.SequenceNumber, startingLesson.dataValues.activity, null, null, null);

                        if (currentUserState.dataValues.persona == "teacher") {
                            await sendMessage(userMobileNumber, "Great! Let's start! 🤩");
                            await createActivityLog(userMobileNumber, "text", "outbound", "Great! Let's start! 🤩", null);
                        }
                        // Send first lesson to user
                        currentUserState = await waUserProgressRepository.getByProfileId(profileId);
                        await sendCourseLesson(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona, buttonId);
                        if (startingLesson.dataValues.activity == "video") {
                            const nextLesson = await lessonRepository.getNextLesson(
                                currentUserState.dataValues.currentCourseId,
                                currentUserState.dataValues.currentWeek,
                                currentUserState.dataValues.currentDay,
                                currentUserState.dataValues.currentLesson_sequence
                            );

                            // Mark previous lesson as completed
                            const currentLesson = await lessonRepository.getCurrentLesson(currentUserState.dataValues.currentLessonId);
                            await waLessonsCompletedRepository.endLessonByPhoneNumberLessonIdAndProfileId(userMobileNumber, currentLesson.dataValues.LessonId, profileId);

                            // Get acceptable messages for the next question/lesson
                            const acceptableMessagesList = await getAcceptableMessagesList(nextLesson.dataValues.activity);

                            // Update user progress to next lesson
                            await waUserProgressRepository.update(
                                profileId,
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
                            const latestUserState = await waUserProgressRepository.getByProfileId(profileId);

                            // Send next lesson to user
                            await sendCourseLesson(profileId, userMobileNumber, latestUserState, nextLesson, messageType, messageContent, persona, buttonId);
                        }
                        return;
                    }
                }

                // MID ACTIVITY FLOWS - TRIGGERING ON "YES" OR "NO" OR "EASY" OR "HARD"
                if (text_message_types.includes(message.type)) {
                    const currentLesson = await lessonRepository.getCurrentLesson(currentUserState.dataValues.currentLessonId);
                    if (
                        ((messageContent.toLowerCase().includes("yes") || messageContent.toLowerCase().includes("no")) && (currentUserState.dataValues.activityType && currentUserState.dataValues.questionNumber)) ||
                        ((messageContent.toLowerCase().includes("easy") || messageContent.toLowerCase().includes("hard")) && (currentUserState.dataValues.activityType))
                    ) {
                        await sendCourseLesson(profileId, userMobileNumber, currentUserState, currentLesson, messageType, messageContent, persona, buttonId);
                        return;
                    }
                }


                // MOVING NEXT ACTIVITY MAIN COURSE
                if (text_message_types.includes(message.type) && next_activity_acceptable_messages.includes(messageContent.toLowerCase())) {
                    if (feedback_acceptable_messages.includes(messageContent.toLowerCase())) {
                        await createFeedback(userMobileNumber, profileId, messageContent);
                        return;
                    }
                    // Get next lesson to send user
                    const nextLesson = await lessonRepository.getNextLesson(
                        currentUserState.dataValues.currentCourseId,
                        currentUserState.dataValues.currentWeek,
                        currentUserState.dataValues.currentDay,
                        currentUserState.dataValues.currentLesson_sequence
                    );
                    let latestUserState = await waUserProgressRepository.getByProfileId(profileId);
                    let theStartingLesson = await lessonRepository.getByLessonId(currentUserState.dataValues.currentLessonId);

                    if (
                        (messageContent.toLowerCase().includes("next") || messageContent.toLowerCase().includes("next activity"))
                        && (latestUserState.dataValues.activityType == "feedbackAudio" || latestUserState.dataValues.activityType == "watchAndAudio")) {
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);
                        await endingMessage(profileId, userMobileNumber, currentUserState, theStartingLesson);
                        return;
                    }

                    if (!nextLesson) {
                        const daysPerWeek = await getDaysPerWeek(profileId);
                        const lessonNumberCheck = (currentUserState.dataValues.currentWeek - 1) * daysPerWeek + currentUserState.dataValues.currentDay;
                        let totalLessons = 0;
                        let courseName = await courseRepository.getCourseNameById(currentUserState.dataValues.currentCourseId);
                        if (courseName.toLowerCase().includes("assessment")) {
                            if (courseName.toLowerCase().includes("level 4")) {
                                totalLessons = 2;
                            } else {
                                totalLessons = 3;
                            }
                        } else if (courseName.toLowerCase().includes("level 0") || courseName.toLowerCase().includes("level 4")) {
                            totalLessons = 1;
                        } else {
                            totalLessons = await getTotalLessonsForCourse(profileId);
                        }
                        if (lessonNumberCheck >= totalLessons) {
                            if (
                                (totalLessons == 3 && courseName.toLowerCase().includes("assessment")) ||
                                (totalLessons == 2 && courseName.toLowerCase().includes("assessment") && courseName.toLowerCase().includes("level 4"))
                            ) {
                                await sendButtonMessage(userMobileNumber, 'Click on Start Now! 👇', [{ id: 'start_now', title: 'Start Now!' }, { id: 'change_user', title: 'Change User' }]);
                                await createActivityLog(userMobileNumber, "template", "outbound", "Click on Start Now! 👇", null);
                                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start now!", "change user"]);
                                return;
                            } else {
                                // if teacher
                                if (currentUserState.dataValues.persona == "teacher") {
                                    if (courseName.toLowerCase().includes("level 3")) {
                                        const audioUrl = "https://beajbloblive.blob.core.windows.net/beajdocuments/complete_final_task.mp3";
                                        await sendMediaMessage(userMobileNumber, audioUrl, 'audio', null);
                                        await createActivityLog(userMobileNumber, "audio", "outbound", audioUrl, null);
                                        await sleep(3000);
                                        await sendButtonMessage(userMobileNumber, 'Click on the button below to complete the final task and get your certificate', [{ id: 'complete_final_task', title: 'Complete Final Task' }]);
                                        await createActivityLog(userMobileNumber, "template", "outbound", "Click on the button below to complete the final task and get your certificate", null);
                                        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["complete final task"]);
                                        return;
                                    } else {
                                        await sendButtonMessage(userMobileNumber, 'You have completed all the lessons in this course. Click the button below to proceed', [{ id: 'start_next_level', title: 'Start Next Level' }]);
                                        await createActivityLog(userMobileNumber, "template", "outbound", "You have completed all the lessons in this course. Click the button below to proceed", null);
                                        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start next level"]);
                                        return;
                                    }
                                } else {
                                    let finalKidsMessage = "This is the end of your Beaj Summer Camp!\n\nWe thank you for becoming a part of the Beaj family! 🤩";
                                    await sendButtonMessage(userMobileNumber, finalKidsMessage, [{ id: 'change_user', title: 'Change User' }]);
                                    await createActivityLog(userMobileNumber, "template", "outbound", finalKidsMessage, null);
                                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["change user"]);
                                    return;
                                }
                            }
                        }
                        await sendMessage(userMobileNumber, "Please wait for the next lesson to start.");
                        await createActivityLog(userMobileNumber, "text", "outbound", "Please wait for the next lesson to start.", null);
                        return;
                    }

                    // Daily blocking
                    const daysPerWeek = await getDaysPerWeek(profileId);
                    if (
                        (daysPerWeek == 5 && currentUserState.dataValues.persona == "kid") ||
                        (currentUserMetadata.dataValues.cohort == "Cohort 20" && currentUserState.dataValues.persona == "teacher")
                    ) {
                        if (!numbers_to_ignore.includes(userMobileNumber)) {
                            const course = await courseRepository.getById(
                                currentUserState.dataValues.currentCourseId
                            );
                            let courseStartDate = new Date(course.dataValues.courseStartDate);
                            if (currentUserMetadata.dataValues.cohort == "Cohort 20" && currentUserState.dataValues.persona == "teacher") {
                                // check course name
                                const courseName = await courseRepository.getCourseNameById(currentUserState.dataValues.currentCourseId);
                                if (courseName.toLowerCase().includes("level 0") || courseName.toLowerCase().includes("level 1")) {
                                    courseStartDate = new Date("August 11, 2025");
                                } else if (courseName.toLowerCase().includes("level 2")) {
                                    courseStartDate = new Date("September 8, 2025");
                                } else if (courseName.toLowerCase().includes("level 3") || courseName.toLowerCase().includes("level 4")) {
                                    courseStartDate = new Date("October 6, 2025");
                                }
                            }
                            const today = new Date();

                            // Calculate the number of days from the start date needed for the current day's content
                            const lessonDayNumber = (nextLesson.dataValues.weekNumber - 1) * daysPerWeek + nextLesson.dataValues.dayNumber;
                            const daysRequiredForCurrentLesson = lessonDayNumber - 1; // As before

                            // Add days to course start date, skipping Saturdays and Sundays
                            let dayUnlockDate = new Date(courseStartDate);
                            let daysAdded = 0;

                            while (daysAdded < daysRequiredForCurrentLesson) {
                                dayUnlockDate.setDate(dayUnlockDate.getDate() + 1);
                                if (currentUserMetadata.dataValues.cohort == "Cohort 20") {
                                    // Skip weekends: Saturday (6) and Sunday (0)
                                    if (dayUnlockDate.getDay() !== 0) {
                                        daysAdded++;
                                    }
                                } else {
                                    // Skip weekends: Saturday (6) and Sunday (0)
                                    if (dayUnlockDate.getDay() !== 0 && dayUnlockDate.getDay() !== 6) {
                                        daysAdded++;
                                    }
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
                                if (messageContent.toLowerCase().includes("start next lesson")) {
                                    if (currentUserMetadata.dataValues.cohort == "Cohort 20" && currentUserState.dataValues.persona == "teacher") {
                                        const message = "Please come back tomorrow to unlock the next lesson.";
                                        await sendButtonMessage(userMobileNumber, message, [{ id: 'start_next_lesson', title: 'Start Next Lesson' }]);
                                        await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Lesson", null);
                                    } else {
                                        const message = "Please come back tomorrow to unlock the next lesson.";
                                        await sendButtonMessage(userMobileNumber, message, [{ id: 'start_next_lesson', title: 'Start Next Lesson' }, { id: 'change_user', title: 'Change User' }]);
                                        await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Lesson", null);
                                    }
                                } else if (messageContent.toLowerCase().includes("start next game")) {
                                    const message = "Please come back tomorrow to unlock the next game.";
                                    await sendButtonMessage(userMobileNumber, message, [{ id: 'start_next_game', title: 'Start Next Game' }, { id: 'change_user', title: 'Change User' }]);
                                    await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Game", null);
                                } else {
                                    const message = "Please come back tomorrow to unlock the next lesson.";
                                    await sendMessage(userMobileNumber, message);
                                    await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                                }
                                return;
                            }
                        }
                    }

                    if ((currentUserState.dataValues.currentDay != nextLesson.dataValues.dayNumber) && currentUserState.dataValues.persona == "kid") {
                        const courseName = await courseRepository.getCourseNameById(currentUserState.dataValues.currentCourseId);
                        if (!courseName.toLowerCase().includes("assessment")) {
                            const dayNumber = (nextLesson.dataValues.weekNumber - 1) * daysPerWeek + nextLesson.dataValues.dayNumber;
                            const level = getLevelFromCourseName(courseName);
                            let imageUrl = "https://beajbloblive.blob.core.windows.net/beajdocuments/kids_badges_level" + level + "_day_" + dayNumber + "_start.jpg";
                            let captionText = "";
                            captionText = "👍 Let's start Day " + dayNumber + "!";
                            await sendMediaMessage(userMobileNumber, imageUrl, 'image', captionText);
                            await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null, captionText);
                            await sleep(2000);
                        }
                    }

                    // Get acceptable messages for the next question/lesson
                    const acceptableMessagesList = await getAcceptableMessagesList(nextLesson.dataValues.activity);

                    // Update user progress to next lesson
                    await waUserProgressRepository.update(
                        profileId,
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
                    latestUserState = await waUserProgressRepository.getByProfileId(profileId);

                    // Send next lesson to user
                    await sendCourseLesson(profileId, userMobileNumber, latestUserState, nextLesson, messageType, messageContent, persona, buttonId);

                    if (nextLesson.dataValues.activity == "video") {
                        const nextLesson = await lessonRepository.getNextLesson(
                            latestUserState.dataValues.currentCourseId,
                            latestUserState.dataValues.currentWeek,
                            latestUserState.dataValues.currentDay,
                            latestUserState.dataValues.currentLesson_sequence
                        );

                        // Mark previous lesson as completed
                        const currentLesson = await lessonRepository.getCurrentLesson(latestUserState.dataValues.currentLessonId);
                        await waLessonsCompletedRepository.endLessonByPhoneNumberLessonIdAndProfileId(userMobileNumber, currentLesson.dataValues.LessonId, profileId);

                        // Get acceptable messages for the next question/lesson
                        const acceptableMessagesList = await getAcceptableMessagesList(nextLesson.dataValues.activity);

                        // Update user progress to next lesson
                        await waUserProgressRepository.update(
                            profileId,
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
                        latestUserState = await waUserProgressRepository.getByProfileId(profileId);

                        // Send next lesson to user
                        await sendCourseLesson(profileId, userMobileNumber, latestUserState, nextLesson, messageType, messageContent, persona, buttonId);
                    }
                    return;
                }


                // MOVING TO NEXT QUESTION
                if (
                    currentUserState.dataValues.activityType && activity_types_to_repeat.includes(currentUserState.dataValues.activityType)
                ) {
                    const currentLesson = await lessonRepository.getCurrentLesson(currentUserState.dataValues.currentLessonId);
                    const acceptableMessagesList = await getAcceptableMessagesList(currentLesson.dataValues.activity);
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                    await sendCourseLesson(profileId, userMobileNumber, currentUserState, currentLesson, messageType, messageContent, persona, buttonId);
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

export default { webhookService, verifyWebhookService, getCombinedUserDataService };