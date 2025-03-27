import service from '../services/multipleChoiceQuestionService.js';

const createMultipleChoiceQuestionController = async (req, res, next) => {
    try {
        const { questionType, questionText, questionNumber, lessonId, optionsType } = req.body;
        const file = req.files['file'] ? req.files['file'][0] : null;
        const image = req.files['image'] ? req.files['image'][0] : null;
        const video = req.files['video'] ? req.files['video'][0] : null;
        const multipleChoiceQuestion = await service.createMultipleChoiceQuestionService(file, image, video, questionType, questionText, questionNumber, lessonId, optionsType);
        res.status(200).send({ message: "Multiple Choice Question created successfully", mcq: multipleChoiceQuestion });
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionController.js';
        next(error);
    }
};

const getAllMultipleChoiceQuestionController = async (req, res, next) => {
    try {
        const result = await service.getAllMultipleChoiceQuestionService();
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionController.js';
        next(error);
    }
};

const getMultipleChoiceQuestionByIdController = async (req, res, next) => {
    try {
        const id = req.params.id;
        const result = await service.getMultipleChoiceQuestionByIdService(id);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionController.js';
        next(error);
    }
};

const updateMultipleChoiceQuestionController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { questionType, questionText, questionNumber, lessonId, optionsType } = req.body;
        const file = req.files['file'] ? req.files['file'][0] : null;
        const image = req.files['image'] ? req.files['image'][0] : null;
        const video = req.files['video'] ? req.files['video'][0] : null;
        await service.updateMultipleChoiceQuestionService(id, file, image, video, questionType, questionText, questionNumber, lessonId, optionsType);
        res.status(200).send({ message: "Multiple Choice Question updated successfully" });
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionController.js';
        next(error);
    }
};

const deleteMultipleChoiceQuestionController = async (req, res, next) => {
    try {
        const id = req.params.id;
        await service.deleteMultipleChoiceQuestionService(id);
        res.status(200).send({ message: "Multiple Choice Question deleted successfully" });
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionController.js';
        next(error);
    }
};

export default {
    createMultipleChoiceQuestionController,
    getAllMultipleChoiceQuestionController,
    getMultipleChoiceQuestionByIdController,
    updateMultipleChoiceQuestionController,
    deleteMultipleChoiceQuestionController
};
