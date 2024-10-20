import WA_LessonsCompleted from '../models/WA_LessonsCompleted.js';

const create = async (phoneNumber, lessonId, courseId, completionStatus, startTime) => {
    const lessonCompleted = new WA_LessonsCompleted({
        phoneNumber: phoneNumber,
        lessonId: lessonId,
        courseId: courseId,
        completionStatus: completionStatus,
        startTime: startTime
    });
    return await lessonCompleted.save();
};

const getAll = async () => {
    return await WA_LessonsCompleted.findAll();
};

const getById = async (id) => {
    return await WA_LessonsCompleted.findByPk(id);
};

const update = async (id, data) => {
    return await WA_LessonsCompleted.update(data, {
        where: {
            id: id
        }
    });
};

const deleteById = async (id) => {
    return await WA_LessonsCompleted.destroy({
        where: {
            id: id
        }
    });
};

const endLessonByPhoneNumberAndLessonId = async (phoneNumber, lessonId) => {
    return await WA_LessonsCompleted.update({
        completionStatus: "Completed",
        endTime: new Date()
    }, {
        where: {
            phoneNumber: phoneNumber,
            lessonId: lessonId
        }
    });
};

const deleteByPhoneNumber = async (phoneNumber) => {
    return await WA_LessonsCompleted.destroy({
        where: {
            phoneNumber: phoneNumber
        }
    });
};

export default {
    create,
    getAll,
    getById,
    update,
    deleteById,
    endLessonByPhoneNumberAndLessonId,
    deleteByPhoneNumber
};
