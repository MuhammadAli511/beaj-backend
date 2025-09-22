import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';


class LessonInstructions extends Model { }

LessonInstructions.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    lessonId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Lesson',
            key: 'LessonId'
        }
    },
    instructionType: {
        type: DataTypes.ENUM('audio', 'text', 'image', 'video', 'pdf'),
        allowNull: false
    },
    position: {
        type: DataTypes.ENUM('start', 'end'),
        allowNull: false
    },
    url: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    mediaId: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    caption: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'LessonInstructions',
    tableName: 'LessonInstructions',
    timestamps: false,
    indexes: [
        { name: 'idx_lesson_instructions_lessonid', fields: ['lessonId'] }
    ]
});

export default LessonInstructions;