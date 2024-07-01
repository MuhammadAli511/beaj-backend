import service from '../services/chatBotService.js';

const webhookController = async (req, res, next) => {
    try {
        const { body } = req;
        await service.webhookService(body, res);
    } catch (error) {
        error.fileName = 'chatBotController.js';
        next(error);
    }
};

const feedbackController = async (req, res, next) => {
    try {
        const prompt = req.body.prompt;
        const userAudioFile = req.file;
        await service.feedbackService(prompt, userAudioFile);
    } catch (error) {
        error.fileName = 'chatBotController.js';
        next(error);
    }
};

export default {
    webhookController,
    feedbackController
};