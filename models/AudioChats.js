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
        type: DataTypes.STRING,
        allowNull: true
    },
    modelAudio: {
        type: DataTypes.STRING,
        allowNull: true
    },
    userSpeechToTextTime: {
        type: DataTypes.STRING,
        allowNull: true
    },
    modelFeedbackTime: {
        type: DataTypes.STRING,
        allowNull: true
    },
    modelTextToSpeechTime: {
        type: DataTypes.STRING,
        allowNull: true
    },
    totalTime: {
        type: DataTypes.STRING,
        allowNull: true
    },
    modelPrompt: {
        type: DataTypes.STRING,
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
