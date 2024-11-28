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

const testController = async (req, res, next) => {
    try {
        await service.testService(req, res);
        res.status(200).send("Chatbot Route Status : Working");
    } catch (error) {
        error.fileName = 'chatBotController.js';
        next(error);
    }
};

export default {
    webhookController,
    verifyWebhookController,
    testController
};