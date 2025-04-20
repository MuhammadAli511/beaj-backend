import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class WA_LessonsCompleted extends Model { }

WA_LessonsCompleted.init({
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
    lessonId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    courseId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    completionStatus: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    startTime: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    endTime: {
        type: DataTypes.DATE,
        allowNull: true,
    }
}, {
    sequelize,
    modelName: 'WA_LessonsCompleted',
    tableName: 'wa_lessons_completed',
    timestamps: false,
});

export default WA_LessonsCompleted;
