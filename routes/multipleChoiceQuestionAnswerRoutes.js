import express from 'express';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import multipleChoiceQuestionAnswerController from '../controllers/multipleChoiceQuestionAnswerController.js';
import multipleUpload from '../config/multipleMulterConfig.js';


const router = express.Router();

// GET  api/multipleChoiceQuestionAnswer/status
router.get('/status', (req, res) => {
    res.status(200).send("Multiple Choice Question Answer Route Status : Working");
});

// POST  api/multipleChoiceQuestionAnswer/create
router.post('/create', beajEmployeesAuth, multipleUpload, multipleChoiceQuestionAnswerController.createMultipleChoiceQuestionAnswerController);

// GET  api/multipleChoiceQuestionAnswer/getAll
router.get('/getAll', beajEmployeesAuth, multipleChoiceQuestionAnswerController.getAllMultipleChoiceQuestionAnswerController);

// GET  api/multipleChoiceQuestionAnswer/getById/:id
router.get('/getById/:id', beajEmployeesAuth, multipleChoiceQuestionAnswerController.getMultipleChoiceQuestionAnswerByIdController);

// PUT  api/multipleChoiceQuestionAnswer/update/:id
router.put('/update/:id', beajEmployeesAuth, multipleUpload, multipleChoiceQuestionAnswerController.updateMultipleChoiceQuestionAnswerController);

// DELETE  api/multipleChoiceQuestionAnswer/delete/:id
router.delete('/delete/:id', beajEmployeesAuth, multipleChoiceQuestionAnswerController.deleteMultipleChoiceQuestionAnswerController);


export default router;