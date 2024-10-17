import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class WA_UsersMetadata extends Model { }

WA_UsersMetadata.init({
    phoneNumber: {
        type: DataTypes.TEXT,
        primaryKey: true,
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
    }
}, {
    sequelize,
    modelName: 'WA_UsersMetadata',
    tableName: 'wa_users_metadata',
    timestamps: false,
});

export default WA_UsersMetadata;
