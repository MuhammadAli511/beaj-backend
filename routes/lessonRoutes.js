import express from 'express';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import lessonController from '../controllers/lessonController.js';
import upload from '../config/multerConfig.js';
import errorHandler from '../middlewares/errorHandler.js';

const router = express.Router();

// GET  api/lesson/status
router.get('/status', (req, res) => {
    res.status(200).send("Lesson Route Status : Working");
});

// POST api/lesson/create
router.post('/create', beajEmployeesAuth, upload.single('file'), lessonController.createLessonController);

// GET  api/lesson/getAll
router.get('/getAll', beajEmployeesAuth, lessonController.getAllLessonController);

// GET  api/lesson/getById/:id
router.get('/getById/:id', beajEmployeesAuth, lessonController.getLessonByIdController);

// PUT  api/lesson/update/:id
router.put('/update/:id', beajEmployeesAuth, upload.single('file'), lessonController.updateLessonController);

// DELETE  api/lesson/delete/:id
router.delete('/delete/:id', beajEmployeesAuth, lessonController.deleteLessonController);

// POST  api/lesson/getLessonsByActivity
router.post('/getLessonsByActivity', beajEmployeesAuth, lessonController.getLessonsByActivityController);

// GET api/lesson/getByCourseId/:courseId
router.get('/getByCourseId/:courseId', beajEmployeesAuth, lessonController.getLessonByCourseIdController);

// POST api/lesson/migrateLesson
router.post('/migrateLesson', beajEmployeesAuth, lessonController.migrateLessonController);

// POST api/lesson/testLesson
router.post('/testLesson', beajEmployeesAuth, lessonController.testLessonController);

// Use error handler middleware
router.use(errorHandler);

export default router;
