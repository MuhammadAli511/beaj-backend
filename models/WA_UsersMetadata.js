import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class WA_UsersMetadata extends Model { }

WA_UsersMetadata.init({
    phoneNumber: {
        type: DataTypes.TEXT,
        primaryKey: true,
    },
    profile_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    userId: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        unique: true,
        allowNull: false,
    },
    name: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    city: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    timingPreference: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    targetGroup: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    scholarshipvalue: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    freeDemoStarted: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    freeDemoEnded: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    userClickedLink: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    userRegistrationComplete: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    cohort: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    isTeacher: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    schoolName: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    classLevel: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    rollout: {
        type: DataTypes.INTEGER,
        allowNull: true,
    }
}, {
    sequelize,
    modelName: 'WA_UsersMetadata',
    tableName: 'wa_users_metadata',
    timestamps: false,
});

export default WA_UsersMetadata;
