import azure_blob from "../utils/azureBlobStorage.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";

const createSpeakActivityQuestionService = async (question, mediaFile, answer, lessonId, questionNumber) => {
    const audioUrl = await azure_blob.uploadToBlobStorage(mediaFile);
    const answerArray = answer.split(",");
    console.log(answerArray);
    const speakActivityQuestion = await speakActivityQuestionRepository.create(question, audioUrl, answerArray, lessonId, questionNumber);
    return speakActivityQuestion;
};

const getAllSpeakActivityQuestionService = async () => {
    const speakActivityQuestions = await speakActivityQuestionRepository.getAll();
    return speakActivityQuestions;
};

const getSpeakActivityQuestionByIdService = async (id) => {
    const speakActivityQuestion = await speakActivityQuestionRepository.getById(id);
    return speakActivityQuestion;
};

const updateSpeakActivityQuestionService = async (id, question, mediaFile, answer, lessonId, questionNumber) => {
    const audioUrl = await azure_blob.uploadToBlobStorage(mediaFile);
    const speakActivityQuestion = await speakActivityQuestionRepository.update(id, question, audioUrl, answer, lessonId, questionNumber);
    return speakActivityQuestion;
};

const deleteSpeakActivityQuestionService = async (id) => {
    await speakActivityQuestionRepository.deleteSpeakActivityQuestion(id);
};

export default {
    createSpeakActivityQuestionService,
    getAllSpeakActivityQuestionService,
    getSpeakActivityQuestionByIdService,
    updateSpeakActivityQuestionService,
    deleteSpeakActivityQuestionService
};