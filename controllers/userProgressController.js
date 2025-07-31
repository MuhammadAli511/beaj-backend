import service from '../services/userProgressService.js';

const getAllUserProgressController = async (req, res, next) => {
  try {
    const { botType, rollout, level, cohort, targetGroup, courseId1, courseId2, courseId3, courseId4, courseId5, module, assessmentView } = req.query;
    const result = await service.getAllUserProgressService(botType, rollout, level, cohort, targetGroup, courseId1, courseId2, courseId3, courseId4, courseId5, module, assessmentView);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    error.fileName = 'userProgressController.js';
    next(error);
  }
};

const getUserProgressLeaderboardController = async (req, res, next) => {
  try {
    const { courseId1, courseId2, courseId3, targetGroup, module, cohort } = req.query;
    const result = await service.getUserProgressLeaderboardService(targetGroup, cohort, module, courseId1, courseId2, courseId3);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    error.fileName = 'userProgressController.js';
    next(error);
  }
};

const getcohortListController = async (req, res, next) => {
  try {
    const { botType, rollout, level, targetGroup } = req.query;
    const result = await service.getcohortListService(botType, rollout, level, targetGroup);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    error.fileName = 'userProgressController.js';
    next(error);
  }
};

const getUserProgressBarStatsController = async (req, res, next) => {
  try {
    const { botType, level, cohort, rollout, courseId1, courseId4, condition } = req.query;
    const result = await service.getUserProgressBarStatsService(botType, level, cohort, rollout, courseId1, courseId4, condition);
    console.log(result);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    error.fileName = 'userProgressController.js';
    next(error);
  }
};

const getMetadataProgressController = async (req, res, next) => {
  try {
    const result = await service.getMetadataProgressService();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    error.fileName = 'userProgressController.js';
    next(error);
  }
};

export default {
  getAllUserProgressController,
  getUserProgressLeaderboardController,
  getcohortListController,
  getUserProgressBarStatsController,
  getMetadataProgressController,
};