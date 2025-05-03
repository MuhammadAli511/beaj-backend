import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class WA_Feedback extends Model { }

WA_Feedback.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    phoneNumber: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    profile_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    feedbackContent: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    courseId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    lessonId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    weekNumber: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    dayNumber: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    activityType: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: true,
    },
    metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
    },
    profile_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
}, {
    sequelize,
    modelName: 'WA_Feedback',
    tableName: 'wa_feedback',
    timestamps: false,
});

export default WA_Feedback;