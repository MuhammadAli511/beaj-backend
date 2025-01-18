import express from 'express';
import beajEmployeesRoutes from './beajEmployeesRoutes.js';
import statsRoutes from './statsRoutes.js';
import courseCategoryRoutes from './courseCategoryRoutes.js';
import courseRoutes from './courseRoutes.js';
import aliasRoutes from './aliasRoutes.js';
import lessonRoutes from './lessonRoutes.js';
import courseWeekRoutes from './courseWeekRoutes.js';
import documentFilesRoutes from './documentFilesRoutes.js';
import speakActivityQuestionRoutes from './speakActivityQuestionRoutes.js';
import multipleChoiceQuestionRoutes from './multipleChoiceQuestionRoutes.js';
import multipleChoiceQuestionAnswerRoutes from './multipleChoiceQuestionAnswerRoutes.js';
import chatbotRoutes from './chatbotRoutes.js';
import waUserActivityLogsRoutes from './waUserActivityLogsRoutes.js';
import waUserMetadataRoutes from './waUserMetadataRoutes.js';
import waConstantsRoutes from './waConstantsRoutes.js';
import audioChatRoutes from './audioChatRoutes.js';
import waPurchasedCoursesRoutes from './waPurchasedCoursesRoutes.js';
import etlRoutes from './etlRoutes.js';

const router = express.Router();

// GET  api/status/
router.get('/status', (req, res) => {
    res.status(200).send("App Status : Working");
});

router.use('/beajEmployees', beajEmployeesRoutes);
router.use('/stats', statsRoutes);
router.use('/courseCategory', courseCategoryRoutes);
router.use('/course', courseRoutes);
router.use('/alias', aliasRoutes);
router.use('/lesson', lessonRoutes);
router.use('/courseWeek', courseWeekRoutes);
router.use('/documentFiles', documentFilesRoutes);
router.use('/speakActivityQuestion', speakActivityQuestionRoutes);
router.use('/multipleChoiceQuestion', multipleChoiceQuestionRoutes);
router.use('/multipleChoiceQuestionAnswer', multipleChoiceQuestionAnswerRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/waUserActivityLogs', waUserActivityLogsRoutes);
router.use('/waUserMetadata', waUserMetadataRoutes);
router.use('/waConstants', waConstantsRoutes);
router.use('/audioChat', audioChatRoutes);
router.use('/waPurchasedCourses', waPurchasedCoursesRoutes);
router.use('/etl_pipline', etlRoutes);

export default router;
