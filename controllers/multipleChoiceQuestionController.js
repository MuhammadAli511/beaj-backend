import service from '../services/multipleChoiceQuestionService.js'


const createMultipleChoiceQuestionController = async (req, res) => {
    try {
        const file = req.files['file'] ? req.files['file'][0] : null;
        const image = req.files['image'] ? req.files['image'][0] : null;
        const questionType = req.body.questionType;
        const questionText = req.body.questionText;
        const questionNumber = req.body.questionNumber;
        const lessonId = req.body.lessonId;
        const optionsType = req.body.optionsType;
        await service.createMultipleChoiceQuestionService(file, image, questionType, questionText, questionNumber, lessonId, optionsType);
        res.status(200).send({ message: "Multiple Choice Question created successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getAllMultipleChoiceQuestionController = async (req, res) => {
    try {
        const result = await service.getAllMultipleChoiceQuestionService();
        res.status(200).send(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getMultipleChoiceQuestionByIdController = async (req, res) => {
    try {
        const id = req.params.id;
        const result = await service.getMultipleChoiceQuestionByIdService(id);
        res.status(200).send(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const updateMultipleChoiceQuestionController = async (req, res) => {
    try {
        const id = req.params.id;
        const file = req.files['file'] ? req.files['file'][0] : null;
        const image = req.files['image'] ? req.files['image'][0] : null;
        const questionType = req.body.questionType;
        const questionText = req.body.questionText;
        const questionNumber = req.body.questionNumber;
        const lessonId = req.body.lessonId;
        const optionsType = req.body.optionsType;
        await service.updateMultipleChoiceQuestionService(id, file, image, questionType, questionText, questionNumber, lessonId, optionsType);
        res.status(200).send({ message: "Multiple Choice Question updated successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteMultipleChoiceQuestionController = async (req, res) => {
    try {
        const id = req.params.id;
        await service.deleteMultipleChoiceQuestionService(id);
        res.status(200).send({ message: "Multiple Choice Question deleted successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export default {
    createMultipleChoiceQuestionController,
    getAllMultipleChoiceQuestionController,
    getMultipleChoiceQuestionByIdController,
    updateMultipleChoiceQuestionController,
    deleteMultipleChoiceQuestionController
};