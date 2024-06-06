import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class MultipleChoiceQuestion extends Model {}

MultipleChoiceQuestion.init({
  Id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  QuestionType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  QuestionText: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  QuestionImageUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  QuestionAudioUrl: {
    type: DataTypes.STRING,
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
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'MultipleChoiceQuestion',
  tableName: 'MultipleChoiceQuestions',
  timestamps: false,
  indexes: [
    {
      name: 'MultipleChoiceQuestions_LessonId',
      fields: ['LessonId']
    }
  ]
});

export default MultipleChoiceQuestion;
