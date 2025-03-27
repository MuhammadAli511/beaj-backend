import MultipleChoiceQuestionAnswer from "../models/MultipleChoiceQuestionAnswer.js";
import Sequelize from 'sequelize';

const create = async (answerText, answerImageUrl, answerAudioUrl, isCorrect, multipleChoiceQuestionId, sequenceNumber, customAnswerFeedbackText, customAnswerFeedbackImage, customAnswerFeedbackAudio) => {
    const multipleChoiceQuestionAnswer = new MultipleChoiceQuestionAnswer({
        AnswerText: answerText,
        AnswerImageUrl: answerImageUrl,
        AnswerAudioUrl: answerAudioUrl,
        IsCorrect: isCorrect,
        MultipleChoiceQuestionId: multipleChoiceQuestionId,
        SequenceNumber: sequenceNumber,
        CustomAnswerFeedbackText: customAnswerFeedbackText,
        CustomAnswerFeedbackImage: customAnswerFeedbackImage,
        CustomAnswerFeedbackAudio: customAnswerFeedbackAudio
    });
    await multipleChoiceQuestionAnswer.save();
    return multipleChoiceQuestionAnswer;
};

const getAll = async () => {
    const multipleChoiceQuestionAnswers = await MultipleChoiceQuestionAnswer.findAll();
    return multipleChoiceQuestionAnswers;
};

const getById = async (id) => {
    const multipleChoiceQuestionAnswer = await MultipleChoiceQuestionAnswer.findByPk(id);
    return multipleChoiceQuestionAnswer;
};

const update = async (id, answerText, answerImageUrl, answerAudioUrl, isCorrect, multipleChoiceQuestionId, sequenceNumber, customAnswerFeedbackText, customAnswerFeedbackImage, customAnswerFeedbackAudio) => {
    return await MultipleChoiceQuestionAnswer.update({
        AnswerText: answerText,
        AnswerImageUrl: answerImageUrl,
        AnswerAudioUrl: answerAudioUrl,
        IsCorrect: isCorrect,
        MultipleChoiceQuestionId: multipleChoiceQuestionId,
        SequenceNumber: sequenceNumber,
        CustomAnswerFeedbackText: customAnswerFeedbackText,
        CustomAnswerFeedbackImage: customAnswerFeedbackImage,
        CustomAnswerFeedbackAudio: customAnswerFeedbackAudio
    }, {
        where: {
            Id: id
        }
    });
};

const deleteMultipleChoiceQuestionAnswer = async (id) => {
    return await MultipleChoiceQuestionAnswer.destroy({
        where: {
            Id: id
        }
    });
};

const getByQuestionId = async (multipleChoiceQuestionId) => {
    const multipleChoiceQuestionAnswers = await MultipleChoiceQuestionAnswer.findAll({
        where: {
            MultipleChoiceQuestionId: multipleChoiceQuestionId,
            AnswerText: {
                [Sequelize.Op.and]: {
                    [Sequelize.Op.ne]: null,
                    [Sequelize.Op.ne]: ""
                }
            }
        },
        order: [
            ['SequenceNumber', 'ASC']
        ]
    });
    return multipleChoiceQuestionAnswers;
};

const deleteByQuestionId = async (multipleChoiceQuestionId) => {
    await MultipleChoiceQuestionAnswer.destroy({
        where: {
            MultipleChoiceQuestionId: multipleChoiceQuestionId
        }
    });
};

const getByQuestionIds = async (multipleChoiceQuestionIds) => {
    return await MultipleChoiceQuestionAnswer.findAll({
        where: {
            MultipleChoiceQuestionId: {
                [Sequelize.Op.in]: multipleChoiceQuestionIds
            }
        }
    });
};

export default {
    create,
    getAll,
    getById,
    update,
    deleteMultipleChoiceQuestionAnswer,
    getByQuestionId,
    deleteByQuestionId,
    getByQuestionIds
};
