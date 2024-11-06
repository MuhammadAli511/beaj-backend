import azure_blob from '../utils/azureBlobStorage.js';
import azureAIServices from '../utils/azureAIServices.js';
import parseAnswers from '../utils/parseAnswers.js';
import speakActivityQuestionRepository from '../repositories/speakActivityQuestionRepository.js';

const createSpeakActivityQuestionService = async (question, mediaFile, answer, lessonId, questionNumber) => {
    try {
        let mediaUrl = null;
        if (mediaFile) {
            mediaUrl = await azure_blob.uploadToBlobStorage(mediaFile);
        } else {
            mediaUrl = await azureAIServices.azureTextToSpeechAndUpload(question);
        }

        // Use a regex to correctly handle double-quoted answers with commas inside
        let answerArray = [];
        if (answer) {
            answerArray = parseAnswers(answer);
        }

        const speakActivityQuestion = await speakActivityQuestionRepository.create(
            question,
            mediaUrl,
            answerArray,
            lessonId,
            questionNumber
        );

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
        let audioUrl = mediaFile;
        if (mediaFile && typeof mediaFile === 'object') {
            audioUrl = await azure_blob.uploadToBlobStorage(mediaFile);
        }

        const answerArray = parseAnswers(answer);

        const speakActivityQuestion = await speakActivityQuestionRepository.update(
            id,
            question,
            audioUrl,
            answerArray,
            lessonId,
            questionNumber
        );

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
