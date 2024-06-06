import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class Role extends Model {}

Role.init({
  Id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  Name: {
    type: DataTypes.STRING(256),
    allowNull: false
  },
  NormalizedName: {
    type: DataTypes.STRING(256),
    allowNull: false,
    unique: true
  },
  ConcurrencyStamp: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'Role',
  tableName: 'Roles',
  timestamps: false,
  indexes: [
    {
      name: 'RoleNameIndex',
      unique: true,
      fields: ['NormalizedName']
    }
  ]
});

export default Role;
