import azure_blob from "../utils/azureBlobStorage.js";
import multipleChoiceQuestionRepository from "../repositories/multipleChoiceQuestionRepository.js";

const createMultipleChoiceQuestionService = async (file, image, questionType, questionText, questionNumber, lessonId, optionsType) => {
    try {
        let fileUrl = null;
        let imageUrl = null;
        if (file) {
            fileUrl = await azure_blob.uploadToBlobStorage(file);
        }
        if (image) {
            imageUrl = await azure_blob.uploadToBlobStorage(image);
        }
        const multipleChoiceQuestion = await multipleChoiceQuestionRepository.create(fileUrl, imageUrl, questionType, questionText, questionNumber, lessonId, optionsType);
        return multipleChoiceQuestion;
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionService.js';
        throw error;
    }
};

const getAllMultipleChoiceQuestionService = async () => {
    try {
        const multipleChoiceQuestions = await multipleChoiceQuestionRepository.getAll();
        return multipleChoiceQuestions;
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionService.js';
        throw error;
    }
};

const getMultipleChoiceQuestionByIdService = async (id) => {
    try {
        const multipleChoiceQuestion = await multipleChoiceQuestionRepository.getById(id);
        return multipleChoiceQuestion;
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionService.js';
        throw error;
    }
};

const updateMultipleChoiceQuestionService = async (id, file, image, questionType, questionText, questionNumber, lessonId, optionsType) => {
    try {
        let fileUrl = null;
        let imageUrl = null;
        if (file) {
            fileUrl = await azure_blob.uploadToBlobStorage(file);
        }
        if (image) {
            imageUrl = await azure_blob.uploadToBlobStorage(image);
        }
        const multipleChoiceQuestion = await multipleChoiceQuestionRepository.update(id, fileUrl, imageUrl, questionType, questionText, questionNumber, lessonId, optionsType);
        return multipleChoiceQuestion;
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionService.js';
        throw error;
    }
};

const deleteMultipleChoiceQuestionService = async (id) => {
    try {
        await multipleChoiceQuestionRepository.deleteMultipleChoiceQuestion(id);
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionService.js';
        throw error;
    }
};

export default {
    createMultipleChoiceQuestionService,
    getAllMultipleChoiceQuestionService,
    getMultipleChoiceQuestionByIdService,
    updateMultipleChoiceQuestionService,
    deleteMultipleChoiceQuestionService
};