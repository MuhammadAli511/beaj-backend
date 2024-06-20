import express from 'express';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import courseWeekController from '../controllers/courseWeekController.js';
import upload from '../config/multerConfig.js';

const router = express.Router();

// GET  api/courseWeek/status
router.get('/status', (req, res) => {
    res.status(200).send("Course Week Route Status : Working");
});

// POST  api/courseWeek/create
router.post('/create', beajEmployeesAuth, upload.single('file'), courseWeekController.createCourseWeekController);

// GET  api/courseWeek/getAll
router.get('/getAll', beajEmployeesAuth, courseWeekController.getAllCourseWeekController);

// GET  api/courseWeek/getById/:id
router.get('/getById/:id', beajEmployeesAuth, courseWeekController.getCourseWeekByIdController);

// PUT  api/courseWeek/update/:id
router.put('/update/:id', beajEmployeesAuth, upload.single('file'), courseWeekController.updateCourseWeekController);

// DELETE  api/courseWeek/delete/:id
router.delete('/delete/:id', beajEmployeesAuth, courseWeekController.deleteCourseWeekController);

export default router;