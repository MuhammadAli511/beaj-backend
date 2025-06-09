import WA_UserProgress from '../models/WA_UserProgress.js';

const create = async (data) => {
    const userProgress = new WA_UserProgress(data);
    return await userProgress.save();
};

const getByPhoneNumber = async (phoneNumber) => {
    return await WA_UserProgress.findOne({
        where: {
            phoneNumber: phoneNumber
        }
    });
};

const getByProfileId = async (profileId) => {
    return await WA_UserProgress.findOne({
        where: {
            profile_id: profileId
        }
    });
};

const update = async (profileId, phoneNumber, currentCourseId, currentWeek, currentDay, currentLessonId, currentLesson_sequence, activityType, questionNumber, retryCounter, acceptableMessages) => {
    return await WA_UserProgress.update({
        currentCourseId: currentCourseId,
        currentWeek: currentWeek,
        currentDay: currentDay,
        currentLessonId: currentLessonId,
        currentLesson_sequence: currentLesson_sequence,
        activityType: activityType,
        questionNumber: questionNumber,
        retryCounter: retryCounter,
        acceptableMessages: acceptableMessages,
        lastUpdated: new Date()
    }, {
        where: {
            phoneNumber: phoneNumber,
            profile_id: profileId
        }
    });
};

const deleteByPhoneNumber = async (phoneNumber) => {
    return await WA_UserProgress.destroy({
        where: {
            phoneNumber: phoneNumber
        }
    });
};

const deleteByProfileId = async (profileId) => {
    return await WA_UserProgress.destroy({
        where: {
            profile_id: profileId
        }
    });
};

const updateAcceptableMessagesList = async (profileId, phoneNumber, acceptableMessages) => {
    return await WA_UserProgress.update({
        acceptableMessages: acceptableMessages,
        lastUpdated: new Date()
    }, {
        where: {
            phoneNumber: phoneNumber,
            profile_id: profileId
        }
    });
};

const updateEngagementType = async (profileId, phoneNumber, engagementType) => {
    return await WA_UserProgress.update({
        engagement_type: engagementType,
        lastUpdated: new Date()
    }, {
        where: {
            phoneNumber: phoneNumber,
            profile_id: profileId
        }
    });
};

const updateQuestionNumber = async (profileId, phoneNumber, questionNumber) => {
    return await WA_UserProgress.update({
        questionNumber: questionNumber,
        lastUpdated: new Date()
    }, {
        where: {
            phoneNumber: phoneNumber,
            profile_id: profileId
        }
    });
};

const updateRetryCounter = async (profileId, phoneNumber, retryCounter) => {
    return await WA_UserProgress.update({
        retryCounter: retryCounter,
        lastUpdated: new Date()
    }, {
        where: {
            phoneNumber: phoneNumber,
            profile_id: profileId
        }
    });
};

const updateQuestionNumberRetryCounterActivityType = async (profileId, phoneNumber, questionNumber, retryCounter, activityType, currentDifficultyLevel) => {
    return await WA_UserProgress.update({
        questionNumber: questionNumber,
        retryCounter: retryCounter,
        activityType: activityType,
        currentDifficultyLevel: currentDifficultyLevel,
        lastUpdated: new Date()
    }, {
        where: {
            phoneNumber: phoneNumber,
            profile_id: profileId
        }
    });
}

const updatePersona = async (profileId, phoneNumber, persona) => {
    return await WA_UserProgress.update({
        persona: persona
    }, {
        where: {
            phoneNumber: phoneNumber,
            profile_id: profileId
        }
    });
};

const updateTestUserProgress = async (phoneNumber, data) => {
    return await WA_UserProgress.update(data, {
        where: {
            phoneNumber: phoneNumber
        }
    });
};

export default {
    create,
    getByPhoneNumber,
    getByProfileId,
    update,
    deleteByPhoneNumber,
    deleteByProfileId,
    updateAcceptableMessagesList,
    updateQuestionNumber,
    updateRetryCounter,
    updateQuestionNumberRetryCounterActivityType,
    updateEngagementType,
    updatePersona,
    updateTestUserProgress
};
