import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class WA_User extends Model { }

WA_User.init({
    phone_number: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    persona: {
        type: DataTypes.STRING,
        allowNull: true
    },
    engagement_type: {
        type: DataTypes.STRING,
        allowNull: true
    },
    level: {
        type: DataTypes.STRING,
        allowNull: true
    },
    week: {
        type: DataTypes.STRING,
        allowNull: true
    },
    day: {
        type: DataTypes.STRING,
        allowNull: true
    },
    lesson_sequence: {
        type: DataTypes.STRING,
        allowNull: true
    },
    activity_type: {
        type: DataTypes.STRING,
        allowNull: true
    },
    lesson_id: {
        type: DataTypes.STRING,
        allowNull: true
    },
    question_number: {
        type: DataTypes.STRING,
        allowNull: true
    },
    last_updated: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    modelName: 'WA_User',
    tableName: 'wa_user',
    timestamps: false,
    indexes: [
        {
            name: 'PK_wa_user',
            unique: true,
            fields: ['phone_number']
        }
    ]
});

export default WA_User;