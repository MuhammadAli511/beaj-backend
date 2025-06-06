import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class CourseCategory extends Model { }

CourseCategory.init({
  CourseCategoryId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  CourseCategoryName: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  image: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  CategorySequenceNum: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'CourseCategory',
  tableName: 'CourseCategories',
  timestamps: false
});

export default CourseCategory;
