import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class QuestionResponse extends Model {}

QuestionResponse.init({
  Id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  UserId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lessonId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  questionId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  activityType: {
    type: DataTypes.STRING,
    allowNull: true
  },
  alias: {
    type: DataTypes.STRING,
    allowNull: true
  },
  submittedAnswerText: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  submittedUserAudio: {
    type: DataTypes.STRING,
    allowNull: true
  },
  correct: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  numberOfTries: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  submissionDate: {
    type: DataTypes.STRING,
    defaultValue: '31/10/2023 04:00:00 PM'
  }
}, {
  sequelize,
  modelName: 'QuestionResponse',
  tableName: 'questionResponses',
  timestamps: false,
  indexes: [
    {
      name: 'tempuniqueindex_questionresponses_id',
      unique: true,
      fields: ['Id']
      },
      {
        name: 'idx_questionresponses_alias',
        fields: ['alias']
      }
  ]
});

export default QuestionResponse;
