import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class User extends Model { }

User.init({
  Id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  FirstName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  LastName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  dateRegistered: {
    type: DataTypes.STRING,
    allowNull: true
  },
  DOB: {
    type: DataTypes.STRING,
    allowNull: true
  },
  Gender: {
    type: DataTypes.STRING,
    allowNull: true
  },
  Occupation: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cohortPrefrence: {
    type: DataTypes.STRING,
    allowNull: true
  },
  qualification: {
    type: DataTypes.STRING,
    allowNull: true
  },
  whyLearnEnglish: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  hearAboutUs: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  CellNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  IsDeleted: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  Documents: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  UserName: {
    type: DataTypes.STRING(256),
    allowNull: true
  },
  NormalizedUserName: {
    type: DataTypes.STRING(256),
    allowNull: true,
    unique: true
  },
  Email: {
    type: DataTypes.STRING(256),
    allowNull: true
  },
  NormalizedEmail: {
    type: DataTypes.STRING(256),
    allowNull: true,
    unique: true
  },
  EmailConfirmed: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  PasswordHash: {
    type: DataTypes.STRING,
    allowNull: true
  },
  SecurityStamp: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ConcurrencyStamp: {
    type: DataTypes.STRING,
    allowNull: true
  },
  PhoneNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  PhoneNumberConfirmed: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  TwoFactorEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  LockoutEnd: {
    type: DataTypes.DATE,
    allowNull: true
  },
  LockoutEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  AccessFailedCount: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  backendRegistered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'User',
  tableName: 'User',
  timestamps: false,
  indexes: [
    {
      name: 'EmailIndex',
      unique: true,
      fields: ['NormalizedEmail']
    },
    {
      name: 'UserNameIndex',
      unique: true,
      fields: ['NormalizedUserName']
    }
  ]
});

export default User;
