import dotenv from 'dotenv';
import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";
import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import waConstantsRepository from "../repositories/waConstantsRepository.js";
import waActiveSessionRepository from "../repositories/waActiveSessionRepository.js";
import waProfileRepository from "../repositories/waProfileRepository.js";
import waUserActivityLogsRepository from "../repositories/waUserActivityLogsRepository.js";
import AIServices from "../utils/AIServices.js";
import { removeUser, removeUserTillCourse, startCourseForUser, levelCourseStart, sendCourseLessonToTeacher, sendCourseLessonToKid } from "../utils/chatbotUtils.js";
import {
    greetingMessage,
    greetingMessageLoop,
    kidsChooseClass,
    kidsChooseClassLoop,
    demoCourseStart,
    endTrialTeachers,
    confirmSchoolName,
    thankyouMessageSchoolOwner,
    getUserProfile,
    getSchoolName,
    getCityName,
    thankyouMessageParent,
    talkToBeajRep,
    parentOrStudentSelection,
    studentGenericClassInput,
    studentSpecificClassInput,
    paymentDetails,
    paymentComplete,
    singleStudentRegistationComplate,
    studentNameInput,
    studentNameConfirmation,
    studentGenericClassConfirmation,
    studentSpecificClassConfirmation,
    schoolAdminConfirmation,
    startOfFlow,
    cancelRegistration,
    confirmCancelRegistration
} from "../utils/trialflowUtils.js";
import { sendMessage, sendButtonMessage, retrieveMediaURL, sendMediaMessage, sendContactCardMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { createFeedback } from "../utils/createFeedbackUtils.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import { checkUserMessageAndAcceptableMessages, getAcceptableMessagesList, sleep } from "../utils/utils.js";
import { runWithContext } from "../utils/requestContext.js";
import { studentBotContactData, teacherBotContactData } from "../constants/contacts.js";
dotenv.config();
const whatsappVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
const studentBotPhoneNumberId = process.env.STUDENT_BOT_PHONE_NUMBER_ID;
const teacherBotPhoneNumberId = process.env.TEACHER_BOT_PHONE_NUMBER_ID;
const marketingBotPhoneNumberId = process.env.MARKETING_BOT_PHONE_NUMBER_ID;

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
    "feedbackAudio",
    "feedbackMcqs",
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
    return;
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
            if (botPhoneNumberId == null || botPhoneNumberId == undefined || botPhoneNumberId == "") {
                console.log("Bot phone number id is null");
                return;
            }

            const message = body.entry[0].changes[0].value.messages[0];
            const userMobileNumber = "+" + message.from;
            const activeSession = await waActiveSessionRepository.getByPhoneNumberAndBotPhoneNumberId(userMobileNumber, botPhoneNumberId);
            let profileId = null;
            let userExists = false;
            if (activeSession) {
                profileId = activeSession.dataValues.profile_id;
                userExists = true;
            } else {
                const profile_type = botPhoneNumberId == teacherBotPhoneNumberId ? "teacher" :
                    botPhoneNumberId == studentBotPhoneNumberId ? "student" :
                        botPhoneNumberId == marketingBotPhoneNumberId ? "marketing" : "";
                let profile = await waProfileRepository.create({
                    phone_number: userMobileNumber,
                    bot_phone_number_id: botPhoneNumberId,
                    profile_type: profile_type
                });
                profileId = profile.dataValues.profile_id;
                await waUsersMetadataRepository.create({ profile_id: profileId, phoneNumber: userMobileNumber, userClickedLink: new Date() });
                await waActiveSessionRepository.create({ phone_number: userMobileNumber, bot_phone_number_id: botPhoneNumberId, profile_id: profileId });
                userExists = false;
            }

            let messageContent;
            let messageType = message.type;
            let logger = `Inbound Message: User: ${userMobileNumber}, Bot ID: ${botPhoneNumberId}, Message Type: ${message.type}, Message Content: ${message.text?.body ||
                message.image?.id || message.audio?.id || message.video?.id || message.interactive?.button_reply?.title || message.button?.text}`;
            console.log(logger);

            // Wrap the webhook handling logic with the context containing the bot phone number ID
            await runWithContext({ botPhoneNumberId, profileId, userMobileNumber }, async () => {
                let inboundUploadedImage = null;
                let inboundUploadedAudio = null;
                let inboundUploadedVideo = null;
                if (message.type === "image") {
                    inboundUploadedImage = await createActivityLog(userMobileNumber, "image", "inbound", message, null);
                    messageContent = await retrieveMediaURL(message.image.id);
                } else if (message.type === "audio") {
                    inboundUploadedAudio = await createActivityLog(userMobileNumber, "audio", "inbound", message, null);
                    messageContent = await retrieveMediaURL(message.audio.id);
                } else if (message.type === "video") {
                    inboundUploadedVideo = await createActivityLog(userMobileNumber, "video", "inbound", message, null);
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

                // If message is reset, delete user from database
                if (text_message_types.includes(message.type) && messageContent.toLowerCase() == "reset all") {
                    await removeUser(userMobileNumber);
                    return;
                }

                // If message is reset till course, delete user from database
                if (text_message_types.includes(message.type) && messageContent.toLowerCase() == "reset course") {
                    await removeUserTillCourse(profileId, userMobileNumber);
                    return;
                }

                if (botPhoneNumberId == marketingBotPhoneNumberId) {
                    if (!["text", "button", "interactive"].includes(message.type)) {
                        await sendMessage(userMobileNumber, "Sorry, I am not able to respond to your question. I only accept text messages.");
                        await createActivityLog(userMobileNumber, "text", "outbound", "Sorry, I am not able to respond to your question. I only accept text messages.", null);
                        return;
                    }
                    const previousMessages = await waUserActivityLogsRepository.getMarketingBotChatHistory(userMobileNumber);
                    if (previousMessages == null) {
                        await sendMessage(userMobileNumber, "Sorry, I have received too many messages from you in the past hour. Please try again later.");
                        await createActivityLog(userMobileNumber, "text", "outbound", "Sorry, I have received too many messages from you in the past hour. Please try again later.", null);
                        return;
                    }
                    let response = await AIServices.marketingBotResponse(previousMessages);
                    const imageResponse = response.match(/<IMAGE>(.*?)<\/IMAGE>/)?.[1];
                    const contactResponse = response.match(/<CONTACT>(.*?)<\/CONTACT>/)?.[1];
                    response = response.replace(/<IMAGE>(.*?)<\/IMAGE>/g, "").replace(/<CONTACT>(.*?)<\/CONTACT>/g, "");
                    await sendMessage(userMobileNumber, response);
                    if (imageResponse) {
                        if (imageResponse.toLowerCase() == "flyer image") {
                            const flyer = await waConstantsRepository.getByKey("COMBINED_FLYER");
                            await sendMediaMessage(userMobileNumber, flyer.dataValues.constantValue, "image", null, 0, "WA_Constants", flyer.dataValues.id, flyer.dataValues.constantMediaId, "constantMediaId");
                            await sleep(2000);
                        }
                    }
                    if (contactResponse) {
                        if (contactResponse.toLowerCase() == "student trial bot") {
                            await sendContactCardMessage(userMobileNumber, studentBotContactData);
                            let contactCardMessage = `👆Click on the Message button to get your student trial started.`;
                            await sendMessage(userMobileNumber, contactCardMessage);
                        } else if (contactResponse.toLowerCase() == "teacher trial bot") {
                            await sendContactCardMessage(userMobileNumber, teacherBotContactData);
                            let contactCardMessage = `👆Click on the Message button to get your teacher trial started.`;
                            await sendMessage(userMobileNumber, contactCardMessage);
                        } else if (contactResponse.toLowerCase() == "team member") {
                            await talkToBeajRep(profileId, userMobileNumber);
                        }
                    }
                    await createActivityLog(userMobileNumber, "text", "outbound", response, null);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "talk to beaj rep" || messageContent.toLowerCase() == "chat with beaj rep" || messageContent.toLowerCase() == "get help")
                ) {
                    await talkToBeajRep(profileId, userMobileNumber);
                    return;
                }

                // DEMO COURSE
                // Step 1: If user does not exist
                if (userExists == false) {
                    if (botPhoneNumberId == studentBotPhoneNumberId) {
                        await greetingMessage(profileId, userMobileNumber, "kids");
                    } else {
                        await greetingMessage(profileId, userMobileNumber, "teachers");
                    }
                    return;
                }

                let currentUserState = await waUserProgressRepository.getByProfileId(profileId);
                let currentUserMetadata = await waUsersMetadataRepository.getByProfileId(profileId);

                if (currentUserState) {
                    const messageAuth = await checkUserMessageAndAcceptableMessages(profileId, userMobileNumber, currentUserState, messageType, messageContent);
                    if (messageAuth === false) {
                        return;
                    }
                }

                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "start again" || messageContent.toLowerCase() == "go to start") &&
                    (
                        currentUserState.dataValues.engagement_type == "School Admin Confirmation" ||
                        currentUserState.dataValues.engagement_type == "Parent or Student" ||
                        currentUserState.dataValues.engagement_type == "Thankyou Message - School Owner" ||
                        currentUserState.dataValues.engagement_type == "Payment Complete"
                    )
                ) {
                    await startOfFlow(profileId, userMobileNumber);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    messageContent.toLowerCase() == "start again" &&
                    (
                        currentUserState.dataValues.engagement_type == "Single Student Registration Complete" ||
                        currentUserState.dataValues.engagement_type == "Payment Details"
                    )
                ) {
                    await confirmCancelRegistration(profileId, userMobileNumber, currentUserState.dataValues.engagement_type);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    messageContent.toLowerCase() == "yes" &&
                    currentUserState.dataValues.engagement_type == "Cancel Registration Confirmation - Single Student Registration Complete"
                ) {
                    await cancelRegistration(profileId, userMobileNumber);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    messageContent.toLowerCase() == "no" &&
                    currentUserState.dataValues.engagement_type == "Cancel Registration Confirmation - Single Student Registration Complete"
                ) {
                    await singleStudentRegistationComplate(profileId, userMobileNumber);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    messageContent.toLowerCase() == "yes" &&
                    currentUserState.dataValues.engagement_type == "Cancel Registration Confirmation - Payment Details"
                ) {
                    await cancelRegistration(profileId, userMobileNumber);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    messageContent.toLowerCase() == "no" &&
                    currentUserState.dataValues.engagement_type == "Cancel Registration Confirmation - Payment Details"
                ) {
                    await paymentDetails(profileId, userMobileNumber);
                    return;
                }


                // DEMO COURSE
                // Kids Summer Camp Trial
                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "start" || messageContent.toLowerCase() == "start free trial") &&
                    botPhoneNumberId == studentBotPhoneNumberId &&
                    (currentUserState.dataValues.engagement_type == "Greeting Message" || currentUserState.dataValues.engagement_type == "Greeting Message - Kids")
                ) {
                    await kidsChooseClass(profileId, userMobileNumber);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "no, choose again") &&
                    (currentUserState.dataValues.engagement_type == "Confirm Class - Level 1" || currentUserState.dataValues.engagement_type == "Confirm Class - Level 3")
                ) {
                    await kidsChooseClassLoop(profileId, userMobileNumber);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (
                        messageContent.toLowerCase() == "end now" ||
                        messageContent.toLowerCase() == "go to registration" ||
                        messageContent.toLowerCase() == "register now" ||
                        messageContent.toLowerCase() == "skip trial"
                    ) &&
                    (
                        currentUserState.dataValues.engagement_type == "Free Trial - Teachers" ||
                        currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" ||
                        currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3" ||
                        currentUserState.dataValues.engagement_type == "Greeting Message - Kids" ||
                        currentUserState.dataValues.engagement_type == "Choose Class"
                    )
                ) {
                    if (botPhoneNumberId == studentBotPhoneNumberId) {
                        await getUserProfile(profileId, userMobileNumber);
                    } else {
                        await endTrialTeachers(profileId, userMobileNumber);
                    }
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "get another trial") &&
                    (currentUserState.dataValues.engagement_type == "End Now" || currentUserState.dataValues.engagement_type == "Free Trial - Teachers" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3")
                ) {
                    if (botPhoneNumberId == studentBotPhoneNumberId) {
                        await kidsChooseClassLoop(profileId, userMobileNumber);
                    } else {
                        await greetingMessageLoop(profileId, userMobileNumber);
                    }
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "register" || messageContent.toLowerCase() == "camp registration" || messageContent.toLowerCase() == "go to registration" || messageContent.toLowerCase() == "register now") &&
                    (
                        currentUserState.dataValues.engagement_type == "End Now" ||
                        currentUserState.dataValues.engagement_type == "Free Trial - Teachers" ||
                        currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" ||
                        currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3" ||
                        currentUserState.dataValues.engagement_type == "Greeting Message - Kids"
                    )
                ) {
                    if (botPhoneNumberId == studentBotPhoneNumberId) {
                        // Kids Product: Parent + School
                        await getUserProfile(profileId, userMobileNumber);
                    } else {
                        // Teachers Product
                        await getSchoolName(profileId, userMobileNumber);
                    }
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (currentUserState.dataValues.engagement_type == "User Profile")
                ) {
                    if (messageContent.toLowerCase() == "school admin") {
                        await schoolAdminConfirmation(profileId, userMobileNumber);
                    } else if (messageContent.toLowerCase() == "parent or student") {
                        await parentOrStudentSelection(profileId, userMobileNumber);
                    } else {
                        return;
                    }
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (currentUserState.dataValues.engagement_type == "School Admin Confirmation")
                ) {
                    if (messageContent.toLowerCase() == "school admin") {
                        let prospectusPdf = await waConstantsRepository.getByKey("SUMMER_CAMP_PROSPECTUS_PDF");
                        await sendMediaMessage(userMobileNumber, prospectusPdf.dataValues.constantValue, "pdf", "Summer Camp Prospectus for Schools", 0, "WA_Constants", prospectusPdf.dataValues.id, prospectusPdf.dataValues.constantMediaId, "constantMediaId");
                        await sleep(4000);
                        await waUserProgressRepository.updatePersona(profileId, userMobileNumber, "school admin");
                        await getSchoolName(profileId, userMobileNumber);
                        return;
                    } else if (messageContent.toLowerCase() == "parent or student") {
                        await parentOrStudentSelection(profileId, userMobileNumber);
                    } else {
                        return;
                    }
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (currentUserState.dataValues.engagement_type == "School Name")
                ) {
                    await confirmSchoolName(profileId, userMobileNumber, messageContent);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "yes") &&
                    (currentUserState.dataValues.engagement_type == "Confirm School Name")
                ) {
                    await getCityName(profileId, userMobileNumber);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "no") &&
                    (currentUserState.dataValues.engagement_type == "Confirm School Name")
                ) {
                    await getSchoolName(profileId, userMobileNumber);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (currentUserState.dataValues.engagement_type == "City Name" || currentUserState.dataValues.engagement_type == "Confirm City Name")
                ) {
                    await thankyouMessageSchoolOwner(profileId, userMobileNumber, messageContent);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "no") &&
                    (currentUserState.dataValues.engagement_type == "Confirm City Name")
                ) {
                    await getCityName(profileId, userMobileNumber);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "ready to register" || messageContent.toLowerCase() == "ready for payment") &&
                    (currentUserState.dataValues.engagement_type == "Ready to Pay")
                ) {
                    await thankyouMessageParent(profileId, userMobileNumber);
                    return;
                }

                if (currentUserState.dataValues.engagement_type == "Thankyou Message - Parent" ||
                    currentUserState.dataValues.engagement_type == "Thankyou Message - School Owner" ||
                    currentUserState.dataValues.engagement_type == "Thankyou Message"
                ) {
                    if (messageContent.toLowerCase() == "get another trial") {
                        if (botPhoneNumberId == studentBotPhoneNumberId) {
                            await kidsChooseClassLoop(profileId, userMobileNumber);
                        } else {
                            await greetingMessageLoop(profileId, userMobileNumber);
                        }
                        return;
                    } else {
                        await sendMessage(userMobileNumber, "Your free trial is complete. We will get back to you soon.");
                        return;
                    }
                }

                // Multi User Registration
                if (
                    text_message_types.includes(message.type) &&
                    (currentUserState.dataValues.engagement_type == "Parent or Student") &&
                    (messageContent.toLowerCase() == "register on whatsapp")
                ) {
                    await studentNameInput(profileId, userMobileNumber);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (currentUserState.dataValues.engagement_type == "Student Name Input")
                ) {
                    await studentNameConfirmation(profileId, userMobileNumber, messageContent);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (currentUserState.dataValues.engagement_type == "Student Name Confirmation") &&
                    (messageContent.toLowerCase() == "no" || messageContent.toLowerCase() == "no, type again")
                ) {
                    await studentNameInput(profileId, userMobileNumber);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (currentUserState.dataValues.engagement_type == "Student Name Confirmation") &&
                    (messageContent.toLowerCase() == "yes")
                ) {
                    await studentGenericClassInput(profileId, userMobileNumber);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (currentUserState.dataValues.engagement_type == "Student Generic Class Input") &&
                    (
                        messageContent.toLowerCase() == "class 1, 2 or 3" ||
                        messageContent.toLowerCase() == "class 4, 5 or 6" ||
                        messageContent.toLowerCase() == "class 7 and above"
                    )
                ) {
                    if (messageContent.toLowerCase() == "class 7 and above") {
                        await studentSpecificClassConfirmation(profileId, userMobileNumber, messageContent);
                    } else {
                        await studentGenericClassConfirmation(profileId, userMobileNumber, messageContent);
                    }
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (currentUserState.dataValues.engagement_type == "Student Generic Class Confirmation") &&
                    (messageContent.toLowerCase() == "no" || messageContent.toLowerCase() == "no, choose again")
                ) {
                    await studentGenericClassInput(profileId, userMobileNumber);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (currentUserState.dataValues.engagement_type == "Student Generic Class Confirmation") &&
                    (messageContent.toLowerCase() == "yes")
                ) {
                    await studentSpecificClassInput(profileId, userMobileNumber, currentUserMetadata.dataValues.classLevel);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (currentUserState.dataValues.engagement_type == "Student Specific Class Input") &&
                    (
                        messageContent.toLowerCase() == "class 1" ||
                        messageContent.toLowerCase() == "class 2" ||
                        messageContent.toLowerCase() == "class 3" ||
                        messageContent.toLowerCase() == "class 4" ||
                        messageContent.toLowerCase() == "class 5" ||
                        messageContent.toLowerCase() == "class 6" ||
                        messageContent.toLowerCase() == "class 7 and above"
                    )
                ) {
                    await studentSpecificClassConfirmation(profileId, userMobileNumber, messageContent);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (currentUserState.dataValues.engagement_type == "Student Specific Class Confirmation") &&
                    (messageContent.toLowerCase() == "no")
                ) {
                    await studentSpecificClassInput(profileId, userMobileNumber, currentUserMetadata.dataValues.classLevel);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (currentUserState.dataValues.engagement_type == "Student Specific Class Confirmation") &&
                    (messageContent.toLowerCase() == "yes")
                ) {
                    await singleStudentRegistationComplate(profileId, userMobileNumber);
                    return;
                }

                if (
                    text_message_types.includes(message.type) &&
                    (currentUserState.dataValues.engagement_type == "Single Student Registration Complete") &&
                    messageContent.toLowerCase() == "go to payment"
                ) {
                    await paymentDetails(profileId, userMobileNumber);
                    return;
                }


                if (
                    text_message_types.includes(message.type) &&
                    (currentUserState.dataValues.engagement_type == "Single Student Registration Complete") &&
                    (messageContent.toLowerCase() == "register new student")
                ) {
                    const profile_type = "student";
                    let profile = await waProfileRepository.create({ phone_number: userMobileNumber, bot_phone_number_id: botPhoneNumberId, profile_type: profile_type });
                    profileId = profile.dataValues.profile_id;
                    await waUsersMetadataRepository.create({ profile_id: profileId, phoneNumber: userMobileNumber, userClickedLink: new Date() });
                    await waActiveSessionRepository.updateCurrentProfileIdOnPhoneNumber(userMobileNumber, profileId, botPhoneNumberId);
                    await waUserProgressRepository.create({ profile_id: profileId, phoneNumber: userMobileNumber, engagement_type: "Greeting Message", lastUpdated: new Date(), persona: "parent or student" });
                    await studentNameInput(profileId, userMobileNumber);
                    return;
                }

                if (
                    (message.type == "image") &&
                    (currentUserState.dataValues.engagement_type == "Payment Details")
                ) {
                    await paymentComplete(profileId, userMobileNumber, inboundUploadedImage);
                    return;
                } else if (
                    (message.type != "image") &&
                    (currentUserState.dataValues.engagement_type == "Payment Details")
                ) {
                    await sendButtonMessage(userMobileNumber, "Please send us a screenshot of your payment or click on Chat with Beaj Rep to talk to us.", [{ id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }]);
                    return;
                }





                // Teacher Training Trial
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
                    } else {
                        courseName = "Free Trial - Teachers";
                    }

                    // Delete all question responses for the user
                    await waQuestionResponsesRepository.deleteByProfileId(profileId);
                    const startingLesson = await lessonRepository.getNextLesson(await courseRepository.getCourseIdByName(courseName), 1, null, null);
                    await demoCourseStart(profileId, userMobileNumber, startingLesson, courseName);
                    // Send first lesson to user
                    currentUserState = await waUserProgressRepository.getByProfileId(profileId);
                    if (courseName == "Free Trial - Teachers") {
                        await sendCourseLessonToTeacher(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent);
                    } else {
                        await sendCourseLessonToKid(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent);
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
                        if (courseName == "Free Trial - Teachers") {
                            await sendCourseLessonToTeacher(profileId, userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
                        } else {
                            await sendCourseLessonToKid(profileId, userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
                        }
                    }
                    return;

                }

                // If user completes an activity and wants to try the next activity
                if (text_message_types.includes(message.type)) {
                    if (
                        messageContent.toLowerCase().includes("start next activity") ||
                        messageContent.toLowerCase().includes("next challenge") ||
                        messageContent.toLowerCase().includes("go to next activity") ||
                        messageContent.toLowerCase().includes("next activity") ||
                        messageContent.toLowerCase().includes("start questions") ||
                        messageContent.toLowerCase().includes("start challenge") ||
                        messageContent.toLowerCase().includes("next")
                    ) {
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
                            if (currentUserState.dataValues.engagement_type == "Free Trial - Teachers") {
                                await sendCourseLessonToTeacher(profileId, userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
                            } else {
                                await sendCourseLessonToKid(profileId, userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
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
                                if (currentUserState.dataValues.engagement_type == "Free Trial - Teachers") {
                                    await sendCourseLessonToTeacher(profileId, userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
                                } else {
                                    await sendCourseLessonToKid(profileId, userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
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
                        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);

                        // Update user progress to next question
                        if (currentUserState.dataValues.engagement_type == "Free Trial - Teachers") {
                            await sendCourseLessonToTeacher(profileId, userMobileNumber, currentUserState, currentLesson, messageType, messageContent);
                        } else {
                            await sendCourseLessonToKid(profileId, userMobileNumber, currentUserState, currentLesson, messageType, messageContent);
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
                    "+923704558660",
                    "+923012232148",
                ];

                // START MAIN COURSE
                if (
                    text_message_types.includes(message.type) &&
                    messageContent.toLowerCase().includes("start my course")
                ) {
                    await startCourseForUser(profileId, userMobileNumber, numbers_to_ignore);
                    return;
                }

                // NORMAL COURSE
                currentUserState = await waUserProgressRepository.getByProfileId(profileId);
                if (
                    text_message_types.includes(message.type) &&
                    (messageContent.toLowerCase() == "start" || messageContent.toLowerCase() == "start!")
                ) {
                    if (currentUserState.dataValues.engagement_type == "Course Start") {
                        const startingLesson = await lessonRepository.getNextLesson(currentUserState.dataValues.currentCourseId, 1, null, null);
                        await levelCourseStart(profileId, userMobileNumber, startingLesson, currentUserState.dataValues.currentCourseId);
                        // Send first lesson to user
                        currentUserState = await waUserProgressRepository.getByProfileId(profileId);
                        if (currentUserState.dataValues.persona == "kid" || currentUserState.dataValues.persona == "parent or student" || currentUserState.dataValues.persona == "school admin") {
                            await sendCourseLessonToKid(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent);
                        } else {
                            await sendCourseLessonToTeacher(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent);
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
                            if (currentUserState.dataValues.persona == "kid" || currentUserState.dataValues.persona == "parent or student" || currentUserState.dataValues.persona == "school admin") {
                                await sendCourseLessonToKid(profileId, userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
                            } else {
                                await sendCourseLessonToTeacher(profileId, userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
                            }
                        }
                        return;
                    }
                }

                if (text_message_types.includes(message.type) && currentUserState.dataValues.activityType == "watchAndSpeak") {
                    const currentLesson = await lessonRepository.getCurrentLesson(currentUserState.dataValues.currentLessonId);
                    if (messageContent.toLowerCase().includes("yes") || messageContent.toLowerCase().includes("no")) {
                        if (currentUserState.dataValues.persona == "kid" || currentUserState.dataValues.persona == "parent or student" || currentUserState.dataValues.persona == "school admin") {
                            await sendCourseLessonToKid(profileId, userMobileNumber, currentUserState, currentLesson, messageType, messageContent);
                        } else {
                            await sendCourseLessonToTeacher(profileId, userMobileNumber, currentUserState, currentLesson, messageType, messageContent);
                        }
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
                        messageContent.toLowerCase().includes("no") ||
                        messageContent.toLowerCase().includes("next")
                    ) {
                        if (
                            messageContent.toLowerCase().includes("it was great") ||
                            messageContent.toLowerCase().includes("it was great 😁") ||
                            messageContent.toLowerCase().includes("it can be improved") ||
                            messageContent.toLowerCase().includes("it can be improved 🤔")
                        ) {
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

                        if (messageContent.toLowerCase().includes("next") && latestUserState.dataValues.activityType == "feedbackAudio") {
                            await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null);
                            await endingMessage(profileId, userMobileNumber, currentUserState, theStartingLesson);
                        }

                        if (!nextLesson) {
                            // Check if current lesson
                            const lessonNumberCheck = (currentUserState.dataValues.currentWeek - 1) * 6 + currentUserState.dataValues.currentDay;
                            if (lessonNumberCheck >= 24) {
                                await sendButtonMessage(userMobileNumber, 'You have completed all the lessons in this course. Click the button below to proceed', [{ id: 'start_my_course', title: 'Start my course' }]);
                                await createActivityLog(userMobileNumber, "template", "outbound", "You have completed all the lessons in this course. Click the button below to proceed", null);
                                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start my course"]);
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
                        if (currentUserState.dataValues.persona == "kid" || currentUserState.dataValues.persona == "parent or student" || currentUserState.dataValues.persona == "school admin") {
                            await sendCourseLessonToKid(profileId, userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
                        } else {
                            await sendCourseLessonToTeacher(profileId, userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
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
                            if (currentUserState.dataValues.persona == "kid" || currentUserState.dataValues.persona == "parent or student" || currentUserState.dataValues.persona == "school admin") {
                                await sendCourseLessonToKid(profileId, userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
                            } else {
                                await sendCourseLessonToTeacher(profileId, userMobileNumber, latestUserState, nextLesson, messageType, messageContent);
                            }
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
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);

                    // Update user progress to next question
                    if (currentUserState.dataValues.persona == "kid" || currentUserState.dataValues.persona == "parent or student" || currentUserState.dataValues.persona == "school admin") {
                        await sendCourseLessonToKid(profileId, userMobileNumber, currentUserState, currentLesson, messageType, messageContent);
                    } else {
                        await sendCourseLessonToTeacher(profileId, userMobileNumber, currentUserState, currentLesson, messageType, messageContent);
                    }
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
