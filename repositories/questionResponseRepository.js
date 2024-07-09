import QuestionResponse from '../models/QuestionResponse.js';
import Sequelize from 'sequelize';

const create = async (userId, lessonId, questionId, activityType, alias, submittedAnswerText, submittedUserAudio, correct, numberOfTries, submissionDate) => {
    const questionResponse = new QuestionResponse({
        UserId: userId,
        lessonId: lessonId,
        questionId: questionId,
        activityType: activityType,
        alias: alias,
        submittedAnswerText: submittedAnswerText,
        submittedUserAudio: submittedUserAudio,
        correct: correct,
        numberOfTries: numberOfTries,
        submissionDate: submissionDate
    });
    await questionResponse.save();
    return questionResponse;
};

const getAll = async () => {
    const questionResponses = await QuestionResponse.findAll();
    return questionResponses;
};

const getById = async (id) => {
    const questionResponse = await QuestionResponse.findByPk(id);
    return questionResponse;
};

const update = async (id, userId, lessonId, questionId, activityType, alias, submittedAnswerText, submittedUserAudio, correct, numberOfTries, submissionDate) => {
    const questionResponse = await QuestionResponse.findByPk(id);
    questionResponse.UserId = userId;
    questionResponse.lessonId = lessonId;
    questionResponse.questionId = questionId;
    questionResponse.activityType = activityType;
    questionResponse.alias = alias;
    questionResponse.submittedAnswerText = submittedAnswerText;
    questionResponse.submittedUserAudio = submittedUserAudio;
    questionResponse.correct = correct;
    questionResponse.numberOfTries = numberOfTries;
    questionResponse.submissionDate = submissionDate;
    await questionResponse.save();
    return questionResponse;
};

const getScore = async (userId, lessonId) => {
    const score = await QuestionResponse.count({
        where: {
            UserId: userId,
            lessonId: lessonId,
            correct: true
        }
    });
    return score;
};

const deleteQuestionResponse = async (id) => {
    const questionResponse = await QuestionResponse.findByPk(id);
    await questionResponse.destroy();
};

export default {
    create,
    getAll,
    getById,
    update,
    getScore,
    deleteQuestionResponse
};