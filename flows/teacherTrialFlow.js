import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import { sendButtonMessage, sendMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import waConstantsRepository from "../repositories/waConstantsRepository.js";


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
        // KEEP BELOW TWO TOGETHER IN SAME ORDER
        {
            engagementTypes: ["Free Trial - Teachers", "End Now", "Thankyou Message"],
            messages: ["get another trial"],
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

            if (config.messages.includes(messageContent.toLowerCase()) || config.messages.includes('*')) {
                matchedHandler = config.handler;
                break;
            }
        }

        if (!matchedHandler) {
            for (const config of endpointHandlers) {
                if (config.engagementTypes.includes(engagementType)) {
                    matchedHandler = config.handler;
                    break;
                }
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

    await sendMessage(userMobileNumber, "Sorry, I didn't understand that. Please try again.");
    await createActivityLog(userMobileNumber, "text", "outbound", "Sorry, I didn't understand that. Please try again.", null);
    return false;
};


export default { teachersTrialFlowDriver };