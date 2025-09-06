// services/multipleChoiceQuestionAnswerService.js
import azure_blob from '../utils/azureBlobStorage.js';
import multipleChoiceQuestionAnswerRepository from '../repositories/multipleChoiceQuestionAnswerRepository.js';

const createMultipleChoiceQuestionAnswerService = async (answerText, answerImageUrl, answerAudioUrl, isCorrect, multipleChoiceQuestionId, sequenceNumber, customAnswerFeedbackText, customAnswerFeedbackImage, customAnswerFeedbackAudio) => {
    try {
        let imageUrl = null;
        let audioUrl = null;
        let customAnswerFeedbackAudioUrl = null;
        let customAnswerFeedbackImageUrl = null;
        if (answerImageUrl) {
            imageUrl = await azure_blob.uploadToBlobStorage(answerImageUrl);
        }
        if (answerAudioUrl) {
            audioUrl = await azure_blob.uploadToBlobStorage(answerAudioUrl);
        }
        if (customAnswerFeedbackImage) {
            customAnswerFeedbackImageUrl = await azure_blob.uploadToBlobStorage(customAnswerFeedbackImage);
        }
        if (customAnswerFeedbackAudio) {
            customAnswerFeedbackAudioUrl = await azure_blob.uploadToBlobStorage(customAnswerFeedbackAudio);
        }
        const multipleChoiceQuestionAnswer = await multipleChoiceQuestionAnswerRepository.create(answerText, imageUrl, audioUrl, isCorrect, multipleChoiceQuestionId, sequenceNumber, customAnswerFeedbackText, customAnswerFeedbackImageUrl, customAnswerFeedbackAudioUrl);
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

const getMultipleChoiceQuestionAnswerByQuestionIdService = async (questionId) => {
    try {
        const multipleChoiceQuestionAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(questionId);
        return multipleChoiceQuestionAnswers;
    } catch (error) {
        error.fileName = 'multipleChoiceQuestionAnswerService.js';
        throw error;
    }
};

const updateMultipleChoiceQuestionAnswerService = async (id, answerText, answerImageUrl, answerAudioUrl, isCorrect, multipleChoiceQuestionId, sequenceNumber, customAnswerFeedbackText, customAnswerFeedbackImage, customAnswerFeedbackAudio) => {
    try {
        let imageUrl = null;
        let audioUrl = null;
        let customAnswerFeedbackAudioUrl = null;
        let customAnswerFeedbackImageUrl = null;
        if (answerImageUrl) {
            imageUrl = await azure_blob.uploadToBlobStorage(answerImageUrl);
        }
        if (answerAudioUrl) {
            audioUrl = await azure_blob.uploadToBlobStorage(answerAudioUrl);
        }
        if (customAnswerFeedbackImage) {
            customAnswerFeedbackImageUrl = await azure_blob.uploadToBlobStorage(customAnswerFeedbackImage);
        }
        if (customAnswerFeedbackAudio) {
            customAnswerFeedbackAudioUrl = await azure_blob.uploadToBlobStorage(customAnswerFeedbackAudio);
        }
        const multipleChoiceQuestionAnswer = await multipleChoiceQuestionAnswerRepository.update(id, answerText, imageUrl, audioUrl, isCorrect, multipleChoiceQuestionId, sequenceNumber, customAnswerFeedbackText, customAnswerFeedbackImageUrl, customAnswerFeedbackAudioUrl);
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
    deleteMultipleChoiceQuestionAnswerService,
    getMultipleChoiceQuestionAnswerByQuestionIdService,
};
