import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class CourseWeek extends Model { }

CourseWeek.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  weekNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  image: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  courseId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Courses',
      key: 'id'
    }
  }
}, {
  sequelize,
  modelName: 'CourseWeek',
  tableName: 'courseWeek',
  timestamps: false
});

export default CourseWeek;
