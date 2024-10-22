import express from 'express';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import waPurchasedCoursesController from '../controllers/waPurchasedCoursesController.js';
import errorHandler from '../middlewares/errorHandler.js';

const router = express.Router();

// GET  api/waPurchasedCourses/status
router.get('/status', (req, res) => {
    res.status(200).send("Wa Purchased Courses Route Status : Working");
});

// GET  api/waPurchasedCourses/getPurchasedCoursesByPhoneNumber/:phoneNumber
router.get('/getPurchasedCoursesByPhoneNumber/:phoneNumber', beajEmployeesAuth, waPurchasedCoursesController.getPurchasedCoursesByPhoneNumberController);

// GET api/waPurchasedCourses/getUnpurchasedCoursesByPhoneNumber/:phoneNumber
router.get('/getUnpurchasedCoursesByPhoneNumber/:phoneNumber', beajEmployeesAuth, waPurchasedCoursesController.getUnpurchasedCoursesByPhoneNumberController);

// POST api/waPurchasedCourses/purchaseCourse
router.post('/purchaseCourse', beajEmployeesAuth, waPurchasedCoursesController.purchaseCourseController);

// GET api/waPurchasedCourses/getCompletedCourse/:phoneNumber
router.get('/getCompletedCourse/:phoneNumber', beajEmployeesAuth, waPurchasedCoursesController.getCompletedCourseController);

// Use error handler middleware
router.use(errorHandler);

export default router;