import userProgressRepository from '../repositories/userProgressRepository.js';

const getAllUserProgressService = async (targetGroup,cohort,module,courseId1,courseId2,courseId3) => {
    return await userProgressRepository.getAllUserProgressRepository(targetGroup,cohort,module,courseId1,courseId2,courseId3);
};

const getUserProgressLeaderboardService = async (targetGroup,cohort,module,courseId1,courseId2,courseId3) => {
    return await userProgressRepository.getUserProgressLeaderboardRepository(targetGroup,cohort,module,courseId1,courseId2,courseId3);
};

export default {
    getAllUserProgressService,
    getUserProgressLeaderboardService,
};