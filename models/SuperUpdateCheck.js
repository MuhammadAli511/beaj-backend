import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class SuperUpdateCheck extends Model {}

SuperUpdateCheck.init({
  Id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  CourseId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  CourseCategoryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  LatestCourseUploadDate: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'SuperUpdateCheck',
  tableName: 'SuperUpdateCheck',
  timestamps: false
});

export default SuperUpdateCheck;
