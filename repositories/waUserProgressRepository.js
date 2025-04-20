import WA_UserProgress from '../models/WA_UserProgress.js';

const create = async (data) => {
    const userProgress = new WA_UserProgress(data);
    return await userProgress.save();
};

const getAll = async () => {
    return await WA_UserProgress.findAll();
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

const getCountByEngagementType = async (engagementType) => {
    return await WA_UserProgress.count({
        where: {
            engagement_type: engagementType
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

const updateQuestionNumberRetryCounterActivityType = async (profileId, phoneNumber, questionNumber, retryCounter, activityType) => {
    return await WA_UserProgress.update({
        questionNumber: questionNumber,
        retryCounter: retryCounter,
        activityType: activityType,
        lastUpdated: new Date()
    }, {
        where: {
            phoneNumber: phoneNumber,
            profile_id: profileId
        }
    });
}

const updateOpenaiThreadId = async (profileId, phoneNumber, openaiThreadId) => {
    return await WA_UserProgress.update({
        openaiThreadId: openaiThreadId,
        lastUpdated: new Date()
    }, {
        where: {
            phoneNumber: phoneNumber,
            profile_id: profileId
        }
    });
};

const getOpenaiThreadId = async (profileId, phoneNumber) => {
    return await WA_UserProgress.findOne({
        where: {
            phoneNumber: phoneNumber,
            profile_id: profileId
        },
        attributes: ['openaiThreadId']
    });
};

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

export default {
    create,
    getAll,
    getByPhoneNumber,
    getByProfileId,
    update,
    deleteByPhoneNumber,
    updateAcceptableMessagesList,
    updateQuestionNumber,
    updateRetryCounter,
    updateQuestionNumberRetryCounterActivityType,
    updateEngagementType,
    getCountByEngagementType,
    getOpenaiThreadId,
    updateOpenaiThreadId,
    updatePersona
};
