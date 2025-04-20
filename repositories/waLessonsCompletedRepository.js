import WA_LessonsCompleted from '../models/WA_LessonsCompleted.js';
import Sequelize from 'sequelize';

const create = async (phoneNumber, lessonId, courseId, completionStatus, startTime) => {
    const existingLesson = await WA_LessonsCompleted.findOne({
        where: {
            phoneNumber: phoneNumber,
            lessonId: lessonId,
            courseId: courseId,
            completionStatus: completionStatus
        }
    });

    if (existingLesson) {
        return existingLesson;
    }

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
    const lesson = await WA_LessonsCompleted.findOne({
        where: {
            phoneNumber: phoneNumber,
            lessonId: lessonId,
            completionStatus: "Completed",
            endTime: {
                [Sequelize.Op.ne]: null
            }
        }
    });

    if (lesson) {
        return lesson;
    }

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

const getUniqueStartedCoursesByPhoneNumber = async (phoneNumber) => {
    const waLessonsCompleted = await WA_LessonsCompleted.findAll({
        where: {
            phoneNumber: phoneNumber
        }
    });
    return waLessonsCompleted.map(lesson => lesson.courseId).filter((value, index, self) => self.indexOf(value) === index);
};

export default {
    create,
    getAll,
    getById,
    update,
    deleteById,
    endLessonByPhoneNumberAndLessonId,
    deleteByPhoneNumber,
    getUniqueStartedCoursesByPhoneNumber
};
