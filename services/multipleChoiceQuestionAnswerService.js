import azure_blob from '../utils/azureBlobStorage.js';
import multipleChoiceQuestionAnswerRepository from '../repositories/multipleChoiceQuestionAnswerRepository.js';

const createMultipleChoiceQuestionAnswerService = async (answerText, answerImageUrl, answerAudioUrl, isCorrect, multipleChoiceQuestionId, sequenceNumber) => {
    let imageUrl = null;
    let audioUrl = null;
    if (answerImageUrl) {
        imageUrl = await azure_blob.uploadToBlobStorage(answerImageUrl);
    }
    if (answerAudioUrl) {
        audioUrl = await azure_blob.uploadToBlobStorage(answerAudioUrl);
    }
    const multipleChoiceQuestionAnswer = await multipleChoiceQuestionAnswerRepository.create(answerText, imageUrl, audioUrl, isCorrect, multipleChoiceQuestionId, sequenceNumber);
    return multipleChoiceQuestionAnswer;
};

const getAllMultipleChoiceQuestionAnswerService = async () => {
    const multipleChoiceQuestionAnswers = await multipleChoiceQuestionAnswerRepository.getAll();
    return multipleChoiceQuestionAnswers;
};

const getMultipleChoiceQuestionAnswerByIdService = async (id) => {
    const multipleChoiceQuestionAnswer = await multipleChoiceQuestionAnswerRepository.getById(id);
    return multipleChoiceQuestionAnswer;
};

const updateMultipleChoiceQuestionAnswerService = async (id, answerText, answerImageUrl, answerAudioUrl, isCorrect, multipleChoiceQuestionId, sequenceNumber) => {
    let imageUrl = null;
    let audioUrl = null;
    if (answerImageUrl) {
        imageUrl = await azure_blob.uploadToBlobStorage(answerImageUrl);
    }
    if (answerAudioUrl) {
        audioUrl = await azure_blob.uploadToBlobStorage(answerAudioUrl);
    }
    const multipleChoiceQuestionAnswer = await multipleChoiceQuestionAnswerRepository.update(id, answerText, imageUrl, audioUrl, isCorrect, multipleChoiceQuestionId, sequenceNumber);
    return multipleChoiceQuestionAnswer;
};

const deleteMultipleChoiceQuestionAnswerService = async (id) => {
    await multipleChoiceQuestionAnswerRepository.deleteMultipleChoiceQuestionAnswer(id);
};


export default {
    createMultipleChoiceQuestionAnswerService,
    getAllMultipleChoiceQuestionAnswerService,
    getMultipleChoiceQuestionAnswerByIdService,
    updateMultipleChoiceQuestionAnswerService,
    deleteMultipleChoiceQuestionAnswerService
};