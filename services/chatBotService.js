import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import waConstantsRepository from "../repositories/waConstantsRepository.js";
import waActiveSessionRepository from "../repositories/waActiveSessionRepository.js";
import waProfileRepository from "../repositories/waProfileRepository.js";
import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import { startCourseForUser, sendCourseLesson, talkToBeajRep } from "../utils/chatbotUtils.js";
import { demoCourseStart } from "../utils/trialflowUtils.js";
import { sendMessage, sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { createFeedback } from "../utils/createFeedbackUtils.js";
import {
    checkUserMessageAndAcceptableMessages, getAcceptableMessagesList, sleep, getDaysPerWeek, getLevelFromCourseName,
    extractMessageContent, getProfileTypeFromBotId
} from "../utils/utils.js";
import { runWithContext } from "../utils/requestContext.js";
import {
    activity_types_to_repeat, text_message_types, beaj_team_numbers, feedback_acceptable_messages, course_start_states,
    next_activity_acceptable_messages, special_commands, talk_to_beaj_rep_messages, course_start_acceptable_messages,
    trigger_course_acceptable_messages, teacher_trial_flow_engagement_types, kids_trial_flow_engagement_types,
    next_question_acceptable_messages, skip_activity_acceptable_messages
} from "../constants/constants.js";
import { specialCommandFlow } from "../flows/specialCommandFlows.js";
import { marketingBotFlow } from "../flows/marketingBotFlows.js";
import teachersTrialFlow from "../flows/teacherTrialFlow.js";
import kidsTrialFlow from "../flows/kidsTrialFlow.js";
import { chooseProfileFlow, userSwitchingFlow } from "../flows/profileFlows.js";
import { dayBlockingFlow } from "../flows/dayBlockingFlow.js";
import { courseEndingFlow } from "../flows/courseEndingFlow.js";
import { handleVideoAudioImageFlow } from "../flows/handleVideoAudioImageFlow.js";
import dotenv from 'dotenv';
dotenv.config();


const verifyWebhookService = async (req, res) => {
    try {
        const whatsappVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];

        if (mode && token === whatsappVerifyToken) {
            console.log("Webhook Verified");
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
                return;
            }

            const message = body.entry[0].changes[0].value.messages[0];
            const userMobileNumber = "+" + message.from;
            const activeSession = await waActiveSessionRepository.getByPhoneNumberAndBotPhoneNumberId(userMobileNumber, botPhoneNumberId);
            const userProfileExists = await waProfileRepository.getByPhoneNumberAndBotPhoneNumberId(userMobileNumber, botPhoneNumberId);
            let profileId = null;
            let userExists = false;
            let chooseProfile = false;
            let profile_type = getProfileTypeFromBotId(botPhoneNumberId);
            if (activeSession) {
                profileId = activeSession.dataValues.profile_id;
                userExists = true;
            }
            else if (!activeSession && !userProfileExists) {
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

            let messageType = message.type;
            let logger = `Inbound Message: User: ${userMobileNumber}, Bot ID: ${botPhoneNumberId}, Message Type: ${message.type}, Message Content: ${message.text?.body ||
                message.image?.id || message.audio?.id || message.video?.id || message.interactive?.button_reply?.title || message.button?.text}`;
            console.log(logger);

            // Wrap the webhook handling logic with the context containing the bot phone number ID
            await runWithContext({ botPhoneNumberId, profileId, userMobileNumber }, async () => {
                // INBOUND MESSAGES LOGGING
                const { messageContent, inboundUploadedImage, buttonId } = await extractMessageContent(message, userMobileNumber);

                // CHECKING IF BOT IS ACTIVE
                const botStatus = await waConstantsRepository.getByKey("BOT_STATUS");
                if (!botStatus || botStatus.dataValues.constantValue != "Active") {
                    await sendMessage(userMobileNumber, "Sorry, We are currently not accepting any messages. Please try again later.");
                    await createActivityLog(userMobileNumber, "text", "outbound", "Sorry, We are currently not accepting any messages. Please try again later.", null);
                    return;
                }

                // GETTING CURRENT USER STATE
                let currentUserState = await waUserProgressRepository.getByProfileId(profileId);
                let currentUserMetadata = await waUsersMetadataRepository.getByProfileId(profileId);
                let persona;
                let trialFlowHit = false;
                let courseLanguage = "eng";
                if (!currentUserState) {
                    persona = null;
                } else if (
                    currentUserState.dataValues.persona == "kid" ||
                    currentUserState.dataValues.persona == "parent or student" ||
                    currentUserState.dataValues.persona == "school admin"
                ) {
                    persona = "kid";
                } else {
                    persona = "teacher";
                }
                let daysPerWeek = await getDaysPerWeek(profileId);

                // SPECIAL COMMANDS
                if (message.type == "text" && special_commands.includes(messageContent.toLowerCase())) {
                    await specialCommandFlow(profileId, userMobileNumber, messageContent);
                    return;
                };
                // MARKETING BOT
                if (profile_type == "marketing") {
                    await marketingBotFlow(profileId, messageContent, messageType, userMobileNumber);
                    return;
                }
                // CHECKING FOR ACCEPTABLE MESSAGES AND SETTING COURSE LANGUAGE
                if (currentUserState) {
                    if (currentUserState?.dataValues?.currentCourseId) {
                        const course = await courseRepository.getById(currentUserState.dataValues.currentCourseId);
                        courseLanguage = course?.dataValues?.courseLanguage;
                    }
                    const messageAuth = await checkUserMessageAndAcceptableMessages(profileId, userMobileNumber, currentUserState, messageType, messageContent, courseLanguage);
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
                // TRIAL FLOW ROUTING
                if (!userExists) {
                    if (profile_type == "student") {
                        await kidsTrialFlow.kidsTrialFlowDriver(profileId, userMobileNumber, "New User", messageContent, messageType, inboundUploadedImage);
                    } else {
                        await teachersTrialFlow.teachersTrialFlowDriver(profileId, userMobileNumber, "New User", messageContent, messageType, inboundUploadedImage);
                    }
                    return;
                } else if (currentUserState.dataValues.engagement_type != "Course Start") {
                    const messageAuth = await checkUserMessageAndAcceptableMessages(profileId, userMobileNumber, currentUserState, messageType, messageContent, courseLanguage);
                    if (messageAuth === false) {
                        return;
                    }
                    if (profile_type == "student" && kids_trial_flow_engagement_types.includes(currentUserState.dataValues.engagement_type)) {
                        trialFlowHit = await kidsTrialFlow.kidsTrialFlowDriver(profileId, userMobileNumber, currentUserState.dataValues.engagement_type, messageContent, messageType, inboundUploadedImage);
                    } else if (profile_type == "teacher" && teacher_trial_flow_engagement_types.includes(currentUserState.dataValues.engagement_type)) {
                        trialFlowHit = await teachersTrialFlow.teachersTrialFlowDriver(profileId, userMobileNumber, currentUserState.dataValues.engagement_type, messageContent, messageType, inboundUploadedImage);
                    }
                    if (trialFlowHit === true) {
                        return;
                    }
                }
                // MAIN COURSE START FLOW - SENDING "START"
                if (text_message_types.includes(message.type) && trigger_course_acceptable_messages.includes(messageContent.toLowerCase())) {
                    const courseStarted = await startCourseForUser(profileId, userMobileNumber, beaj_team_numbers);
                    if (courseStarted != "french") {
                        return;
                    } else {
                        courseLanguage = "fra";
                    }
                }
                // MAIN COURSE START FLOW - TRIGGERING ON "START"
                if (text_message_types.includes(message.type) && course_start_acceptable_messages.includes(messageContent.toLowerCase())) {
                    if (course_start_states.includes(currentUserState.dataValues.engagement_type)) {
                        let startingLesson = null;
                        if (currentUserState.dataValues.engagement_type != "Course Start") {
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
                            startingLesson = await lessonRepository.getNextLesson(await courseRepository.getCourseIdByName(courseName), null, null, null);
                            await demoCourseStart(profileId, userMobileNumber, startingLesson, courseName);
                        }
                        if (currentUserState.dataValues.persona == "kid" && currentUserState.dataValues.engagement_type == "Course Start") {
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
                        currentUserState = await waUserProgressRepository.getByProfileId(profileId);
                        startingLesson = await lessonRepository.getNextLesson(currentUserState.dataValues.currentCourseId, null, null, null);
                        await waUserProgressRepository.update(profileId, userMobileNumber, currentUserState.dataValues.currentCourseId, startingLesson.dataValues.weekNumber, startingLesson.dataValues.dayNumber, startingLesson.dataValues.LessonId, startingLesson.dataValues.SequenceNumber, startingLesson.dataValues.activity, null, null, null);
                        currentUserState = await waUserProgressRepository.getByProfileId(profileId);
                        startingLesson.dataValues.courseLanguage = courseLanguage;
                        await sendCourseLesson(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona, buttonId);
                        if (startingLesson.dataValues.activity == "video" || startingLesson.dataValues.activity == "audio" || startingLesson.dataValues.activity == "image") {
                            await handleVideoAudioImageFlow(profileId, userMobileNumber, currentUserState, messageType, messageContent, persona, buttonId, courseLanguage);
                        }
                        return;
                    }
                }
                // MID ACTIVITY FLOWS - TRIGGERING ON "YES" OR "NO" OR "EASY" OR "HARD"
                if (text_message_types.includes(message.type)) {
                    const currentLesson = await lessonRepository.getCurrentLesson(currentUserState.dataValues.currentLessonId);
                    const topicsList = await speakActivityQuestionRepository.getTopicsByLessonId(currentUserState.dataValues.currentLessonId);
                    if (
                        (next_question_acceptable_messages.includes(messageContent.toLowerCase()) && (currentUserState.dataValues.activityType && currentUserState.dataValues.questionNumber)) ||
                        ((messageContent.toLowerCase().includes("easy") || messageContent.toLowerCase().includes("hard")) && (currentUserState.dataValues.activityType)) ||
                        (topicsList.includes(messageContent.toLowerCase()) && (currentUserState.dataValues.activityType))
                    ) {
                        currentLesson.dataValues.courseLanguage = courseLanguage;
                        await sendCourseLesson(profileId, userMobileNumber, currentUserState, currentLesson, messageType, messageContent, persona, buttonId);
                        return;
                    }
                }
                // MOVING NEXT ACTIVITY
                if (text_message_types.includes(message.type) && next_activity_acceptable_messages.includes(messageContent.toLowerCase())) {
                    // FEEDBACK FLOW
                    if (feedback_acceptable_messages.includes(messageContent.toLowerCase())) {
                        await createFeedback(userMobileNumber, profileId, messageContent);
                        return;
                    }
                    // Get next lesson to send user
                    let nextLesson = null;
                    let lessonSkipped = false;
                    let nextSkipableLesson = await lessonRepository.getNextLesson(
                        currentUserState.dataValues.currentCourseId, currentUserState.dataValues.currentWeek,
                        currentUserState.dataValues.currentDay, currentUserState.dataValues.currentLesson_sequence
                    );
                    if (skip_activity_acceptable_messages.includes(messageContent.toLowerCase()) && nextSkipableLesson.dataValues.skipOnStart && nextSkipableLesson.dataValues.skipOnStart == true) {
                        nextLesson = await lessonRepository.getByLessonId(nextSkipableLesson.dataValues.skipOnStartToLessonId);
                        lessonSkipped = true;
                    } else {
                        nextLesson = nextSkipableLesson;
                    }

                    let latestUserState = await waUserProgressRepository.getByProfileId(profileId);
                    let theStartingLesson = await lessonRepository.getByLessonId(currentUserState.dataValues.currentLessonId);

                    if (skip_activity_acceptable_messages.includes(messageContent.toLowerCase()) && lessonSkipped == false) {
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null, null);
                        await waLessonsCompletedRepository.endLessonByPhoneNumberLessonIdAndProfileId(userMobileNumber, theStartingLesson.dataValues.LessonId, profileId);
                        // await endingMessage(profileId, userMobileNumber, currentUserState, theStartingLesson);
                        // return;
                    }

                    // COURSE ENDING FLOW
                    if (!nextLesson) {
                        await courseEndingFlow(profileId, userMobileNumber, currentUserState, theStartingLesson);
                        return;
                    }

                    // DAY BLOCKING FLOW
                    const moveForward = await dayBlockingFlow(profileId, userMobileNumber, daysPerWeek, currentUserState, currentUserMetadata, nextLesson, messageContent);
                    if (moveForward === false) {
                        return;
                    }

                    // KIDS MAP IMAGES
                    const courseName = await courseRepository.getCourseNameById(currentUserState.dataValues.currentCourseId);
                    if ((currentUserState.dataValues.currentDay != nextLesson.dataValues.dayNumber) && (currentUserState.dataValues.persona == "kid") && (!courseName.toLowerCase().includes("assessment"))) {
                        const dayNumber = (nextLesson.dataValues.weekNumber - 1) * daysPerWeek + nextLesson.dataValues.dayNumber;
                        const level = getLevelFromCourseName(courseName);
                        let imageUrl = "https://beajbloblive.blob.core.windows.net/beajdocuments/kids_badges_level" + level + "_day_" + dayNumber + "_start.jpg";
                        let captionText = "";
                        captionText = "👍 Let's start Day " + dayNumber + "!";
                        await sendMediaMessage(userMobileNumber, imageUrl, 'image', captionText);
                        await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null, captionText);
                        await sleep(2000);
                    }

                    // Get acceptable messages for the next question/lesson
                    const acceptableMessagesList = await getAcceptableMessagesList(nextLesson.dataValues.activity);

                    // Update user progress to next lesson
                    await waUserProgressRepository.update(profileId, userMobileNumber, nextLesson.dataValues.courseId,
                        nextLesson.dataValues.weekNumber, nextLesson.dataValues.dayNumber, nextLesson.dataValues.LessonId,
                        nextLesson.dataValues.SequenceNumber, nextLesson.dataValues.activity, null, 0, acceptableMessagesList);
                    latestUserState = await waUserProgressRepository.getByProfileId(profileId);

                    // Send next lesson to user
                    nextLesson.dataValues.courseLanguage = courseLanguage;
                    await sendCourseLesson(profileId, userMobileNumber, latestUserState, nextLesson, messageType, messageContent, persona, buttonId);

                    // VIDEO ACTIVITY FLOW
                    if (nextLesson.dataValues.activity == "video" || nextLesson.dataValues.activity == "audio" || nextLesson.dataValues.activity == "image") {
                        await handleVideoAudioImageFlow(profileId, userMobileNumber, latestUserState, messageType, messageContent, persona, buttonId, courseLanguage);
                    }
                    return;
                }
                // MOVING TO NEXT QUESTION
                if (currentUserState.dataValues.activityType && activity_types_to_repeat.includes(currentUserState.dataValues.activityType)) {
                    const currentLesson = await lessonRepository.getCurrentLesson(currentUserState.dataValues.currentLessonId);
                    const acceptableMessagesList = await getAcceptableMessagesList(currentLesson.dataValues.activity);
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                    currentLesson.dataValues.courseLanguage = courseLanguage;
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