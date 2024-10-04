import azure_blob from '../utils/azureBlobStorage.js';
import azureAIServices from '../utils/azureAIServices.js';
import parseAnswers from '../utils/parseAnswers.js';
import speakActivityQuestionRepository from '../repositories/speakActivityQuestionRepository.js';

const createSpeakActivityQuestionService = async (question, mediaFile, answer, lessonId, questionNumber) => {
    try {
        let audioUrl = null;
        if (mediaFile) {
            audioUrl = await azure_blob.uploadToBlobStorage(mediaFile);
        } else {
            audioUrl = await azureAIServices.azureTextToSpeechAndUpload(question);
        }

        // Use a regex to correctly handle double-quoted answers with commas inside
        const answerArray = parseAnswers(answer);

        const speakActivityQuestion = await speakActivityQuestionRepository.create(
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
        // if mediafile is a link, don't upload to blob storage, check for http or https
        let audioUrl = null;
        if (mediaFile && !mediaFile.includes('http')) {
            audioUrl = await azure_blob.uploadToBlobStorage(mediaFile);
        } else {
            audioUrl = mediaFile;
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
