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

const uploadUserDataController = async (req, res, next) => {
    try {
        const { users } = req.body;
        const count = await service.uploadUserDataService(users);
        res.status(200).send({ message: `Successfully uploaded ${count} users.` });
    } catch (error) {
        error.fileName = 'chatBotController.js';
        next(error);
    }
};

export default {
    webhookController,
    verifyWebhookController,
    uploadUserDataController
};