import waUserActivityLogsRepository from "../repositories/waUserActivityLogsRepository.js";
import waActiveSessionRepository from "../repositories/waActiveSessionRepository.js";
import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import waProfileRepository from "../repositories/waProfileRepository.js";
import waPurchasedCoursesRepository from "../repositories/waPurchasedCoursesRepository.js";
import { beaj_team_numbers } from "../constants/constants.js";
import { sendMessage } from "../utils/whatsappUtils.js";

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
    const profile = await waProfileRepository.getByProfileId(profileId);
    const profileType = profile.dataValues.profile_type;
    if (profileType == "teacher") {
        await waUserProgressRepository.update(profileId, phoneNumber, null, null, null, null, null, null, null, null, ["start my course"]);
    } else {
        await waUserProgressRepository.update(profileId, phoneNumber, null, null, null, null, null, null, null, null, ["start now!"]);
    }
    await waUserProgressRepository.updateEngagementType(profileId, phoneNumber, "Course Start");
    await waUserActivityLogsRepository.deleteByPhoneNumber(phoneNumber);
    await waLessonsCompletedRepository.deleteByPhoneNumber(phoneNumber);
    await waQuestionResponsesRepository.deleteByPhoneNumber(phoneNumber);
    await sendMessage(phoneNumber, "Your data has been removed. Please start again using the link provided.");
};


const specialCommandFlow = async (profileId, userMobileNumber, messageContent) => {
    if (!beaj_team_numbers.includes(userMobileNumber)) {
        await sendMessage(userMobileNumber, "Sorry, you are not authorized to use this command.");
        return;
    }

    if (messageContent.toLowerCase() == "reset all") {
        await removeUser(userMobileNumber);
    } else if (messageContent.toLowerCase() == "reset course") {
        await removeUserTillCourse(profileId, userMobileNumber);
    }
};

export { specialCommandFlow };