import MultipleChoiceQuestion from '../models/multipleChoiceQuestion.js';
import Sequelize from 'sequelize';

const create = async (file, image, questionType, questionText, questionNumber, lessonId, optionsType) => {
    const multipleChoiceQuestion = new MultipleChoiceQuestion({
        QuestionAudioUrl: file,
        QuestionImageUrl: image,
        QuestionType: questionType,
        QuestionText: questionText,
        QuestionNumber: questionNumber,
        LessonId: lessonId,
        OptionsType: optionsType
    });
    await multipleChoiceQuestion.save();
    return multipleChoiceQuestion;
};

const getAll = async () => {
    const multipleChoiceQuestions = await MultipleChoiceQuestion.findAll();
    return multipleChoiceQuestions;
};

const getById = async (id) => {
    const multipleChoiceQuestion = await MultipleChoiceQuestion.getById(id);
    return multipleChoiceQuestion;
};

const update = async (id, file, image, questionType, questionText, questionNumber, lessonId, optionsType) => {
    const multipleChoiceQuestion = await MultipleChoiceQuestion.findByIdAndUpdate(id, {
        QuestionAudioUrl: file,
        QuestionImageUrl: image,
        QuestionType: questionType,
        QuestionText: questionText,
        QuestionNumber: questionNumber,
        LessonId: lessonId,
        OptionsType: optionsType
    }, { new: true });
    return multipleChoiceQuestion;
};

const deleteMultipleChoiceQuestion = async (id) => {
    await MultipleChoiceQuestion.findByIdAndDelete(id);
};

const getNextMultipleChoiceQuestion = async (lessonId, questionNumber) => {
    if (!questionNumber) {
        return await MultipleChoiceQuestion.findOne({
            where: {
                LessonId: lessonId
            },
            order: [
                ['QuestionNumber', 'ASC']
            ]
        });
    }
    let nextMCQ = await MultipleChoiceQuestion.findOne({
        where: {
            LessonId: lessonId,
            QuestionNumber: {
                [Sequelize.Op.gt]: questionNumber
            }
        },
        order: [
            ['QuestionNumber', 'ASC']
        ]
    });
    if (!nextMCQ) {
        return null;
    }
}

export default {
    create,
    getAll,
    getById,
    update,
    deleteMultipleChoiceQuestion,
    getNextMultipleChoiceQuestion
};