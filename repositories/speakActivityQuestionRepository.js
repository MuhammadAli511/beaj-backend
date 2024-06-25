import SpeakActivityQuestion from "../models/SpeakActivityQuestion.js";

const totalSpeakActivityQuestionsRepository = async () => {
    return await SpeakActivityQuestion.count();
};

const create = async (question, audioUrl, answer, lessonId, questionNumber) => {
    const speakActivityQuestion = new SpeakActivityQuestion({
        question: question,
        mediaFile: audioUrl,
        answer: answer,
        lessonId: lessonId,
        questionNumber: questionNumber
    });
    return await speakActivityQuestion.save();
};

const getAll = async () => {
    return await SpeakActivityQuestion.findAll();
};

const getById = async (id) => {
    return await SpeakActivityQuestion.findByPk(id);
};

const update = async (id, question, audioUrl, answer, lessonId, questionNumber) => {
    return await SpeakActivityQuestion.update({
        question: question,
        mediaFile: audioUrl,
        answer: answer,
        lessonId: lessonId,
        questionNumber: questionNumber
    }, {
        where: {
            id: id
        }
    });
};

const deleteSpeakActivityQuestion = async (id) => {
    return await SpeakActivityQuestion.destroy({
        where: {
            id: id
        }
    });
};

export default {
    totalSpeakActivityQuestionsRepository,
    create,
    getAll,
    getById,
    update,
    deleteSpeakActivityQuestion
};