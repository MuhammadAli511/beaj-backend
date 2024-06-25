import express from 'express';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import multipleChoiceQuestionController from '../controllers/multipleChoiceQuestionController.js';
import multipleUpload from '../config/multipleMulterConfig.js';


const router = express.Router();

// GET  api/multipleChoiceQuestion/status
router.get('/status', (req, res) => {
    res.status(200).send("Multiple Choice Question Route Status : Working");
});

// POST  api/multipleChoiceQuestion/create
router.post('/create', beajEmployeesAuth, multipleUpload, multipleChoiceQuestionController.createMultipleChoiceQuestionController);

// GET  api/multipleChoiceQuestion/getAll
router.get('/getAll', beajEmployeesAuth, multipleChoiceQuestionController.getAllMultipleChoiceQuestionController);

// GET  api/multipleChoiceQuestion/getById/:id
router.get('/getById/:id', beajEmployeesAuth, multipleChoiceQuestionController.getMultipleChoiceQuestionByIdController);

// PUT  api/multipleChoiceQuestion/update/:id
router.put('/update/:id', beajEmployeesAuth, multipleUpload, multipleChoiceQuestionController.updateMultipleChoiceQuestionController);

// DELETE  api/multipleChoiceQuestion/delete/:id
router.delete('/delete/:id', beajEmployeesAuth, multipleChoiceQuestionController.deleteMultipleChoiceQuestionController);


export default router;