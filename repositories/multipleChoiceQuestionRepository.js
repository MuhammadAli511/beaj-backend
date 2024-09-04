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
    const multipleChoiceQuestion = await MultipleChoiceQuestion.findByPk(id);
    return multipleChoiceQuestion;
};

const update = async (id, file, image, questionType, questionText, questionNumber, lessonId, optionsType) => {
    return await MultipleChoiceQuestion.update({
        QuestionAudioUrl: file,
        QuestionImageUrl: image,
        QuestionType: questionType,
        QuestionText: questionText,
        QuestionNumber: questionNumber,
        LessonId: lessonId,
        OptionsType: optionsType
    }, {
        where: {
            Id: id
        }
    });
};

const deleteMultipleChoiceQuestion = async (id) => {
    return await MultipleChoiceQuestion.destroy({
        where: {
            Id: id
        }
    });
};

const getCurrentMultipleChoiceQuestion = async (lessonId, questionNumber) => {
    const currentMCQ = await MultipleChoiceQuestion.findOne({
        where: {
            LessonId: lessonId,
            QuestionNumber: questionNumber
        }
    });
    return currentMCQ;
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
    if (lessonId && questionNumber) {
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
        return nextMCQ;
    }
}

const getByLessonIds = async (lessonIds) => {
    return await MultipleChoiceQuestion.findAll({
        where: {
            LessonId: {
                [Sequelize.Op.in]: lessonIds
            }
        }
    });
};

const getByLessonId = async (lessonId) => {
    return await MultipleChoiceQuestion.findAll({
        where: {
            LessonId: lessonId
        }
    });
};

const deleteByLessonId = async (lessonId) => {
    return await MultipleChoiceQuestion.destroy({
        where: {
            LessonId: lessonId
        }
    });
};

export default {
    create,
    getAll,
    getById,
    update,
    deleteMultipleChoiceQuestion,
    getNextMultipleChoiceQuestion,
    getCurrentMultipleChoiceQuestion,
    getByLessonIds,
    getByLessonId,
    deleteByLessonId
};