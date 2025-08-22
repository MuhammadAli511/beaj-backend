import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import { sendButtonMessage, sendMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import waConstantsRepository from "../repositories/waConstantsRepository.js";
import { text_message_types } from "../constants/constants.js";


const greetingMessageTeachers = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.create({
        profile_id: profileId,
        phoneNumber: userMobileNumber,
        engagement_type: "Greeting Message",
        lastUpdated: new Date(),
    });
    let greetingMessageText = "";
    greetingMessageText = `Welcome to Beaj Education! 👋\n\nI'm Ms. Beaj - here to guide you!\n\n👇Click on the “Start button”`;

    const greetingImage = await waConstantsRepository.getByKey("TEACHER_GREETING");
    if (greetingImage) {
        await sendButtonMessage(userMobileNumber, greetingMessageText, [{ id: 'start', title: 'Start' }], 0, greetingImage.dataValues.constantValue, null, "WA_Constants", greetingImage.dataValues.id, greetingImage.dataValues.constantMediaId, null, "constantMediaId");
        await createActivityLog(userMobileNumber, "image", "outbound", greetingImage.dataValues.constantValue, null);
    }
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start"]);
    return;
};

const greetingMessageLoop = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Greeting Message");
    const greetingMessageText = "👇Click on the “Start button”";
    await sendButtonMessage(userMobileNumber, greetingMessageText, [{ id: 'start', title: 'Start' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", greetingMessageText, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start"]);
};

const endTrialTeachers = async (profileId, userMobileNumber) => {
    await waUsersMetadataRepository.updateFreeDemoEnded(profileId, userMobileNumber);
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "End Now");
    let endTrialMessage = "You have chosen to end your free trial. Next Steps:";
    const freeTrialCompleteImage = await waConstantsRepository.getByKey("FREE_TRIAL_COMPLETE_IMAGE");
    const user = await waUsersMetadataRepository.getByProfileId(profileId);
    if (freeTrialCompleteImage) {
        if (user.dataValues.userRegistrationComplete) {
            await sendButtonMessage(userMobileNumber, endTrialMessage, [{ id: 'get_another_trial', title: 'Get Another Trial' }], 0, freeTrialCompleteImage.dataValues.constantValue, null, "WA_Constants", freeTrialCompleteImage.dataValues.id, freeTrialCompleteImage.dataValues.constantMediaId, null, "constantMediaId");
        } else {
            await sendButtonMessage(userMobileNumber, endTrialMessage, [{ id: 'get_another_trial', title: 'Get Another Trial' }, { id: 'register', title: 'Register' }], 0, freeTrialCompleteImage.dataValues.constantValue, null, "WA_Constants", freeTrialCompleteImage.dataValues.id, freeTrialCompleteImage.dataValues.constantMediaId, null, "constantMediaId");
        }
    }
    await createActivityLog(userMobileNumber, "template", "outbound", endTrialMessage, null);
    if (user.dataValues.userRegistrationComplete) {
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["get another trial"]);
    } else {
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["get another trial", "register"]);
    }
};

const getSchoolName = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "School Name");
    const schoolInputMessage = "Please type your school's name:";
    await sendMessage(userMobileNumber, schoolInputMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", schoolInputMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["text"]);
};

const confirmSchoolName = async (profileId, userMobileNumber, messageContent) => {
    await waUsersMetadataRepository.updateSchoolName(profileId, userMobileNumber, messageContent);
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Confirm School Name");
    const confirmSchoolNameMessage = "Please confirm your school's name: " + messageContent;
    await sendButtonMessage(userMobileNumber, confirmSchoolNameMessage, [{ id: 'yes', title: 'Yes' }, { id: 'no', title: 'No' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", confirmSchoolNameMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["yes", "no"]);
};

const getCityName = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "City Name");
    const cityInputMessage = "Please type your city's name:";
    await sendMessage(userMobileNumber, cityInputMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", cityInputMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["text"]);
};

const thankyouMessage = async (profileId, userMobileNumber, messageContent) => {
    await waUsersMetadataRepository.updateCityName(profileId, userMobileNumber, messageContent);
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Thankyou Message");
    await waUserProgressRepository.update(profileId, userMobileNumber, null, null, null, null, null, null, null, null, ["go to start", "chat with beaj rep"]);
    const schoolRegistrationImage = await waConstantsRepository.getByKey("SCHOOL_REGISTRATION_IMAGE");
    if (schoolRegistrationImage) {
        let thankyouMessage = "📳 A Beaj team member will call you within 24 hours to discuss a partnership with your school!\nWe look forward to speaking with you soon!\nاگلے 24 گھنٹے میں بیج ٹیم کا نمائندہ آپ سے اسکول پارٹنرشپ کے لئے رابطہ کرے گا۔ ہم آپ سے بات کرنے کے منتظر ہیں! \n\nIn the meantime, if you have any questions, please click on 'Chat with Beaj Rep' to talk to our team.\nاس دوران اگر آپ کے کوئ سوال ہیں، تو ‘Chat with Beaj Rep’ پر کلک کیجیئے اور ہم سے رابطہ کریں۔";
        await sendButtonMessage(userMobileNumber, thankyouMessage, [{ id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }, { id: 'go_to_start', title: 'Go to Start' }], 0, schoolRegistrationImage.dataValues.constantValue, null, "WA_Constants", schoolRegistrationImage.dataValues.id, schoolRegistrationImage.dataValues.constantMediaId, null, "constantMediaId");
        await createActivityLog(userMobileNumber, "image", "outbound", schoolRegistrationImage.dataValues.constantValue, null);
    }
    await waUsersMetadataRepository.update(profileId, userMobileNumber, { userRegistrationComplete: new Date() });
};

const teachersTrialFlowDriver = async (profileId, userMobileNumber, engagementType, messageContent, messageType, inboundUploadedImage) => {
    const endpointHandlers = [
        {
            engagementTypes: ["New User"],
            messages: ["*"],
            handler: () => greetingMessageTeachers(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Free Trial - Teachers"],
            messages: ["end now", "go to registration", "register now", "skip trial"],
            handler: () => endTrialTeachers(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Free Trial - Teachers", "End Now"],
            messages: ["register", "camp registration", "go to registration", "register now"],
            handler: () => getSchoolName(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["School Name"],
            messages: ["*"],
            handler: () => confirmSchoolName(profileId, userMobileNumber, messageContent)
        },
        {
            engagementTypes: ["Confirm School Name"],
            messages: ["yes"],
            handler: () => getCityName(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Confirm School Name"],
            messages: ["no"],
            handler: () => getSchoolName(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["City Name"],
            messages: ["*"],
            handler: () => thankyouMessage(profileId, userMobileNumber, messageContent)
        },
        // KEEP BELOW TWO TOGETHER IN SAME ORDER
        {
            engagementTypes: ["Free Trial - Teachers", "End Now", "Thankyou Message"],
            messages: ["get another trial", "go to start"],
            handler: () => greetingMessageLoop(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Thankyou Message"],
            messages: ["*"],
            handler: () => sendMessage(userMobileNumber, "Your free trial is complete. We will get back to you soon.")
        },
    ];

    let matchedHandler = null;

    if (messageContent && messageType) {
        for (const config of endpointHandlers) {
            if (!config.engagementTypes.includes(engagementType)) continue;

            if (text_message_types.includes(messageType) && (config.messages.includes(messageContent.toLowerCase()) || config.messages.includes('*'))) {
                matchedHandler = config.handler;
                break;
            }
        }
    } else {
        for (const config of endpointHandlers) {
            if (config.engagementTypes.includes(engagementType)) {
                matchedHandler = config.handler;
                break;
            }
        }
    }

    if (matchedHandler) {
        await matchedHandler();
        return true;
    }

    return false;
};


export default { teachersTrialFlowDriver };