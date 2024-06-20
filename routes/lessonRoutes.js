import express from 'express';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import lessonController from '../controllers/lessonController.js';


const router = express.Router();

// GET  api/lesson/status
router.get('/status', (req, res) => {
    res.status(200).send("Lesson Route Status : Working");
});

// POST api/lesson/create
router.post('/create', beajEmployeesAuth, lessonController.createLessonController);

// GET  api/lesson/getAll
router.get('/getAll', beajEmployeesAuth, lessonController.getAllLessonController);

// GET  api/lesson/getById/:id
router.get('/getById/:id', beajEmployeesAuth, lessonController.getLessonByIdController);

// PUT  api/lesson/update/:id
router.put('/update/:id', beajEmployeesAuth, lessonController.updateLessonController);

// DELETE  api/lesson/delete/:id
router.delete('/delete/:id', beajEmployeesAuth, lessonController.deleteLessonController);


export default router;