import express from 'express';
import beajFacilitatorsAuth from '../middlewares/beajFacilitatorsAuth.js';
import waPurchasedCoursesController from '../controllers/waPurchasedCoursesController.js';
import errorHandler from '../middlewares/errorHandler.js';

const router = express.Router();

// GET  api/waPurchasedCourses/status
router.get('/status', (req, res) => {
    res.status(200).send("Wa Purchased Courses Route Status : Working");
});

// GET api/waPurchasedCourses/getAllCoursesByPhoneNumber/:phoneNumber
router.get('/getAllCoursesByPhoneNumber/:phoneNumber', beajFacilitatorsAuth, waPurchasedCoursesController.getAllCoursesByPhoneNumberController);

// GET  api/waPurchasedCourses/getPurchasedCoursesByPhoneNumber/:phoneNumber
router.get('/getPurchasedCoursesByPhoneNumber/:phoneNumber', beajFacilitatorsAuth, waPurchasedCoursesController.getPurchasedCoursesByPhoneNumberController);

// GET api/waPurchasedCourses/getUnpurchasedCoursesByPhoneNumber/:phoneNumber
router.get('/getUnpurchasedCoursesByPhoneNumber/:phoneNumber', beajFacilitatorsAuth, waPurchasedCoursesController.getUnpurchasedCoursesByPhoneNumberController);

// POST api/waPurchasedCourses/purchaseCourse
router.post('/purchaseCourse', beajFacilitatorsAuth, waPurchasedCoursesController.purchaseCourseController);

// GET api/waPurchasedCourses/getCompletedCourse/:phoneNumber
router.get('/getCompletedCourses/:phoneNumber', beajFacilitatorsAuth, waPurchasedCoursesController.getCompletedCourseController);

// Use error handler middleware
router.use(errorHandler);

export default router;