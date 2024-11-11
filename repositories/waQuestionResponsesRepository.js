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

const getTotalScoreForList = async (phoneNumber, lessonIdList) => {
    const totalScore = await WA_QuestionResponses.count({
        where: {
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

const getTotalQuestions = async (phoneNumber, lessonId) => {
    const totalQuestions = await WA_QuestionResponses.count({
        where: {
            phoneNumber: phoneNumber,
            lessonId: lessonId
        }
    });
    return totalQuestions;
};

const getTotalQuestionsForList = async (phoneNumber, lessonIdList) => {
    const totalQuestions = await WA_QuestionResponses.count({
        where: {
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

const deleteByPhoneNumber = async (phoneNumber) => {
    return await WA_QuestionResponses.destroy({
        where: {
            phoneNumber: phoneNumber
        }
    });
};

const watchAndSpeakScore = async (phoneNumber, lessonId) => {
    const submittedFeedbackJson = await WA_QuestionResponses.findAll({
        where: {
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


const watchAndSpeakScoreForList = async (phoneNumber, lessonIdList) => {
    const submittedFeedbackJson = await WA_QuestionResponses.findAll({
        where: {
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
        let pronScore = 0;
        let fluencyScore = 0;
        if (jsonArray && jsonArray.length > 0) {
            const parsedJson = jsonArray[0]; // Access the first JSON object directly
            pronScore = parsedJson.scoreNumber.pronScore;
            fluencyScore = parsedJson.scoreNumber.fluencyScore;
        }

        // Calculate the combined score for this entry
        const combinedScore = (pronScore + fluencyScore) / 200 * 2;
        totalScore += combinedScore; // Accumulate the total score
        maxScore += 2; // Each entry has a max score of 2

        return {
            lessonId: response.get('lessonId'),
            pronScore: pronScore,
            fluencyScore: fluencyScore,
            combinedScore: combinedScore
        };
    });

    // Final output with the total score and the maximum possible score
    return {
        score: parseFloat(totalScore.toFixed(2)),
        total: parseFloat(maxScore.toFixed(2))
    };
};

const readScoreForList = async (phoneNumber, lessonIdList) => {
    const submittedFeedbackJson = await WA_QuestionResponses.findAll({
        where: {
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
        let pronScore = 0;
        let fluencyScore = 0;
        if (jsonArray && jsonArray.length > 0) {
            const parsedJson = jsonArray[0]; // Access the first JSON object directly
            pronScore = parsedJson.scoreNumber.pronScore;
            fluencyScore = parsedJson.scoreNumber.fluencyScore;
        }

        // Calculate the combined score for this entry with weightage of 6
        const combinedScore = (pronScore + fluencyScore) / 200 * 6;
        totalScore += combinedScore; // Accumulate the total score
        maxScore += 6; // Each entry now has a max score of 6

        return {
            lessonId: response.get('lessonId'),
            pronScore: pronScore,
            fluencyScore: fluencyScore,
            combinedScore: combinedScore
        };
    });

    // Final output with the total score and the maximum possible score
    return {
        score: parseFloat(totalScore.toFixed(2)),
        total: parseFloat(maxScore.toFixed(2))
    };
};

const monologueScoreForList = async (phoneNumber, lessonIdList) => {
    const submittedFeedbackJson = await WA_QuestionResponses.findAll({
        where: {
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

    // Mapping through the results to extract, calculate, and sum the score data
    const individualScores = submittedFeedbackJson.map(response => {
        const jsonArray = response.get('submittedFeedbackJson'); // Get the JSON array

        // Directly access the PronScore and FluencyScore if the JSON structure is valid
        let pronScore = 0;
        let fluencyScore = 0;

        if (jsonArray && jsonArray.length > 0) {
            const parsedJson = jsonArray[0][0]; // Access the first JSON object directly
            if (parsedJson && parsedJson.NBest && parsedJson.NBest.length > 0) {
                const assessment = parsedJson.NBest[0].PronunciationAssessment;
                if (assessment) {
                    pronScore = assessment.PronScore;
                    fluencyScore = assessment.FluencyScore;
                }
            }
        }
        // Calculate the combined score for this entry with weightage of 5
        const combinedScore = (pronScore + fluencyScore) / 200 * 5;
        totalScore += combinedScore; // Accumulate the total score
        maxScore += 5; // Each entry now has a max score of 5

        return {
            lessonId: response.get('lessonId'),
            pronScore: pronScore,
            fluencyScore: fluencyScore,
            combinedScore: combinedScore
        };
    });

    // Final output with the total score and the maximum possible score
    return {
        score: parseFloat(totalScore.toFixed(2)),
        total: parseFloat(maxScore.toFixed(2))
    };
};





export default {
    create,
    getAll,
    getById,
    update,
    deleteById,
    getTotalScore,
    getTotalQuestions,
    deleteByPhoneNumber,
    getTotalScoreForList,
    getTotalQuestionsForList,
    watchAndSpeakScore,
    watchAndSpeakScoreForList,
    readScoreForList,
    monologueScoreForList,
};
