import service from '../services/waFeedbackService.js';

const getAllWaFeedbackController = async (req, res, next) => {
    try {
        const result = await service.getAllWaFeedbackService();
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'waFeedbackController.js';
        next(error);
    }
};

export default {
    getAllWaFeedbackController
};