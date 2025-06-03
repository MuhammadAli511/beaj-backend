import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class MultipleChoiceQuestion extends Model { }

MultipleChoiceQuestion.init({
  Id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  QuestionType: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  QuestionText: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  QuestionImageUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  QuestionImageMediaId: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  QuestionAudioUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  QuestionAudioMediaId: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  QuestionVideoUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  QuestionVideoMediaId: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  QuestionNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  LessonId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Lesson',
      key: 'LessonId'
    },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  },
  OptionsType: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'MultipleChoiceQuestion',
  tableName: 'MultipleChoiceQuesions',
  timestamps: false,
  indexes: [
    {
      name: 'MultipleChoiceQuestions_LessonId',
      fields: ['LessonId']
    }
  ]
});

export default MultipleChoiceQuestion;
