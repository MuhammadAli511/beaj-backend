import azure_blob from '../utils/azureBlobStorage.js';
import AIServices from '../utils/AIServices.js';
import parseAnswers from '../utils/parseAnswers.js';
import speakActivityQuestionRepository from '../repositories/speakActivityQuestionRepository.js';

const createSpeakActivityQuestionService = async (question, mediaFile, mediaFileSecond, answer, lessonId, questionNumber, activityType) => {
    try {
        let mediaUrl = null;
        let mediaUrlSecond = null;
        if (mediaFile && typeof mediaFile === 'object') {
            mediaUrl = await azure_blob.uploadToBlobStorage(mediaFile);
        } else {
            if (activityType == 'conversationalAgencyBot') {
                if (question.includes("<question>")) {
                    const questionText = question.match(/<question>(.*?)<\/question>/s)[1].trim();
                    if (questionText != "") {
                        mediaUrl = await AIServices.openaiTextToSpeechAndUpload(questionText);
                    }
                }
            } else {
                mediaUrl = await AIServices.openaiTextToSpeechAndUpload(question);
            }
        }

        if (mediaFileSecond && typeof mediaFileSecond === 'object') {
            mediaUrlSecond = await azure_blob.uploadToBlobStorage(mediaFileSecond);
        }

        // Use a regex to correctly handle double-quoted answers with commas inside
        let answerArray = [];
        if (answer) {
            answerArray = parseAnswers(answer);
        }

        const speakActivityQuestion = await speakActivityQuestionRepository.create(
            question,
            mediaUrl,
            mediaUrlSecond,
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

const updateSpeakActivityQuestionService = async (id, question, mediaFile, mediaFileSecond, answer, lessonId, questionNumber, activityType) => {
    try {
        let mediaUrl = null;
        let mediaUrlSecond = null;
        if (mediaFile && typeof mediaFile === 'object') {
            mediaUrl = await azure_blob.uploadToBlobStorage(mediaFile);
        } else if (typeof mediaFile === 'string' && mediaFile.trim() != "" && activityType != 'conversationalAgencyBot' && activityType != 'conversationalQuestionsBot') {
            mediaUrl = mediaFile;
        } else {
            if (activityType != 'conversationalAgencyBot') {
                mediaUrl = await AIServices.openaiTextToSpeechAndUpload(question);
            } else {
                if (question.includes("<question>")) {
                    const questionText = question.match(/<question>(.*?)<\/question>/s)[1].trim();
                    if (questionText != "") {
                        mediaUrl = await AIServices.openaiTextToSpeechAndUpload(questionText);
                    }
                }
            }
        }

        if (mediaFileSecond && typeof mediaFileSecond === 'object') {
            mediaUrlSecond = await azure_blob.uploadToBlobStorage(mediaFileSecond);
        } else if (typeof mediaFileSecond === 'string' && mediaFileSecond.trim() != "" && activityType != 'conversationalAgencyBot' && activityType != 'conversationalQuestionsBot') {
            mediaUrlSecond = mediaFileSecond;
        }

        const answerArray = parseAnswers(answer);

        const speakActivityQuestion = await speakActivityQuestionRepository.update(
            id,
            question,
            mediaUrl,
            mediaUrlSecond,
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
