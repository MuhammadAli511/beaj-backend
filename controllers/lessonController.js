import service from '../services/lessonService.js'


const createLessonController = async (req, res) => {
    try {
        const lessonType = req.body.lessonType;
        const dayNumber = req.body.dayNumber;
        const activity = req.body.activity;
        const activityAlias = req.body.activityAlias;
        const weekNumber = req.body.weekNumber;
        const text = req.body.text;
        const courseId = req.body.courseId;
        const sequenceNumber = req.body.sequenceNumber;
        await service.createLessonService(lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber);
        res.status(200).send({ message: "Lesson created successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getAllLessonController = async (req, res) => {
    try {
        const result = await service.getAllLessonService();
        res.status(200).send(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getLessonByIdController = async (req, res) => {
    try {
        const id = req.params.id;
        const result = await service.getLessonByIdService(id);
        res.status(200).send(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const updateLessonController = async (req, res) => {
    try {
        const id = req.params.id;
        const lessonType = req.body.lessonType;
        const dayNumber = req.body.dayNumber;
        const activity = req.body.activity;
        const activityAlias = req.body.activityAlias;
        const weekNumber = req.body.weekNumber;
        const text = req.body.text;
        const courseId = req.body.courseId;
        const sequenceNumber = req.body.sequenceNumber;
        await service.updateLessonService(id, lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber);
        res.status(200).send({ message: "Lesson updated successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteLessonController = async (req, res) => {
    try {
        const id = req.params.id;
        await service.deleteLessonService(id);
        res.status(200).send({ message: "Lesson deleted successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export default {
    createLessonController,
    getAllLessonController,
    getLessonByIdController,
    updateLessonController,
    deleteLessonController
};