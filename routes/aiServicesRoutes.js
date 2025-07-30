import express from 'express';
import aiServicesController from '../controllers/aiServicesController.js';
import errorHandler from '../middlewares/errorHandler.js';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import upload from '../config/multerConfig.js';

const router = express.Router();

// GET /aiServices/status
router.get('/status', (req, res) => {
    res.status(200).send("AI Services Route Status : Working");
});

// POST /aiServices/speech-to-text
router.post('/speech-to-text', beajEmployeesAuth, upload.single('file'), aiServicesController.speechToTextController);

// Use error handler middleware
router.use(errorHandler);

export default router;

