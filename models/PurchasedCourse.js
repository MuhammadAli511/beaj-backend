import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class PurchasedCourse extends Model {}

PurchasedCourse.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  customerId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  courseCategoryId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  courseId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  courseStartDate: {
    type: DataTypes.STRING,
    allowNull: true
  },
  courseEndDate: {
    type: DataTypes.STRING,
    allowNull: true
  },
  totalTimeSpentOnCourse: {
    type: DataTypes.STRING,
    allowNull: true
  },
  callBackStatus: {
    type: DataTypes.STRING,
    allowNull: true
  },
  purchaseDate: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'PurchasedCourse',
  tableName: 'purchasedCourses',
  timestamps: false
});

export default PurchasedCourse;
