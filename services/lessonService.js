import azure_blob from "../utils/azureBlobStorage.js";
import lessonRepository from "../repositories/lessonRepository.js";
import documentFileRepository from "../repositories/documentFileRepository.js";

const createLessonService = async (lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber, videoFile, audioFile, imageFile) => {
    const lesson = await lessonRepository.create(lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber);
    if (videoFile) {
        const videoUrl = await azure_blob.uploadToBlobStorage(videoFile);
        await documentFileRepository.create(lesson.id, "English", null, videoUrl, null, "video");
    }
    if (audioFile) {
        const audioUrl = await azure_blob.uploadToBlobStorage(audioFile);
        await documentFileRepository.create(lesson.id, "English", null, null, audioUrl, "audio");
    }
    if (imageFile) {
        const imageUrl = await azure_blob.uploadToBlobStorage(imageFile);
        await documentFileRepository.create(lesson.id, "English", imageUrl, null, null, "image");
    }
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