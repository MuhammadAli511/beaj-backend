import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class SpeakActivityQuestion extends Model { }

SpeakActivityQuestion.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  lessonId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  question: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  answer: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    allowNull: true
  },
  mediaFile: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  mediaFileMediaId: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  mediaFileSecond: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  mediaFileSecondMediaId: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  questionNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  customFeedbackText: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  customFeedbackImage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  customFeedbackAudio: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  customFeedbackImageMediaId: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  customFeedbackAudioMediaId: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  difficultyLevel: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'SpeakActivityQuestion',
  tableName: 'speakActivityQuestions',
  timestamps: false,
  indexes: [
    {
      name: 'IX_speakActivityQuestions_lessonId',
      fields: ['lessonId']
    }
  ]
});

export default SpeakActivityQuestion;