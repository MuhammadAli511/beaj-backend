import WA_LessonsCompleted from '../models/WA_LessonsCompleted.js';
import Sequelize from 'sequelize';

const create = async (phoneNumber, lessonId, courseId, completionStatus, startTime, profileId) => {
    const existingLesson = await WA_LessonsCompleted.findOne({
        where: {
            phoneNumber: phoneNumber,
            lessonId: lessonId,
            courseId: courseId,
            completionStatus: completionStatus,
            profile_id: profileId
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
        startTime: startTime,
        profile_id: profileId
    });
    return await lessonCompleted.save();
};

const endLessonByPhoneNumberLessonIdAndProfileId = async (phoneNumber, lessonId, profileId) => {
    const lesson = await WA_LessonsCompleted.findOne({
        where: {
            phoneNumber: phoneNumber,
            lessonId: lessonId,
            completionStatus: "Completed",
            profile_id: profileId,
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
            profile_id: profileId,
            lessonId: lessonId
        }
    });
};

const deleteByProfileId = async (profileId) => {
    return await WA_LessonsCompleted.destroy({
        where: {
            profile_id: profileId
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

const getUniqueStartedCoursesByProfileId = async (profileId) => {
    const waLessonsCompleted = await WA_LessonsCompleted.findAll({
        where: {
            profile_id: profileId
        }
    });
    return waLessonsCompleted.map(lesson => lesson.courseId).filter((value, index, self) => self.indexOf(value) === index);
};

export default {
    create,
    endLessonByPhoneNumberLessonIdAndProfileId,
    deleteByProfileId,
    deleteByPhoneNumber,
    getUniqueStartedCoursesByProfileId
};
