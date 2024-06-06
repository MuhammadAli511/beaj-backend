import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class UserRole extends Model {}

UserRole.init({
  UserId: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
  },
  RoleId: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
  }
}, {
  sequelize,
  modelName: 'UserRole',
  tableName: 'UserRoles',
  timestamps: false,
  indexes: [
    {
      name: 'PK_UserRoles',
      unique: true,
      fields: ['UserId', 'RoleId']
    },
    {
      name: 'IX_UserRoles_RoleId',
      fields: ['RoleId']
    }
  ]
});

export default UserRole;
