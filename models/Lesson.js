import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class Lesson extends Model { }

Lesson.init({
  LessonId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  lessonType: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  dayNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  activity: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  activityAlias: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  weekNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  courseId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Courses',
      key: 'CourseId'
    },
  },
  SequenceNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  textInstruction: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  audioInstructionUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  audioInstructionMediaId: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  skipOnFirstQuestion: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  skipOnStart: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  skipOnStartToLessonId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'createdAt',
  }
}, {
  sequelize,
  modelName: 'Lesson',
  tableName: 'Lesson',
  timestamps: false,
  indexes: [
    {
      name: 'Lesson_courseId',
      fields: ['courseId']
    },
    {
      name: 'idx_lesson_activityalias',
      fields: ['activityAlias']
    }
  ]
});

export default Lesson;
