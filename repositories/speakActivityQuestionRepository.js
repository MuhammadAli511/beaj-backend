import SpeakActivityQuestion from "../models/SpeakActivityQuestion.js";
import Sequelize from 'sequelize';

const create = async (question, mediaUrl, mediaUrlSecond, answer, lessonId, questionNumber, difficultyLevel, customFeedbackText, customFeedbackImageUrl, customFeedbackAudioUrl) => {
    const speakActivityQuestion = new SpeakActivityQuestion({
        question: question,
        mediaFile: mediaUrl,
        mediaFileSecond: mediaUrlSecond,
        answer: answer,
        lessonId: lessonId,
        questionNumber: questionNumber,
        difficultyLevel: difficultyLevel,
        customFeedbackText: customFeedbackText,
        customFeedbackImage: customFeedbackImageUrl,
        customFeedbackAudio: customFeedbackAudioUrl
    });
    return await speakActivityQuestion.save();
};

const getAll = async () => {
    return await SpeakActivityQuestion.findAll();
};

const getById = async (id) => {
    return await SpeakActivityQuestion.findByPk(id);
};

const update = async (id, question, mediaUrl, mediaUrlSecond, answer, lessonId, questionNumber, difficultyLevel, customFeedbackText, customFeedbackImageUrl, customFeedbackAudioUrl) => {
    return await SpeakActivityQuestion.update({
        question: question,
        mediaFile: mediaUrl,
        mediaFileSecond: mediaUrlSecond,
        answer: answer,
        lessonId: lessonId,
        questionNumber: questionNumber,
        difficultyLevel: difficultyLevel,
        customFeedbackText: customFeedbackText,
        customFeedbackImage: customFeedbackImageUrl,
        customFeedbackAudio: customFeedbackAudioUrl
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

const getCurrentSpeakActivityQuestion = async (lessonId, questionNumber) => {
    return await SpeakActivityQuestion.findOne({
        where: {
            lessonId: lessonId,
            questionNumber: questionNumber
        }
    });
};

const getNextSpeakActivityQuestion = async (lessonId, questionNumber) => {
    if (!questionNumber) {
        return await SpeakActivityQuestion.findOne({
            where: {
                lessonId: lessonId,
            },
            order: [
                ['questionNumber', 'ASC']
            ]
        });
    }
    if (lessonId && questionNumber) {
        let nextSpeakActivityQuestion = await SpeakActivityQuestion.findOne({
            where: {
                lessonId: lessonId,
                questionNumber: {
                    [Sequelize.Op.gt]: questionNumber
                }
            },
            order: [
                ['questionNumber', 'ASC']
            ]
        });
        if (!nextSpeakActivityQuestion) {
            return null;
        }
        return nextSpeakActivityQuestion;
    }
}

const getByLessonIds = async (lessonIds) => {
    return await SpeakActivityQuestion.findAll({
        where: {
            lessonId: {
                [Sequelize.Op.in]: lessonIds
            }
        }
    });
};

const getByLessonId = async (lessonId) => {
    return await SpeakActivityQuestion.findAll({
        where: {
            lessonId: lessonId
        }
    })
};

const deleteByLessonId = async (lessonId) => {
    return await SpeakActivityQuestion.destroy({
        where: {
            lessonId: lessonId
        }
    });
};

const getTotalQuestionsByLessonId = async (lessonId) => {
    return await SpeakActivityQuestion.count({
        where: {
            lessonId: lessonId
        }
    });
};


export default {
    create,
    getAll,
    getById,
    update,
    deleteSpeakActivityQuestion,
    getCurrentSpeakActivityQuestion,
    getNextSpeakActivityQuestion,
    getByLessonIds,
    getByLessonId,
    deleteByLessonId,
    getTotalQuestionsByLessonId
};