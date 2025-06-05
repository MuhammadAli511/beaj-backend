import service from '../services/speakActivityQuestionService.js';

const createSpeakActivityQuestionController = async (req, res, next) => {
    try {
        const { question, answer, lessonId, questionNumber, activityType, difficultyLevel, customFeedbackText } = req.body;
        const mediaFile = req.files.video ? req.files.video[0] : null;
        const mediaFileSecond = req.files.image ? req.files.image[0] : null;
        const customFeedbackImage = req.files.customFeedbackImage ? req.files.customFeedbackImage[0] : null;
        const customFeedbackAudio = req.files.customFeedbackAudio ? req.files.customFeedbackAudio[0] : null;
        await service.createSpeakActivityQuestionService(question, mediaFile, mediaFileSecond, answer, lessonId, questionNumber, activityType, difficultyLevel, customFeedbackText, customFeedbackImage, customFeedbackAudio);
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
        const { question, answer, lessonId, questionNumber, activityType, difficultyLevel, customFeedbackText } = req.body;
        let mediaFile = req.files.video ? req.files.video[0] : null;
        let mediaFileSecond = req.files.image ? req.files.image[0] : null;
        let customFeedbackImage = req.files.customFeedbackImage ? req.files.customFeedbackImage[0] : null;
        let customFeedbackAudio = req.files.customFeedbackAudio ? req.files.customFeedbackAudio[0] : null;
        if (mediaFile == null || mediaFile == undefined || mediaFile == "") {
            mediaFile = req.body.video;
        }
        if (mediaFileSecond == null || mediaFileSecond == undefined || mediaFileSecond == "") {
            mediaFileSecond = req.body.image;
        }
        if (customFeedbackImage == null || customFeedbackImage == undefined || customFeedbackImage == "") {
            customFeedbackImage = req.body.customFeedbackImage;
        }
        if (customFeedbackAudio == null || customFeedbackAudio == undefined || customFeedbackAudio == "") {
            customFeedbackAudio = req.body.customFeedbackAudio;
        }
        await service.updateSpeakActivityQuestionService(id, question, mediaFile, mediaFileSecond, answer, lessonId, questionNumber, activityType, difficultyLevel, customFeedbackText, customFeedbackImage, customFeedbackAudio);
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
    deleteSpeakActivityQuestionController,
};
