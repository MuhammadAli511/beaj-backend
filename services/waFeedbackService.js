import waFeedbackRepository from "../repositories/waFeedbackRepository.js";

const getAllWaFeedbackService = async () => {
    return await waFeedbackRepository.getAll();
};

export default {
    getAllWaFeedbackService
};