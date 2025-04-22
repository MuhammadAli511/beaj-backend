import WA_QuestionResponses from '../models/WA_QuestionResponses.js';
import sequelize from '../config/sequelize.js';
import Sequelize from 'sequelize';
import { question_bot_prompt } from "../utils/prompts.js";

const create = async (profileId, phoneNumber, lessonId, questionId, activityType, alias, submittedAnswerText, submittedUserAudio, submittedFeedbackText, submittedFeedbackAudio, submittedFeedbackJson, correct, numberOfTries, submissionDate) => {
    const response = new WA_QuestionResponses({
        profile_id: profileId,
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

const updateReplace = async (
    profileId,
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
        updateFields.submittedAnswerText = submittedAnswerText;
    }
    if (submittedUserAudio) {
        updateFields.submittedUserAudio = submittedUserAudio;
    }
    if (submittedFeedbackText) {
        updateFields.submittedFeedbackText = submittedFeedbackText;
    }
    if (submittedFeedbackAudio) {
        updateFields.submittedFeedbackAudio = submittedFeedbackAudio;
    }
    if (correct !== null) {
        updateFields.correct = correct;
    }
    if (submittedFeedbackJson) {
        updateFields.submittedFeedbackJson = submittedFeedbackJson;
    }

    // Other fields to update (non-array fields)
    updateFields.profile_id = profileId;
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
            profile_id: profileId,
            phoneNumber: phoneNumber,
            lessonId: lessonId,
            questionId: questionId,
        },
    });
};

const update = async (
    profileId,
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
            `ARRAY_APPEND("submittedAnswerText", ${sequelize.escape(submittedAnswerText)})`
        );
    }
    if (submittedUserAudio) {
        updateFields.submittedUserAudio = sequelize.literal(
            `ARRAY_APPEND("submittedUserAudio", '${submittedUserAudio}')`
        );
    }
    if (submittedFeedbackText) {
        updateFields.submittedFeedbackText = sequelize.literal(
            `ARRAY_APPEND("submittedFeedbackText", '${sequelize.escape(submittedFeedbackText)}')`
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
            `ARRAY_APPEND("submittedFeedbackJson", ${sequelize.escape(JSON.stringify(submittedFeedbackJson))})`
        );
    }

    // Other fields to update (non-array fields)
    updateFields.profile_id = profileId;
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
            profile_id: profileId,
            phoneNumber: phoneNumber,
            lessonId: lessonId,
            questionId: questionId,
        },
    });
};

const getTotalScore = async (profileId, phoneNumber, lessonId) => {
    const totalScore = await WA_QuestionResponses.count({
        where: {
            profile_id: profileId,
            phoneNumber: phoneNumber,
            lessonId: lessonId,
            correct: {
                [Sequelize.Op.contains]: [true]
            }
        }
    });
    return totalScore;
};

const getTotalScoreForList = async (profileId, phoneNumber, lessonIdList) => {
    const totalScore = await WA_QuestionResponses.count({
        where: {
            profile_id: profileId,
            phoneNumber: phoneNumber,
            lessonId: {
                [Sequelize.Op.in]: lessonIdList
            },
            correct: {
                [Sequelize.Op.contains]: [true]
            }
        }
    });
    return totalScore;
};

const getTotalQuestions = async (profileId, phoneNumber, lessonId) => {
    const totalQuestions = await WA_QuestionResponses.count({
        where: {
            profile_id: profileId,
            phoneNumber: phoneNumber,
            lessonId: lessonId
        }
    });
    return totalQuestions;
};

const getTotalQuestionsForList = async (profileId, phoneNumber, lessonIdList) => {
    const totalQuestions = await WA_QuestionResponses.count({
        where: {
            profile_id: profileId,
            phoneNumber: phoneNumber,
            lessonId: {
                [Sequelize.Op.in]: lessonIdList
            }
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

const deleteByProfileId = async (profileId) => {
    return await WA_QuestionResponses.destroy({
        where: {
            profile_id: profileId
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

const watchAndSpeakScore = async (profileId, phoneNumber, lessonId) => {
    const submittedFeedbackJson = await WA_QuestionResponses.findAll({
        where: {
            profile_id: profileId,
            phoneNumber: phoneNumber,
            lessonId: lessonId
        },
        attributes: [
            [sequelize.json("submittedFeedbackJson->0->'scoreNumber'"), "scoreNumber"]
        ]
    });

    // Extracting the scoreNumber data from the result
    const scoreData = submittedFeedbackJson.map(response => response.get('scoreNumber'));

    // Formatting it to return only the extracted scores in JSON format
    const formattedScores = scoreData.map(scores => {
        return {
            compScore: scores.compScore,
            pronScore: scores.pronScore,
            fluencyScore: scores.fluencyScore,
            prosodyScore: scores.prosodyScore,
            accuracyScore: scores.accuracyScore
        };
    });

    return formattedScores;
};

const watchAndSpeakScoreForList = async (profileId, phoneNumber, lessonIdList) => {
    const submittedFeedbackJson = await WA_QuestionResponses.findAll({
        where: {
            profile_id: profileId,
            phoneNumber: phoneNumber,
            lessonId: {
                [Sequelize.Op.in]: lessonIdList
            }
        },
        attributes: [
            'lessonId', // Include lessonId to identify each result
            'submittedFeedbackJson' // Retrieve the column directly
        ]
    });

    // Initialize variables for score accumulation
    let totalScore = 0;
    let maxScore = 0;

    // Mapping through the results to extract, calculate and sum the score data
    const individualScores = submittedFeedbackJson.map(response => {
        const jsonArray = response.get('submittedFeedbackJson'); // Get the JSON array

        // Directly access the first element in the JSON array if it exists
        let accuracyScore = 0;
        let fluencyScore = 0;
        let compScore = 0;
        if (jsonArray && jsonArray.length > 0) {
            const parsedJson = jsonArray[0]; // Access the first JSON object directly
            accuracyScore = parsedJson.scoreNumber.accuracyScore;
            fluencyScore = parsedJson.scoreNumber.fluencyScore;
            compScore = parsedJson.scoreNumber.compScore;
        }

        // Calculate the combined score for this entry
        const combinedScore = (accuracyScore + fluencyScore + compScore) / 300 * 2;
        totalScore += combinedScore; // Accumulate the total score
        maxScore += 2; // Each entry has a max score of 2

        return {
            lessonId: response.get('lessonId'),
            accuracyScore: accuracyScore,
            fluencyScore: fluencyScore,
            compScore: compScore,
            combinedScore: combinedScore
        };
    });

    // Final output with the total score and the maximum possible score
    return {
        score: parseFloat(totalScore.toFixed(2)),
        total: parseFloat(maxScore.toFixed(2))
    };
};

const readScoreForList = async (profileId, phoneNumber, lessonIdList) => {
    const submittedFeedbackJson = await WA_QuestionResponses.findAll({
        where: {
            profile_id: profileId,
            phoneNumber: phoneNumber,
            lessonId: {
                [Sequelize.Op.in]: lessonIdList
            }
        },
        attributes: [
            'lessonId', // Include lessonId to identify each result
            'submittedFeedbackJson' // Retrieve the column directly
        ]
    });

    // Initialize variables for score accumulation
    let totalScore = 0;
    let maxScore = 0;

    // Mapping through the results to extract, calculate and sum the score data
    const individualScores = submittedFeedbackJson.map(response => {
        const jsonArray = response.get('submittedFeedbackJson'); // Get the JSON array

        // Directly access the first element in the JSON array if it exists
        let accuracyScore = 0;
        let fluencyScore = 0;
        let compScore = 0;
        if (jsonArray && jsonArray.length > 0) {
            const parsedJson = jsonArray[0]; // Access the first JSON object directly
            accuracyScore = parsedJson.scoreNumber.accuracyScore;
            fluencyScore = parsedJson.scoreNumber.fluencyScore;
            compScore = parsedJson.scoreNumber.compScore;
        }

        // Calculate the combined score for this entry with weightage of 6
        const combinedScore = (accuracyScore + fluencyScore + compScore) / 300 * 6;
        totalScore += combinedScore; // Accumulate the total score
        maxScore += 6; // Each entry now has a max score of 6

        return {
            lessonId: response.get('lessonId'),
            accuracyScore: accuracyScore,
            fluencyScore: fluencyScore,
            compScore: compScore,
            combinedScore: combinedScore
        };
    });

    // Final output with the total score and the maximum possible score
    return {
        score: parseFloat(totalScore.toFixed(2)),
        total: parseFloat(maxScore.toFixed(2))
    };
};

const monologueScoreForList = async (profileId, phoneNumber, lessonIdList) => {
    const submittedFeedbackJson = await WA_QuestionResponses.findAll({
        where: {
            profile_id: profileId,
            phoneNumber: phoneNumber,
            lessonId: {
                [Sequelize.Op.in]: lessonIdList
            }
        },
        attributes: [
            'lessonId', // Include lessonId to identify each result
            'submittedFeedbackJson' // Retrieve the column directly
        ]
    });

    // Initialize variables for score accumulation
    let totalScore = 0;
    let maxScore = 0;

    // Mapping through the results to extract, calculate and sum the score data
    const individualScores = submittedFeedbackJson.map(response => {
        const jsonArray = response.get('submittedFeedbackJson'); // Get the JSON array

        // Directly access the first element in the JSON array if it exists
        let accuracyScore = 0;
        let fluencyScore = 0;
        let compScore = 0;
        if (jsonArray && jsonArray.length > 0) {
            const parsedJson = jsonArray[0]; // Access the first JSON object directly
            accuracyScore = parsedJson.scoreNumber.accuracyScore;
            fluencyScore = parsedJson.scoreNumber.fluencyScore;
            compScore = parsedJson.scoreNumber.compScore;
        }

        // Calculate the combined score for this entry with weightage of 5
        const combinedScore = (accuracyScore + fluencyScore + compScore) / 300 * 5;
        totalScore += combinedScore; // Accumulate the total score
        maxScore += 5; // Each entry now has a max score of 5

        return {
            lessonId: response.get('lessonId'),
            accuracyScore: accuracyScore,
            fluencyScore: fluencyScore,
            compScore: compScore,
            combinedScore: combinedScore
        };
    });

    // Final output with the total score and the maximum possible score
    return {
        score: parseFloat(totalScore.toFixed(2)),
        total: parseFloat(maxScore.toFixed(2))
    };
};

const getByActivityType = async (activityType) => {
    return await WA_QuestionResponses.findAll({
        where: {
            activityType: activityType
        }
    });
};

const getPreviousMessages = async (profileId, phoneNumber, lessonId) => {
    const responses = await WA_QuestionResponses.findAll({
        where: {
            profile_id: profileId,
            phoneNumber: phoneNumber,
            lessonId: lessonId
        },
        order: [
            ['submissionDate', 'ASC']
        ]
    });

    let finalMessages = [];

    if (responses.length > 0) {
        responses.forEach(async (response, index) => {
            if (index === 0) {
                finalMessages.push({
                    role: "user",
                    content: await question_bot_prompt() + "\n\nUser Response: " + response.dataValues.submittedAnswerText[0]
                });
            } else {
                finalMessages.push({
                    role: "user",
                    content: response.dataValues.submittedAnswerText[0]
                });
            }
            finalMessages.push({
                role: "assistant",
                content: response.dataValues.submittedFeedbackText[0]
            });
        });
    }

    return finalMessages;
};

const getPreviousMessagesForAgencyBot = async (profileId, phoneNumber, lessonId, questionText) => {
    const responses = await WA_QuestionResponses.findAll({
        where: {
            profile_id: profileId,
            phoneNumber: phoneNumber,
            lessonId: lessonId
        },
        order: [
            ['submissionDate', 'ASC']
        ]
    });

    let finalMessages = [];

    if (responses.length > 0) {
        responses.forEach(async (response, index) => {
            if (index === 0) {
                finalMessages.push({
                    role: "user",
                    content: questionText + "\n\n\nMy response: " + response.dataValues.submittedAnswerText[0]
                });
            } else {
                finalMessages.push({
                    role: "user",
                    content: response.dataValues.submittedAnswerText[0]
                });
            }
            finalMessages.push({
                role: "assistant",
                content: response.dataValues.submittedFeedbackText[0]
            });
        });
    }
    return finalMessages;
};

const getLatestBotResponse = async (profileId, phoneNumber, lessonId) => {
    const response = await WA_QuestionResponses.findOne({
        where: {
            profile_id: profileId,
            phoneNumber: phoneNumber,
            lessonId: lessonId
        }
    });

    return response.dataValues.submittedFeedbackText[0];
};

const checkRecordExistsForProfileIdAndLessonId = async (profileId, lessonId) => {
    const response = await WA_QuestionResponses.findOne({
        where: {
            profile_id: profileId,
            lessonId: lessonId
        }
    });

    return response ? false : true;
};

const getAllJsonFeedbacksForProfileIdAndLessonId = async (profileId, lessonId) => {
    const response = await WA_QuestionResponses.findAll({
        where: {
            profile_id: profileId,
            lessonId: lessonId
        },
        order: [['submissionDate', 'ASC']]
    });

    let finalJsonFeedbacks = [];
    response.forEach(response => {
        finalJsonFeedbacks.push(response.dataValues.submittedFeedbackJson[0]);
    });

    return finalJsonFeedbacks;
};

const getAudioUrlForProfileIdAndQuestionIdAndLessonId = async (profileId, questionId, lessonId) => {
    const response = await WA_QuestionResponses.findOne({
        where: {
            profile_id: profileId,
            questionId: questionId,
            lessonId: lessonId
        }
    });

    return response.dataValues.submittedUserAudio[0];
};


export default {
    create,
    getAll,
    getById,
    update,
    updateReplace,
    deleteById,
    getTotalScore,
    getTotalQuestions,
    deleteByProfileId,
    deleteByPhoneNumber,
    getTotalScoreForList,
    getTotalQuestionsForList,
    watchAndSpeakScore,
    watchAndSpeakScoreForList,
    readScoreForList,
    monologueScoreForList,
    getByActivityType,
    getPreviousMessages,
    checkRecordExistsForProfileIdAndLessonId,
    getLatestBotResponse,
    getAllJsonFeedbacksForProfileIdAndLessonId,
    getAudioUrlForProfileIdAndQuestionIdAndLessonId,
    getPreviousMessagesForAgencyBot
};