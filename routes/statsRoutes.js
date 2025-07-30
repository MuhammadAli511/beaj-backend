import express from 'express';
import beajFacilitatorsAuth from '../middlewares/beajFacilitatorsAuth.js';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import statsController from '../controllers/statsController.js';
import errorHandler from '../middlewares/errorHandler.js';

const router = express.Router();

// GET  api/stats/status
router.get('/status', (req, res) => {
    res.status(200).send("Stats Route Status : Working");
});

// GET  api/stats/totalContentStats
router.get('/totalContentStats', beajFacilitatorsAuth, statsController.totalContentStatsController);

// POST api/stats/lastActiveUsers
router.post('/lastActiveUsers', beajFacilitatorsAuth, statsController.lastActiveUsersController);

// POST api/stats/studentUserJourneyStats
router.post('/studentUserJourneyStats', beajFacilitatorsAuth, statsController.studentUserJourneyStatsController);

// POST api/stats/studentTrialUserJourneyStats
router.post('/studentTrialUserJourneyStats', beajFacilitatorsAuth, statsController.studentTrialUserJourneyStatsController);

// GET api/stats/studentCourseStats
router.get('/studentCourseStats', beajFacilitatorsAuth, statsController.studentCourseStatsController);

// POST api/stats/clearingCache
router.post('/clearingCache', beajEmployeesAuth, statsController.clearingCacheController);

router.post('/studentAnalyticsStats', beajFacilitatorsAuth, statsController.studentAnalyticsController);

router.post('/studentBarAnalyticsStats', beajFacilitatorsAuth, statsController.studentBarAnalyticsController);

router.post('/userAnalyticsStats', beajFacilitatorsAuth, statsController.userAnalyticsStatsController);

// Use error handler middleware
router.use(errorHandler);

export default router;
