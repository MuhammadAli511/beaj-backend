import service from '../services/multipleChoiceQuestionAnswerService.js';

const createMultipleChoiceQuestionAnswerController = async (req, res, next) => {
    try {
        const { answerText, isCorrect, multipleChoiceQuestionId, sequenceNumber } = req.body;
        const file = req.files['file'] ? req.files['file'][0] : null;
        const image = req.files['image'] ? req.files['image'][0] : null;
        await service.createMultipleChoiceQuestionAnswerService(answerText, image, file, isCorrect, multipleChoiceQuestionId, sequenceNumber);
        res.status(200).send({ message: "Multiple Choice Question Answer created successfully" });
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionAnswerController.js';
        next(error);
    }
};

const getAllMultipleChoiceQuestionAnswerController = async (req, res, next) => {
    try {
        const result = await service.getAllMultipleChoiceQuestionAnswerService();
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionAnswerController.js';
        next(error);
    }
};

const getMultipleChoiceQuestionAnswerByIdController = async (req, res, next) => {
    try {
        const id = req.params.id;
        const result = await service.getMultipleChoiceQuestionAnswerByIdService(id);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionAnswerController.js';
        next(error);
    }
};

const updateMultipleChoiceQuestionAnswerController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { answerText, isCorrect, multipleChoiceQuestionId, sequenceNumber } = req.body;
        const file = req.files['file'] ? req.files['file'][0] : null;
        const image = req.files['image'] ? req.files['image'][0] : null;
        await service.updateMultipleChoiceQuestionAnswerService(id, answerText, image, file, isCorrect, multipleChoiceQuestionId, sequenceNumber);
        res.status(200).send({ message: "Multiple Choice Question Answer updated successfully" });
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionAnswerController.js';
        next(error);
    }
};

const deleteMultipleChoiceQuestionAnswerController = async (req, res, next) => {
    try {
        const id = req.params.id;
        await service.deleteMultipleChoiceQuestionAnswerService(id);
        res.status(200).send({ message: "Multiple Choice Question Answer deleted successfully" });
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionAnswerController.js';
        next(error);
    }
};

export default {
    createMultipleChoiceQuestionAnswerController,
    getAllMultipleChoiceQuestionAnswerController,
    getMultipleChoiceQuestionAnswerByIdController,
    updateMultipleChoiceQuestionAnswerController,
    deleteMultipleChoiceQuestionAnswerController
};
