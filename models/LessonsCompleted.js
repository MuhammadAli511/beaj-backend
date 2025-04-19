import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class LessonsCompleted extends Model {}

LessonsCompleted.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lessonId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  courseId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  completionStatus: {
    type: DataTypes.STRING,
    allowNull: true
  },
  FirstTimeCompletionDate: {
    type: DataTypes.STRING,
    defaultValue: '01/01/2023 1:05:06 AM'
  },
  LatestDateStarted: {
    type: DataTypes.STRING,
    defaultValue: '01/01/2023 1:05:06 AM'
  },
  FirstTimeStartDate: {
    type: DataTypes.STRING,
    allowNull: true
  },
  TotalNumberOfStarted: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    defaultValue: 0.0
  },
  LatestDateCompleted: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'LessonsCompleted',
  tableName: 'LessonsCompleted',
  timestamps: false,
  indexes: [
    {
      name: 'IX_LessonsCompleted_lessonId',
      fields: ['lessonId']
    }
  ]
});

export default LessonsCompleted;
