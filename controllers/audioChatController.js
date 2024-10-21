import service from '../services/audioChatService.js';

const feedbackController = async (req, res, next) => {
    try {
        const prompt = req.body.prompt;
        const userAudioFile = req.file;
        const status = await service.createAudioChatService(prompt, userAudioFile);
        res.status(200).json(status);
    } catch (error) {
        error.fileName = 'chatBotController.js';
        next(error);
    }
};

const getAllFeedback = async (req, res, next) => {
    try {
        const feedback = await service.getAllAudioChatService();
        res.status(200).json(feedback);
    } catch (error) {
        error.fileName = 'chatBotController.js';
        next(error);
    }
};

export default {
    feedbackController,
    getAllFeedback,
};