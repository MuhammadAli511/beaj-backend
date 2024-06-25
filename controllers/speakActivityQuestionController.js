import service from '../services/speakActivityQuestionService.js'

const createSpeakActivityQuestionController = async (req, res) => {
    try {
        const question = req.body.question;
        const mediaFile = req.file;
        const answer = req.body.answer;
        const lessonId = req.body.lessonId;
        const questionNumber = req.body.questionNumber;
        await service.createSpeakActivityQuestionService(question, mediaFile, answer, lessonId, questionNumber);
        res.status(200).send({ message: "Question created successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getAllSpeakActivityQuestionController = async (req, res) => {
    try {
        const result = await service.getAllSpeakActivityQuestionService();
        res.status(200).send(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getSpeakActivityQuestionByIdController = async (req, res) => {
    try {
        const id = req.params.id;
        const result = await service.getSpeakActivityQuestionByIdService(id);
        res.status(200).send(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const updateSpeakActivityQuestionController = async (req, res) => {
    try {
        const id = req.params.id;
        const question = req.body.question;
        const mediaFile = req.file;
        const answer = req.body.answer;
        const lessonId = req.body.lessonId;
        const questionNumber = req.body.questionNumber;
        await service.updateSpeakActivityQuestionService(id, question, mediaFile, answer, lessonId, questionNumber);
        res.status(200).send({ message: "Question updated successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteSpeakActivityQuestionController = async (req, res) => {
    try {
        const id = req.params.id;
        await service.deleteSpeakActivityQuestionService(id);
        res.status(200).send({ message: "Question deleted successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export default {
    createSpeakActivityQuestionController,
    getAllSpeakActivityQuestionController,
    getSpeakActivityQuestionByIdController,
    updateSpeakActivityQuestionController,
    deleteSpeakActivityQuestionController
};