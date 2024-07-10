// services/speakActivityQuestionService.js
import azure_blob from '../utils/azureBlobStorage.js';
import speakActivityQuestionRepository from '../repositories/speakActivityQuestionRepository.js';

const createSpeakActivityQuestionService = async (question, mediaFile, answer, lessonId, questionNumber) => {
    try {
        const audioUrl = await azure_blob.uploadToBlobStorage(mediaFile);
        const answerArray = answer.split(",");
        const speakActivityQuestion = await speakActivityQuestionRepository.create(question, audioUrl, answerArray, lessonId, questionNumber);
        return speakActivityQuestion;
    } catch (error) {
        error.fileName = 'speakActivityQuestionService.js';
        throw error;
    }
};

const getAllSpeakActivityQuestionService = async () => {
    try {
        const speakActivityQuestions = await speakActivityQuestionRepository.getAll();
        return speakActivityQuestions;
    } catch (error) {
        error.fileName = 'speakActivityQuestionService.js';
        throw error;
    }
};

const getSpeakActivityQuestionByIdService = async (id) => {
    try {
        const speakActivityQuestion = await speakActivityQuestionRepository.getById(id);
        return speakActivityQuestion;
    } catch (error) {
        error.fileName = 'speakActivityQuestionService.js';
        throw error;
    }
};

const updateSpeakActivityQuestionService = async (id, question, mediaFile, answer, lessonId, questionNumber) => {
    try {
        const audioUrl = await azure_blob.uploadToBlobStorage(mediaFile);
        const speakActivityQuestion = await speakActivityQuestionRepository.update(id, question, audioUrl, answer, lessonId, questionNumber);
        return speakActivityQuestion;
    } catch (error) {
        error.fileName = 'speakActivityQuestionService.js';
        throw error;
    }
};

const deleteSpeakActivityQuestionService = async (id) => {
    try {
        await speakActivityQuestionRepository.deleteSpeakActivityQuestion(id);
    } catch (error) {
        error.fileName = 'speakActivityQuestionService.js';
        throw error;
    }
};

export default {
    createSpeakActivityQuestionService,
    getAllSpeakActivityQuestionService,
    getSpeakActivityQuestionByIdService,
    updateSpeakActivityQuestionService,
    deleteSpeakActivityQuestionService
};
