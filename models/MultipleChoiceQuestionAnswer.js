import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class MultipleChoiceQuestionAnswer extends Model { }

MultipleChoiceQuestionAnswer.init({
  Id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  AnswerText: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  AnswerImageUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  AnswerImageMediaId: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  AnswerAudioUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  AnswerAudioMediaId: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  IsCorrect: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  CustomAnswerFeedbackText: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  CustomAnswerFeedbackImage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  CustomAnswerFeedbackImageMediaId: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  CustomAnswerFeedbackAudio: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  CustomAnswerFeedbackAudioMediaId: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  MultipleChoiceQuestionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'MultipleChoiceQuestion',
      key: 'Id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  },
  SequenceNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'MultipleChoiceQuestionAnswer',
  tableName: 'MultipleChoiceQuestionAnswers',
  timestamps: false,
  indexes: [
    {
      name: 'MultipleChoiceQuestionAnswers_MultipleChoiceQuestionId',
      fields: ['MultipleChoiceQuestionId']
    }
  ]
});

export default MultipleChoiceQuestionAnswer;
