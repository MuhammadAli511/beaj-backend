import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class WA_ActiveSession extends Model { }

WA_ActiveSession.init({
    phone_number: {
        type: DataTypes.TEXT,
        primaryKey: true,
    },
    bot_phone_number_id: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    profile_id: {
        type: DataTypes.INTEGER,
    },
    last_updated: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    modelName: 'WA_ActiveSession',
    tableName: 'wa_active_sessions',
    timestamps: false,
});

export default WA_ActiveSession;