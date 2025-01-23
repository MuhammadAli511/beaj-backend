import express from 'express';
import beajFacilitatorsAuth from '../middlewares/beajFacilitatorsAuth.js';
import waFeedbackController from '../controllers/waFeedbackController.js';
import errorHandler from '../middlewares/errorHandler.js';

const router = express.Router();

// GET  api/waFeedback/status
router.get('/status', (req, res) => {
    res.status(200).send("Wa Feedback Route Status : Working");
});

// GET  api/waFeedback/getAll
router.get('/getAll', beajFacilitatorsAuth, waFeedbackController.getAllWaFeedbackController);


// Use error handler middleware
router.use(errorHandler);

export default router;