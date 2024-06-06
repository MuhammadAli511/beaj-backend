import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class Otp extends Model {}

Otp.init({
  Id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  recieverNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  otp: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  StartTime: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'Otp',
  tableName: 'Otps',
  timestamps: false
});

export default Otp;
