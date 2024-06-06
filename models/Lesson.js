import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class Lesson extends Model {}

Lesson.init({
  LessonId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  lessonType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  dayNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  activity: {
    type: DataTypes.STRING,
    allowNull: false
  },
  activityAlias: {
    type: DataTypes.STRING,
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
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  },
  SequenceNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
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
