import service from '../services/multipleChoiceQuestionAnswerService.js';


const createMultipleChoiceQuestionAnswerController = async (req, res) => {
    try {
        const answerText = req.body.answerText;
        const file = req.files['file'] ? req.files['file'][0] : null;
        const image = req.files['image'] ? req.files['image'][0] : null;
        const isCorrect = req.body.isCorrect;
        const multipleChoiceQuestionId = req.body.multipleChoiceQuestionId;
        const sequenceNumber = req.body.sequenceNumber;
        await service.createMultipleChoiceQuestionAnswerService(answerText, image, file, isCorrect, multipleChoiceQuestionId, sequenceNumber);
        res.status(200).send({ message: "Multiple Choice Question Answer created successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getAllMultipleChoiceQuestionAnswerController = async (req, res) => {
    try {
        const result = await service.getAllMultipleChoiceQuestionAnswerService();
        res.status(200).send(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getMultipleChoiceQuestionAnswerByIdController = async (req, res) => {
    try {
        const id = req.params.id;
        const result = await service.getMultipleChoiceQuestionAnswerByIdService(id);
        res.status(200).send(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const updateMultipleChoiceQuestionAnswerController = async (req, res) => {
    try {
        const id = req.params.id;
        const answerText = req.body.answerText;
        const file = req.files['file'] ? req.files['file'][0] : null;
        const image = req.files['image'] ? req.files['image'][0] : null;
        const isCorrect = req.body.isCorrect;
        const multipleChoiceQuestionId = req.body.multipleChoiceQuestionId;
        const sequenceNumber = req.body.sequenceNumber;
        await service.updateMultipleChoiceQuestionAnswerService(id, answerText, image, file, isCorrect, multipleChoiceQuestionId, sequenceNumber);
        res.status(200).send({ message: "Multiple Choice Question Answer updated successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteMultipleChoiceQuestionAnswerController = async (req, res) => {
    try {
        const id = req.params.id;
        await service.deleteMultipleChoiceQuestionAnswerService(id);
        res.status(200).send({ message: "Multiple Choice Question Answer deleted successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export default {
    createMultipleChoiceQuestionAnswerController,
    getAllMultipleChoiceQuestionAnswerController,
    getMultipleChoiceQuestionAnswerByIdController,
    updateMultipleChoiceQuestionAnswerController,
    deleteMultipleChoiceQuestionAnswerController
};