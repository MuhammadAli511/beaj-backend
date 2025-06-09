import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class WA_UserProgress extends Model { }

WA_UserProgress.init({
    phoneNumber: {
        type: DataTypes.TEXT,
        primaryKey: true,
    },
    profile_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    persona: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    engagement_type: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    currentCourseId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    currentWeek: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    currentDay: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    currentLessonId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    currentLesson_sequence: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    currentDifficultyLevel: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    activityType: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    questionNumber: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    retryCounter: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    acceptableMessages: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        allowNull: true,
    },
    lastUpdated: {
        type: DataTypes.DATE,
        allowNull: true,
    }
}, {
    sequelize,
    modelName: 'WA_UserProgress',
    tableName: 'wa_user_progress',
    timestamps: false,
});

export default WA_UserProgress;
