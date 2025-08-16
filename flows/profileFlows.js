import waProfileRepository from "../repositories/waProfileRepository.js";
import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waActiveSessionRepository from "../repositories/waActiveSessionRepository.js";
import { sendButtonMessage, sendMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { sleep } from "../utils/utils.js";
import { youth_camp_grades, grades_and_class_names, beaj_team_numbers } from "../constants/constants.js";
import { startCourseForUser } from "../utils/chatbotUtils.js";


const chooseProfileFlow = async (profileId, userMobileNumber, botPhoneNumberId, chooseProfile) => {
    const profiles = await waProfileRepository.getAllSortOnProfileId(userMobileNumber);
    const userMetadata = await waUsersMetadataRepository.getByPhoneNumber(userMobileNumber);
    for (let i = 0; i < profiles.length; i += 3) {
        const profileChunk = profiles.slice(i, i + 3);
        let profileMessage = "Choose user:\n";

        // Create message for this chunk
        profileChunk.forEach((profile, chunkIndex) => {
            const globalIndex = i + chunkIndex;
            const matchingUser = userMetadata.find(user => user.dataValues.profile_id === profile.dataValues.profile_id);
            let classLevel = matchingUser.dataValues.classLevel.toLowerCase();
            if (youth_camp_grades.includes(classLevel)) {
                classLevel = "Youth Camp";
            } else if (grades_and_class_names.includes(classLevel)) {
                classLevel = classLevel.charAt(0).toUpperCase() + classLevel.slice(1);
            } else {
                classLevel = "Youth Camp";
            }
            profileMessage += `${String.fromCharCode(65 + globalIndex)}) ${matchingUser.dataValues.name} - ${classLevel}\n`;
        });

        // Create buttons for this chunk
        const buttons = profileChunk.map((profile, chunkIndex) => {
            const globalIndex = i + chunkIndex;
            return { id: String(profile.dataValues.profile_id), title: String.fromCharCode(65 + globalIndex) };
        });

        await sendButtonMessage(userMobileNumber, profileMessage.trim(), buttons);
        await createActivityLog(userMobileNumber, "template", "outbound", profileMessage.trim(), null);
        await sleep(1000);
    }
    const acceptableMessagesList = Array.from({ length: profiles.length }, (_, i) => String.fromCharCode(65 + i));
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Choose User");
    if (chooseProfile) {
        await waActiveSessionRepository.create({ phone_number: userMobileNumber, bot_phone_number_id: botPhoneNumberId, profile_id: profileId });
    }
    return;
};

const userSwitchingFlow = async (profileId, userMobileNumber, botPhoneNumberId, messageContent, activeSession) => {
    const profiles = await waProfileRepository.getAllSortOnProfileId(userMobileNumber);
    const oldProfileId = profileId;
    const index = messageContent.toLowerCase().charCodeAt(0) - 97;
    const profile = profiles[index];
    if (!profile) {
        await sendMessage(userMobileNumber, "Invalid profile selected. Please try again.");
        return;
    }
    profileId = profile.dataValues.profile_id;
    const selectedUserState = await waUserProgressRepository.getByProfileId(profileId);

    if (!selectedUserState.dataValues.currentCourseId) {
        const courseStarted = await startCourseForUser(profileId, userMobileNumber, beaj_team_numbers);
        if (!courseStarted) {
            return;
        }
        await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Course Start");
    } else {
        const acceptableMessages = selectedUserState.dataValues.acceptableMessages;
        if (acceptableMessages && acceptableMessages.length > 0) {
            for (let i = 0; i < acceptableMessages.length; i += 3) {
                const messageChunk = acceptableMessages.slice(i, i + 3);
                const buttons = messageChunk.map(message => ({
                    id: message.replace(/\s+/g, '_').toLowerCase(),
                    title: message.charAt(0).toUpperCase() + message.slice(1)
                }));

                const messageText = i === 0 ? "Continue where you left off:" : "More options:";
                await sendButtonMessage(userMobileNumber, messageText, buttons);
                await createActivityLog(userMobileNumber, "template", "outbound", messageText + " " + messageChunk.join(", "), null);

                if (i + 3 < acceptableMessages.length) {
                    await sleep(500);
                }
            }
        }
    }
    if (!activeSession) {
        await waActiveSessionRepository.create({ phone_number: userMobileNumber, bot_phone_number_id: botPhoneNumberId, profile_id: profileId });
    } else {
        await waUserProgressRepository.updateEngagementType(oldProfileId, userMobileNumber, "Course Start");
        await waActiveSessionRepository.updateCurrentProfileIdOnPhoneNumber(userMobileNumber, profileId, botPhoneNumberId);
    }
    return;
};

export { chooseProfileFlow, userSwitchingFlow };