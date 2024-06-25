import azure_blob from "../utils/azureBlobStorage.js";
import multipleChoiceQuestionRepository from "../repositories/multipleChoiceQuestionRepository.js";

const createMultipleChoiceQuestionService = async (file, image, questionType, questionText, questionNumber, lessonId, optionsType) => {
    const fileUrl = null;
    const imageUrl = null;
    if (file) {
        fileUrl = await azure_blob.uploadToBlobStorage(file);
    }
    if (image) {
        imageUrl = await azure_blob.uploadToBlobStorage(image);
    }
    const multipleChoiceQuestion = await multipleChoiceQuestionRepository.create(fileUrl, imageUrl, questionType, questionText, questionNumber, lessonId, optionsType);
    return multipleChoiceQuestion;
};

const getAllMultipleChoiceQuestionService = async () => {
    const multipleChoiceQuestions = await multipleChoiceQuestionRepository.getAll();
    return multipleChoiceQuestions;
};

const getMultipleChoiceQuestionByIdService = async (id) => {
    const multipleChoiceQuestion = await multipleChoiceQuestionRepository.getById(id);
    return multipleChoiceQuestion;
};

const updateMultipleChoiceQuestionService = async (id, file, image, questionType, questionText, questionNumber, lessonId, optionsType) => {
    const fileUrl = null;
    const imageUrl = null;
    if (file) {
        fileUrl = await azure_blob.uploadToBlobStorage(file);
    }
    if (image) {
        imageUrl = await azure_blob.uploadToBlobStorage(image);
    }
    const multipleChoiceQuestion = await multipleChoiceQuestionRepository.update(id, fileUrl, imageUrl, questionType, questionText, questionNumber, lessonId, optionsType);
    return multipleChoiceQuestion;
};

const deleteMultipleChoiceQuestionService = async (id) => {
    await multipleChoiceQuestionRepository.deleteMultipleChoiceQuestion(id);
};

export default {
    createMultipleChoiceQuestionService,
    getAllMultipleChoiceQuestionService,
    getMultipleChoiceQuestionByIdService,
    updateMultipleChoiceQuestionService,
    deleteMultipleChoiceQuestionService
};