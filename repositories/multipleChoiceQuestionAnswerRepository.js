import MultipleChoiceQuestionAnswer from "../models/MultipleChoiceQuestionAnswer.js";

const create = async (answerText, answerImageUrl, answerAudioUrl, isCorrect, multipleChoiceQuestionId, sequenceNumber) => {
    const multipleChoiceQuestionAnswer = new MultipleChoiceQuestionAnswer({
        AnswerText: answerText,
        AnswerImageUrl: answerImageUrl,
        AnswerAudioUrl: answerAudioUrl,
        IsCorrect: isCorrect,
        MultipleChoiceQuestionId: multipleChoiceQuestionId,
        SequenceNumber: sequenceNumber
    });
    await multipleChoiceQuestionAnswer.save();
    return multipleChoiceQuestionAnswer;
};

const getAll = async () => {
    const multipleChoiceQuestionAnswers = await MultipleChoiceQuestionAnswer.findAll();
    return multipleChoiceQuestionAnswers;
};

const getById = async (id) => {
    const multipleChoiceQuestionAnswer = await MultipleChoiceQuestionAnswer.getById(id);
    return multipleChoiceQuestionAnswer;
};

const update = async (id, answerText, answerImageUrl, answerAudioUrl, isCorrect, multipleChoiceQuestionId, sequenceNumber) => {
    const multipleChoiceQuestionAnswer = await MultipleChoiceQuestionAnswer.findByIdAndUpdate(id, {
        AnswerText: answerText,
        AnswerImageUrl: answerImageUrl,
        AnswerAudioUrl: answerAudioUrl,
        IsCorrect: isCorrect,
        MultipleChoiceQuestionId: multipleChoiceQuestionId,
        SequenceNumber: sequenceNumber
    }, { new: true });
    return multipleChoiceQuestionAnswer;
};

const deleteMultipleChoiceQuestionAnswer = async (id) => {
    await MultipleChoiceQuestionAnswer.findByIdAndDelete(id);
};

const getByQuestionId = async (multipleChoiceQuestionId) => {
    const multipleChoiceQuestionAnswers = await MultipleChoiceQuestionAnswer.findAll({
        where: {
            MultipleChoiceQuestionId: multipleChoiceQuestionId
        }
    });
    return multipleChoiceQuestionAnswers;
};

export default {
    create,
    getAll,
    getById,
    update,
    deleteMultipleChoiceQuestionAnswer,
    getByQuestionId
};
