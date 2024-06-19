import express from 'express';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import courseCategoryController from '../controllers/courseCategoryController.js';
import upload from '../config/multerConfig.js';


const router = express.Router();

// GET  api/courseCategory/status
router.get('/status', (req, res) => {
    res.status(200).send("Course Category Route Status : Working");
});

// POST  api/courseCategory/create
router.post('/create', beajEmployeesAuth, upload.single('file'), courseCategoryController.createCourseCategoryController);

// GET  api/courseCategory/getAll
router.get('/getAll', beajEmployeesAuth, courseCategoryController.getAllCourseCategoryController);

// GET  api/courseCategory/getById/:id
router.get('/getById/:id', beajEmployeesAuth, courseCategoryController.getCourseCategoryByIdController);

// PUT  api/courseCategory/update/:id
router.put('/update/:id', beajEmployeesAuth, upload.single('file'), courseCategoryController.updateCourseCategoryController);

// DELETE  api/courseCategory/delete/:id
router.delete('/delete/:id', beajEmployeesAuth, courseCategoryController.deleteCourseCategoryController);



export default router;