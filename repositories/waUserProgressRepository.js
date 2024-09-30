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

export default {
    create,
    getAll,
    getByPhoneNumber,
    update,
    deleteByPhoneNumber,
    updateAcceptableMessagesList,
    updateQuestionNumber
};
