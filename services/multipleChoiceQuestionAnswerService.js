// services/multipleChoiceQuestionAnswerService.js
import azure_blob from '../utils/azureBlobStorage.js';
import multipleChoiceQuestionAnswerRepository from '../repositories/multipleChoiceQuestionAnswerRepository.js';

const createMultipleChoiceQuestionAnswerService = async (answerText, answerImageUrl, answerAudioUrl, isCorrect, multipleChoiceQuestionId, sequenceNumber) => {
    try {
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
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionAnswerService.js';
        throw error;
    }
};

const getAllMultipleChoiceQuestionAnswerService = async () => {
    try {
        const multipleChoiceQuestionAnswers = await multipleChoiceQuestionAnswerRepository.getAll();
        return multipleChoiceQuestionAnswers;
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionAnswerService.js';
        throw error;
    }
};

const getMultipleChoiceQuestionAnswerByIdService = async (id) => {
    try {
        const multipleChoiceQuestionAnswer = await multipleChoiceQuestionAnswerRepository.getById(id);
        return multipleChoiceQuestionAnswer;
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionAnswerService.js';
        throw error;
    }
};

const updateMultipleChoiceQuestionAnswerService = async (id, answerText, answerImageUrl, answerAudioUrl, isCorrect, multipleChoiceQuestionId, sequenceNumber) => {
    try {
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
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionAnswerService.js';
        throw error;
    }
};

const deleteMultipleChoiceQuestionAnswerService = async (id) => {
    try {
        await multipleChoiceQuestionAnswerRepository.deleteMultipleChoiceQuestionAnswer(id);
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionAnswerService.js';
        throw error;
    }
};

export default {
    createMultipleChoiceQuestionAnswerService,
    getAllMultipleChoiceQuestionAnswerService,
    getMultipleChoiceQuestionAnswerByIdService,
    updateMultipleChoiceQuestionAnswerService,
    deleteMultipleChoiceQuestionAnswerService
};
