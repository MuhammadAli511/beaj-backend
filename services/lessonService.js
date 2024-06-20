import lessonRepository from "../repositories/lessonRepository.js";

const createLessonService = async (lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber) => {
    const lesson = await lessonRepository.create(lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber);
    return lesson;
};

const getAllLessonService = async () => {
    const lessons = await lessonRepository.getAll();
    return lessons;
};

const getLessonByIdService = async (id) => {
    const lesson = await lessonRepository.getById(id);
    return lesson;
};

const updateLessonService = async (id, lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber) => {
    const lesson = await lessonRepository.update(id, lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber);
    return lesson;
};

const deleteLessonService = async (id) => {
    await lessonRepository.deleteLesson(id);
};

export default {
    createLessonService,
    getAllLessonService,
    getLessonByIdService,
    updateLessonService,
    deleteLessonService
};