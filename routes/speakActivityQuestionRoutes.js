import express from 'express';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import speakActivityQuestionController from '../controllers/speakActivityQuestionController.js';
import upload from '../config/multerConfig.js';

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


export default router;