import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class AudioChats extends Model { }

AudioChats.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userAudio: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    userText: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    modelAudio: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    modelText: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    userSpeechToTextTime: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    modelFeedbackTime: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    modelTextToSpeechTime: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    totalTime: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    modelPrompt: {
        type: DataTypes.TEXT,
        allowNull: true
    },
}, {
    sequelize,
    modelName: 'AudioChats',
    tableName: 'AudioChats',
    timestamps: false,
    indexes: [
        {
            name: 'PK_AudioChats',
            unique: true,
            fields: ['id']
        }
    ]
});

export default AudioChats;
