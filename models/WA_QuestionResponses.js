import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class WA_QuestionResponses extends Model { }

WA_QuestionResponses.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    phoneNumber: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    lessonId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    questionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    activityType: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    alias: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    submittedAnswerText: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        allowNull: true,
    },
    submittedUserAudio: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        allowNull: true,
    },
    correct: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
    },
    numberOfTries: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    submissionDate: {
        type: DataTypes.DATE,
        allowNull: true,
    }
}, {
    sequelize,
    modelName: 'WA_QuestionResponses',
    tableName: 'wa_question_responses',
    timestamps: false,
});

export default WA_QuestionResponses;