import WA_QuestionResponses from '../models/WA_QuestionResponses.js';
import sequelize from '../config/sequelize.js';
import Sequelize from 'sequelize';

const create = async (phoneNumber, lessonId, questionId, activityType, alias, submittedAnswerText, submittedUserAudio, submittedFeedbackText, submittedFeedbackAudio, submittedFeedbackJson, correct, numberOfTries, submissionDate) => {
    const response = new WA_QuestionResponses({
        phoneNumber: phoneNumber,
        lessonId: lessonId,
        questionId: questionId,
        activityType: activityType,
        alias: alias,
        submittedAnswerText: submittedAnswerText,
        submittedUserAudio: submittedUserAudio,
        submittedFeedbackText: submittedFeedbackText,
        submittedFeedbackAudio: submittedFeedbackAudio,
        submittedFeedbackJson: submittedFeedbackJson,
        correct: correct,
        numberOfTries: numberOfTries,
        submissionDate: submissionDate
    });
    return await response.save();
};

const getAll = async () => {
    return await WA_QuestionResponses.findAll();
};

const getById = async (id) => {
    return await WA_QuestionResponses.findByPk(id);
};

const update = async (
    phoneNumber,
    lessonId,
    questionId,
    activityType,
    alias,
    submittedAnswerText,
    submittedUserAudio,
    submittedFeedbackText,
    submittedFeedbackAudio,
    submittedFeedbackJson,
    correct,
    numberOfTries,
    submissionDate
) => {
    const updateFields = {};

    if (submittedAnswerText) {
        updateFields.submittedAnswerText = sequelize.literal(
            `ARRAY_APPEND("submittedAnswerText", '${submittedAnswerText}')`
        );
    }
    if (submittedUserAudio) {
        updateFields.submittedUserAudio = sequelize.literal(
            `ARRAY_APPEND("submittedUserAudio", '${submittedUserAudio}')`
        );
    }
    if (submittedFeedbackText) {
        updateFields.submittedFeedbackText = sequelize.literal(
            `ARRAY_APPEND("submittedFeedbackText", '${submittedFeedbackText}')`
        );
    }
    if (submittedFeedbackAudio) {
        updateFields.submittedFeedbackAudio = sequelize.literal(
            `ARRAY_APPEND("submittedFeedbackAudio", '${submittedFeedbackAudio}')`
        );
    }
    if (correct !== null) {
        updateFields.correct = sequelize.literal(
            `ARRAY_APPEND("correct", ${correct})`
        );
    }
    if (submittedFeedbackJson) {
        updateFields.submittedFeedbackJson = sequelize.literal(
            `ARRAY_APPEND("submittedFeedbackJson", '${JSON.stringify(submittedFeedbackJson)}')`
        );
    }

    // Other fields to update (non-array fields)
    updateFields.phoneNumber = phoneNumber;
    updateFields.lessonId = lessonId;
    updateFields.questionId = questionId;
    updateFields.activityType = activityType;
    updateFields.alias = alias;
    updateFields.numberOfTries = numberOfTries;
    updateFields.submissionDate = submissionDate;

    // Execute the update query based on phoneNumber, lessonId, and questionId
    return await WA_QuestionResponses.update(updateFields, {
        where: {
            phoneNumber: phoneNumber,
            lessonId: lessonId,
            questionId: questionId,
        },
    });
};

const getTotalScore = async (phoneNumber, lessonId) => {
    const totalScore = await WA_QuestionResponses.count({
        where: {
            phoneNumber: phoneNumber,
            lessonId: lessonId,
            correct: {
                [Sequelize.Op.contains]: [true]
            }
        }
    });
    return totalScore;
};

const getTotalQuestions = async (phoneNumber, lessonId) => {
    const totalQuestions = await WA_QuestionResponses.count({
        where: {
            phoneNumber: phoneNumber,
            lessonId: lessonId
        }
    });
    return totalQuestions;
};

const deleteById = async (id) => {
    return await WA_QuestionResponses.destroy({
        where: {
            id: id
        }
    });
};

const deleteByPhoneNumber = async (phoneNumber) => {
    return await WA_QuestionResponses.destroy({
        where: {
            phoneNumber: phoneNumber
        }
    });
};

export default {
    create,
    getAll,
    getById,
    update,
    deleteById,
    getTotalScore,
    getTotalQuestions,
    deleteByPhoneNumber
};
