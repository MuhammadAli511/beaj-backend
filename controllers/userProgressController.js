import service from '../services/userProgressService.js';

const getAllUserProgressController = async (req, res, next) => {
  try {
    const { botType, rollout, level, cohort, targetGroup, courseId1, courseId2, courseId3, module } = req.query;
    const result = await service.getAllUserProgressService(botType, rollout, level, cohort, targetGroup, courseId1, courseId2, courseId3, module);
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


export default {
  getAllUserProgressController,
  getUserProgressLeaderboardController
};