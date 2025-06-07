import express from 'express';
import chatBotController from '../controllers/chatBotController.js';
import errorHandler from '../middlewares/errorHandler.js';

const router = express.Router();

// GET /chatbot/status
router.get('/status', (req, res) => {
    res.status(200).send("Chatbot Route Status : Working");
});

// POST /chatbot/webhook
router.post('/webhook', chatBotController.webhookController);

// GET /chatbot/webhook
router.get('/webhook', chatBotController.verifyWebhookController);

// POST /chatbot/upload-user-data
router.post('/upload-user-data', chatBotController.uploadUserDataController);


// Use error handler middleware
router.use(errorHandler);

export default router;
