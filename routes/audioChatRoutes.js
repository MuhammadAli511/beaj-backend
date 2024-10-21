import express from 'express';
import audioChatController from '../controllers/audioChatController.js';
import errorHandler from '../middlewares/errorHandler.js';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import upload from '../config/multerConfig.js';

const router = express.Router();

// GET /audioChat/status
router.get('/status', (req, res) => {
    res.status(200).send("AudioChat Route Status : Working");
});


// POST /audioChat/feedback
router.post('/feedback', beajEmployeesAuth, upload.single('file'), audioChatController.feedbackController);

// GET /audioChat/getAllFeedback
router.get('/getAllFeedback', beajEmployeesAuth, audioChatController.getAllFeedback);

// Use error handler middleware
router.use(errorHandler);

export default router;