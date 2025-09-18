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

const resetCourseKid = async (phoneNumber, botPhoneNumberId) => {
    // First, delete all existing data like "reset all"
    await waUsersMetadataRepository.deleteByPhoneNumber(phoneNumber);
    await waUserProgressRepository.deleteByPhoneNumber(phoneNumber);
    await waUserActivityLogsRepository.deleteByPhoneNumber(phoneNumber);
    await waLessonsCompletedRepository.deleteByPhoneNumber(phoneNumber);
    await waQuestionResponsesRepository.deleteByPhoneNumber(phoneNumber);
    await waActiveSessionRepository.deleteByPhoneNumber(phoneNumber);
    await waProfileRepository.deleteByPhoneNumber(phoneNumber);
    await waPurchasedCoursesRepository.deleteByPhoneNumber(phoneNumber);

    // Create test profiles
    const profiles = [
        { phone_number: phoneNumber, bot_phone_number_id: botPhoneNumberId, profile_type: 'student' },
        { phone_number: phoneNumber, bot_phone_number_id: botPhoneNumberId, profile_type: 'student' },
        { phone_number: phoneNumber, bot_phone_number_id: botPhoneNumberId, profile_type: 'student' },
        { phone_number: phoneNumber, bot_phone_number_id: botPhoneNumberId, profile_type: 'student' }
    ];

    const createdProfiles = [];
    for (const profileData of profiles) {
        const profile = await waProfileRepository.create(profileData);
        createdProfiles.push(profile);
    }

    // Create user metadata for each profile
    const userMetadata = [
        { phoneNumber: phoneNumber, name: 'user 1', userClickedLink: new Date(), userRegistrationComplete: new Date(), profile_id: createdProfiles[0].dataValues.profile_id, classLevel: 'grade 1' },
        { phoneNumber: phoneNumber, name: 'user 2', userClickedLink: new Date(), userRegistrationComplete: new Date(), profile_id: createdProfiles[1].dataValues.profile_id, classLevel: 'grade 2' },
        { phoneNumber: phoneNumber, name: 'user 3', userClickedLink: new Date(), userRegistrationComplete: new Date(), profile_id: createdProfiles[2].dataValues.profile_id, classLevel: 'grade 3' },
        { phoneNumber: phoneNumber, name: 'user 4', userClickedLink: new Date(), userRegistrationComplete: new Date(), profile_id: createdProfiles[3].dataValues.profile_id, classLevel: 'grade 4' },
    ];

    for (const metadata of userMetadata) {
        await waUsersMetadataRepository.create(metadata);
    }

    // Create user progress for each profile
    const userProgress = [
        { profile_id: createdProfiles[0].dataValues.profile_id, phoneNumber: phoneNumber, persona: 'kid', engagement_type: 'Course Start', acceptableMessages: ['start now!'], lastUpdated: new Date() },
        { profile_id: createdProfiles[1].dataValues.profile_id, phoneNumber: phoneNumber, persona: 'kid', engagement_type: 'Course Start', acceptableMessages: ['start now!'], lastUpdated: new Date() },
        { profile_id: createdProfiles[2].dataValues.profile_id, phoneNumber: phoneNumber, persona: 'kid', engagement_type: 'Course Start', acceptableMessages: ['start now!'], lastUpdated: new Date() },
        { profile_id: createdProfiles[3].dataValues.profile_id, phoneNumber: phoneNumber, persona: 'kid', engagement_type: 'Course Start', acceptableMessages: ['start now!'], lastUpdated: new Date() }
    ];

    for (const progress of userProgress) {
        await waUserProgressRepository.create(progress);
    }

    // Create purchased courses
    const paymentProof = "https://beajbloblive.blob.core.windows.net/beajdocuments/20250618163609353-d5f65630-4f1e-4b87-974d-44034f71c1d5-1664985517525471";
    const purchasedCourses = [
        { phoneNumber: phoneNumber, courseCategoryId: 71, courseId: 119, courseStartDate: new Date(), purchaseDate: new Date(), profile_id: createdProfiles[0].dataValues.profile_id, paymentProof: paymentProof, paymentStatus: 'Approved' },
        { phoneNumber: phoneNumber, courseCategoryId: 71, courseId: 120, courseStartDate: new Date(), purchaseDate: new Date(), profile_id: createdProfiles[1].dataValues.profile_id, paymentProof: paymentProof, paymentStatus: 'Approved' },
        { phoneNumber: phoneNumber, courseCategoryId: 71, courseId: 121, courseStartDate: new Date(), purchaseDate: new Date(), profile_id: createdProfiles[2].dataValues.profile_id, paymentProof: paymentProof, paymentStatus: 'Approved' },
        { phoneNumber: phoneNumber, courseCategoryId: 71, courseId: 122, courseStartDate: new Date(), purchaseDate: new Date(), profile_id: createdProfiles[3].dataValues.profile_id, paymentProof: paymentProof, paymentStatus: 'Approved' }
    ];

    for (const purchase of purchasedCourses) {
        await waPurchasedCoursesRepository.create(purchase);
    }

    await sendMessage(phoneNumber, "Test data has been created for kid profiles.");
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
    } else if (messageContent.toLowerCase() == "reset course kid") {
        await resetCourseKid(userMobileNumber, "608292759037444");
    }
};

export { specialCommandFlow };