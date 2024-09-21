import service from '../services/speakActivityQuestionService.js';

const createSpeakActivityQuestionController = async (req, res, next) => {
    try {
        const { question, answer, lessonId, questionNumber } = req.body;
        const mediaFile = req.file || null;
        await service.createSpeakActivityQuestionService(question, mediaFile, answer, lessonId, questionNumber);
        res.status(200).send({ message: "Question created successfully" });
    } catch (error) {
        error.fileName = 'speakActivityQuestionController.js';
        next(error);
    }
};

const getAllSpeakActivityQuestionController = async (req, res, next) => {
    try {
        const result = await service.getAllSpeakActivityQuestionService();
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'speakActivityQuestionController.js';
        next(error);
    }
};

const getSpeakActivityQuestionByIdController = async (req, res, next) => {
    try {
        const id = req.params.id;
        const result = await service.getSpeakActivityQuestionByIdService(id);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'speakActivityQuestionController.js';
        next(error);
    }
};

const updateSpeakActivityQuestionController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { question, answer, lessonId, questionNumber } = req.body;
        const mediaFile = req.file;
        await service.updateSpeakActivityQuestionService(id, question, mediaFile, answer, lessonId, questionNumber);
        res.status(200).send({ message: "Question updated successfully" });
    } catch (error) {
        error.fileName = 'speakActivityQuestionController.js';
        next(error);
    }
};

const deleteSpeakActivityQuestionController = async (req, res, next) => {
    try {
        const id = req.params.id;
        await service.deleteSpeakActivityQuestionService(id);
        res.status(200).send({ message: "Question deleted successfully" });
    } catch (error) {
        error.fileName = 'speakActivityQuestionController.js';
        next(error);
    }
};

export default {
    createSpeakActivityQuestionController,
    getAllSpeakActivityQuestionController,
    getSpeakActivityQuestionByIdController,
    updateSpeakActivityQuestionController,
    deleteSpeakActivityQuestionController
};
