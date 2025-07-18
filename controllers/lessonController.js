import service from '../services/lessonService.js';

const createLessonController = async (req, res, next) => {
    try {
        const { lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber, status, textInstruction } = req.body;
        const audioInstruction = req.file ? req.file : null;
        const lesson = await service.createLessonService(lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber, status, textInstruction, audioInstruction);
        res.status(200).send({ message: "Lesson created successfully", lesson });
    } catch (error) {
        error.fileName = 'lessonController.js';
        next(error);
    }
};

const getAllLessonController = async (req, res, next) => {
    try {
        const result = await service.getAllLessonService();
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'lessonController.js';
        next(error);
    }
};

const getLessonByIdController = async (req, res, next) => {
    try {
        const id = req.params.id;
        const result = await service.getLessonByIdService(id);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'lessonController.js';
        next(error);
    }
};

const updateLessonController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber, status, textInstruction } = req.body;
        const audioInstruction = req.file ? req.file : null;
        await service.updateLessonService(id, lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber, status, textInstruction, audioInstruction);
        res.status(200).send({ message: "Lesson updated successfully" });
    } catch (error) {
        error.fileName = 'lessonController.js';
        next(error);
    }
};

const deleteLessonController = async (req, res, next) => {
    try {
        const id = req.params.id;
        await service.deleteLessonService(id);
        res.status(200).send({ message: "Lesson deleted successfully" });
    } catch (error) {
        error.fileName = 'lessonController.js';
        next(error);
    }
};

const getLessonsByActivityController = async (req, res, next) => {
    try {
        const { course, activity } = req.body;
        const result = await service.getLessonsByActivity(course, activity);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'lessonController.js';
        next(error);
    }
};

const migrateLessonController = async (req, res, next) => {
    try {
        const { lessonId, courseId } = req.body;
        const result = await service.migrateLessonService(lessonId, courseId);
        res.status(200).send({ message: "Lesson copied successfully", result });
    } catch (error) {
        error.fileName = 'lessonController.js';
        next(error);
    }
};

const getLessonByCourseIdController = async (req, res, next) => {
    try {
        const id = req.params.courseId;
        const result = await service.getLessonByCourseIdService(id);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'lessonController.js';
        next(error);
    }
};

const testLessonController = async (req, res, next) => {
    try {
        const { phoneNumber, lesson } = req.body;
        const result = await service.testLessonService(phoneNumber, lesson);
        res.status(200).send({ message: "Lesson copied successfully", result });
    } catch (error) {
        error.fileName = 'lessonController.js';
        next(error);
    }
};

export default {
    createLessonController,
    getAllLessonController,
    getLessonByIdController,
    updateLessonController,
    deleteLessonController,
    getLessonsByActivityController,
    migrateLessonController,
    getLessonByCourseIdController,
    testLessonController,
};
