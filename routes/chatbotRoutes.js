import express from 'express';
import chatBotController from '../controllers/chatBotController.js';
import errorHandler from '../middlewares/errorHandler.js';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import upload from '../config/multerConfig.js';

const router = express.Router();

// GET /chatbot/status
router.get('/status', (req, res) => {
    res.status(200).send("Chatbot Route Status : Working");
});

// POST /chatbot/webhook
router.post('/webhook', chatBotController.webhookController);

// GET /chatbot/webhook
router.get('/webhook', chatBotController.verifyWebhookController);

// TESTING
// GET /chatbot/test
router.get('/test', chatBotController.testController);


// Use error handler middleware
router.use(errorHandler);

export default router;
