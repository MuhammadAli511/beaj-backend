import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class Course extends Model { }

Course.init({
  CourseId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  CourseName: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  CoursePrice: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  CourseWeeks: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  CourseCategoryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'CourseCategories',
      key: 'CourseCategoryId'
    },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  },
  status: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  SequenceNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  CourseDescription: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  courseStartDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  courseLanguage: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'Course',
  tableName: 'Courses',
  timestamps: false,
  indexes: [
    {
      name: 'Course_CourseCategoryId',
      fields: ['CourseCategoryId']
    }
  ]
});

export default Course;
