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

const verifyWebhookController = async (req, res, next) => {
    try {
        await service.verifyWebhookService(req, res);
    } catch (error) {
        error.fileName = 'chatBotController.js';
        next(error);
    }
};

const feedbackController = async (req, res, next) => {
    try {
        const prompt = req.body.prompt;
        const userAudioFile = req.file;
        const status = await service.feedbackService(prompt, userAudioFile);
        res.status(200).json(status);
    } catch (error) {
        error.fileName = 'chatBotController.js';
        next(error);
    }
};

const getAllFeedback = async (req, res, next) => {
    try {
        const feedback = await service.getAllFeedbackService();
        res.status(200).json(feedback);
    } catch (error) {
        error.fileName = 'chatBotController.js';
        next(error);
    }
};

export default {
    webhookController,
    feedbackController,
    getAllFeedback,
    verifyWebhookController
};