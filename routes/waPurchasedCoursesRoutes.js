import express from 'express';
import beajFacilitatorsAuth from '../middlewares/beajFacilitatorsAuth.js';
import waPurchasedCoursesController from '../controllers/waPurchasedCoursesController.js';
import errorHandler from '../middlewares/errorHandler.js';

const router = express.Router();

// GET  api/waPurchasedCourses/status
router.get('/status', (req, res) => {
    res.status(200).send("Wa Purchased Courses Route Status : Working");
});

// GET api/waPurchasedCourses/getAllCoursesByProfileId/:profileId
router.get('/getAllCoursesByProfileId/:profileId', beajFacilitatorsAuth, waPurchasedCoursesController.getAllCoursesByProfileIdController);

// GET  api/waPurchasedCourses/getPurchasedCoursesByProfileId/:profileId
router.get('/getPurchasedCoursesByProfileId/:profileId', beajFacilitatorsAuth, waPurchasedCoursesController.getPurchasedCoursesByProfileIdController);

// GET api/waPurchasedCourses/getUnpurchasedCoursesByProfileId/:profileId
router.get('/getUnpurchasedCoursesByProfileId/:profileId', beajFacilitatorsAuth, waPurchasedCoursesController.getUnpurchasedCoursesByProfileIdController);

// POST api/waPurchasedCourses/purchaseCourse
router.post('/purchaseCourse', beajFacilitatorsAuth, waPurchasedCoursesController.purchaseCourseController);

// GET api/waPurchasedCourses/getCompletedCourses/:profileId
router.get('/getCompletedCourses/:profileId', beajFacilitatorsAuth, waPurchasedCoursesController.getCompletedCourseController);

// Use error handler middleware
router.use(errorHandler);

export default router;