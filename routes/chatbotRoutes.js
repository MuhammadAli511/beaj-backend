import express from 'express';
import chatBotController from '../controllers/chatBotController.js';
import errorHandler from '../middlewares/errorHandler.js';
import beajFacilitatorsAuth from '../middlewares/beajFacilitatorsAuth.js';

const router = express.Router();

// GET /chatbot/status
router.get('/status', (req, res) => {
    res.status(200).send("Chatbot Route Status : Working");
});

// POST /chatbot/webhook
router.post('/webhook', chatBotController.webhookController);

// GET /chatbot/webhook
router.get('/webhook', chatBotController.verifyWebhookController);

// TODO: Move this to metadata
// GET /chatbot/combined-user-data
router.get('/combined-user-data', beajFacilitatorsAuth, chatBotController.getCombinedUserDataController);

// Use error handler middleware
router.use(errorHandler);

export default router;
