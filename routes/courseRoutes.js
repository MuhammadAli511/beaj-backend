import express from 'express';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import courseController from '../controllers/courseController.js';

const router = express.Router();

// GET  api/course/status
router.get('/status', (req, res) => {
    res.status(200).send("Course Route Status : Working");
});

// POST  api/course/create
router.post('/create', beajEmployeesAuth, courseController.createCourseController);

// GET  api/course/getAll
router.get('/getAll', beajEmployeesAuth, courseController.getAllCourseController);

// GET  api/course/getById/:id
router.get('/getById/:id', beajEmployeesAuth, courseController.getCourseByIdController);

// PUT  api/course/update/:id
router.put('/update/:id', beajEmployeesAuth, courseController.updateCourseController);

// DELETE  api/course/delete/:id
router.delete('/delete/:id', beajEmployeesAuth, courseController.deleteCourseController);

export default router;