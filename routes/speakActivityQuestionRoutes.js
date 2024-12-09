import express from 'express';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import speakActivityQuestionController from '../controllers/speakActivityQuestionController.js';
import upload from '../config/multerConfig.js';
import errorHandler from '../middlewares/errorHandler.js';

const router = express.Router();

// GET  api/speakActivityQuestion/status
router.get('/status', (req, res) => {
    res.status(200).send("Speak Activity Question Route Status : Working");
});

// POST  api/speakActivityQuestion/create
router.post('/create', beajEmployeesAuth, upload.single('file'), speakActivityQuestionController.createSpeakActivityQuestionController);

// GET  api/speakActivityQuestion/getAll
router.get('/getAll', beajEmployeesAuth, speakActivityQuestionController.getAllSpeakActivityQuestionController);

// GET  api/speakActivityQuestion/getById/:id
router.get('/getById/:id', beajEmployeesAuth, speakActivityQuestionController.getSpeakActivityQuestionByIdController);

// PUT  api/speakActivityQuestion/update/:id
router.put('/update/:id', beajEmployeesAuth, upload.single('file'), speakActivityQuestionController.updateSpeakActivityQuestionController);

// DELETE  api/speakActivityQuestion/delete/:id
router.delete('/delete/:id', beajEmployeesAuth, speakActivityQuestionController.deleteSpeakActivityQuestionController);

// GET api/speakActivityQuestion/getScoreAndAudios
router.get('/getScoreAndAudios', beajEmployeesAuth, speakActivityQuestionController.getScoreAndAudiosController);

// Use error handler middleware
router.use(errorHandler);

export default router;
