import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class WA_Profile extends Model { }

WA_Profile.init({
    profile_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    phone_number: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    bot_phone_number_id: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    profile_type: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            isIn: [['teacher', 'student']]
        }
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    modelName: 'WA_Profile',
    tableName: 'wa_profiles',
    timestamps: false,
});

export default WA_Profile;