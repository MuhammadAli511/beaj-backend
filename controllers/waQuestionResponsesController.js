import service from '../services/waQuestionResponsesService.js';

const getAllWaQuestionResponsesController = async (req, res, next) => {
    try {
        const result = await service.getAllWaQuestionResponsesService();
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'waQuestionResponsesController.js';
        next(error);
    }
};

const getWaQuestionResponsesByActivityTypeController = async (req, res, next) => {
    try {
        const activityType = req.params.activityType;
        const courseId = req.query.courseId;
        const result = await service.getWaQuestionResponsesByActivityTypeService(activityType, courseId);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'waQuestionResponsesController.js';
        next(error);
    }
};

export default {
    getAllWaQuestionResponsesController,
    getWaQuestionResponsesByActivityTypeController
};