import WA_UserProgress from '../models/WA_UserProgress.js';

const create = async (data) => {
    const userProgress = new WA_UserProgress(data);
    return await userProgress.save();
};

const getAll = async () => {
    return await WA_UserProgress.findAll();
};

const getByPhoneNumber = async (phoneNumber) => {
    return await WA_UserProgress.findByPk(phoneNumber);
};

const getCountByEngagementType = async (engagementType) => {
    return await WA_UserProgress.count({
        where: {
            engagement_type: engagementType
        }
    });
};

const update = async (phoneNumber, currentCourseId, currentWeek, currentDay, currentLessonId, currentLesson_sequence, activityType, questionNumber, retryCounter, acceptableMessages) => {
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
            phoneNumber: phoneNumber
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

const updateAcceptableMessagesList = async (phoneNumber, acceptableMessages) => {
    return await WA_UserProgress.update({
        acceptableMessages: acceptableMessages,
        lastUpdated: new Date()
    }, {
        where: {
            phoneNumber: phoneNumber
        }
    });
};

const updateEngagementType = async (phoneNumber, engagementType) => {
    return await WA_UserProgress.update({
        engagement_type: engagementType,
        lastUpdated: new Date()
    }, {
        where: {
            phoneNumber: phoneNumber
        }
    });
};

const updateQuestionNumber = async (phoneNumber, questionNumber) => {
    return await WA_UserProgress.update({
        questionNumber: questionNumber,
        lastUpdated: new Date()
    }, {
        where: {
            phoneNumber: phoneNumber
        }
    });
};

const updateRetryCounter = async (phoneNumber, retryCounter) => {
    return await WA_UserProgress.update({
        retryCounter: retryCounter,
        lastUpdated: new Date()
    }, {
        where: {
            phoneNumber: phoneNumber
        }
    });
};

const updateQuestionNumberRetryCounterActivityType = async (phoneNumber, questionNumber, retryCounter, activityType) => {
    return await WA_UserProgress.update({
        questionNumber: questionNumber,
        retryCounter: retryCounter,
        activityType: activityType,
        lastUpdated: new Date()
    }, {
        where: {
            phoneNumber: phoneNumber
        }
    });
}

const updateOpenaiThreadId = async (phoneNumber, openaiThreadId) => {
    return await WA_UserProgress.update({
        openaiThreadId: openaiThreadId,
        lastUpdated: new Date()
    }, {
        where: {
            phoneNumber: phoneNumber
        }
    });
};

const getOpenaiThreadId = async (phoneNumber) => {
    return await WA_UserProgress.findOne({
        where: {
            phoneNumber: phoneNumber
        },
        attributes: ['openaiThreadId']
    });
};

export default {
    create,
    getAll,
    getByPhoneNumber,
    update,
    deleteByPhoneNumber,
    updateAcceptableMessagesList,
    updateQuestionNumber,
    updateRetryCounter,
    updateQuestionNumberRetryCounterActivityType,
    updateEngagementType,
    getCountByEngagementType,
    getOpenaiThreadId,
    updateOpenaiThreadId
};
