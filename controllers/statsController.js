import service from '../services/statsService.js';

const totalContentStatsController = async (req, res, next) => {
    try {
        const totalContentStats = await service.totalContentStatsService();
        res.status(200).send(totalContentStats);
    } catch (error) {
        error.fileName = 'statsController.js';
        next(error);
    }
};

const dashboardCardsFunnelController = async (req, res, next) => {
    try {
        const dashboardCardsFunnel = await service.dashboardCardsFunnelService();
        res.status(200).send(dashboardCardsFunnel);
    } catch (error) {
        error.fileName = 'statsController.js';
        next(error);
    }
};

const lastActiveUsersController = async (req, res, next) => {
    try {
        const { days, cohorts } = req.body;
        const lastActiveUsers = await service.lastActiveUsersService(days, cohorts);
        res.status(200).send(lastActiveUsers);
    } catch (error) {
        error.fileName = 'statsController.js';
        next(error);
    }
};

const studentUserJourneyStatsController = async (req, res, next) => {
    try {
        const { date } = req.body;
        const userJourneyStats = await service.studentUserJourneyStatsService(date);
        res.status(200).send(userJourneyStats);
    } catch (error) {
        error.fileName = 'statsController.js';
        next(error);
    }
};

const studentTrialUserJourneyStatsController = async (req, res, next) => {
    try {
        const { date } = req.body;
        const userJourneyStats = await service.studentTrialUserJourneyStatsService(date);
        res.status(200).send(userJourneyStats);
    } catch (error) {
        error.fileName = 'statsController.js';
        next(error);
    }
};


const studentAnalyticsController = async (req, res, next) => {
    try {
        const { courseId, grade, cohort, graphType } = req.body;
        const userJourneyStats = await service.studentAnalyticsService(courseId, grade, cohort, graphType);
        res.status(200).send(userJourneyStats);
    } catch (error) {
        error.fileName = 'statsController.js';
        next(error);
    }
};
const studentCourseStatsController = async (req, res, next) => {
    try {
        const courseStats = await service.studentCourseStatsService();
        res.status(200).send(courseStats);
    } catch (error) {
        error.fileName = 'statsController.js';
        next(error);
    }
};

const clearingCacheController = async (req, res, next) => {
    try {
        const result = await service.clearingCacheService();
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'statsController.js';
        next(error);
    }
};

export default {
    totalContentStatsController,
    dashboardCardsFunnelController,
    lastActiveUsersController,
    studentUserJourneyStatsController,
    studentTrialUserJourneyStatsController,
    studentCourseStatsController,
    clearingCacheController,
    studentAnalyticsController
};
