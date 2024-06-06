import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class RefreshToken extends Model {}

RefreshToken.init({
  Id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  Token: {
    type: DataTypes.STRING,
    allowNull: true
  },
  Expires: {
    type: DataTypes.DATE,
    allowNull: false
  },
  Created: {
    type: DataTypes.DATE,
    allowNull: false
  },
  CreatedByIp: {
    type: DataTypes.STRING,
    allowNull: true
  },
  Revoked: {
    type: DataTypes.DATE,
    allowNull: true
  },
  RevokedByIp: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ReplacedByToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ApplicationUserId: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'RefreshToken',
  tableName: 'RefreshTokens',
  timestamps: false,
  indexes: [
    {
      name: 'IX_RefreshToken_ApplicationUserId',
      fields: ['ApplicationUserId']
    }
  ]
});

export default RefreshToken;
