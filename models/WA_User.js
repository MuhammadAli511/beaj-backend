import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class WA_User extends Model { }

WA_User.init({
    phone_number: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    state: {
        type: DataTypes.STRING,
        allowNull: false
    },
    persona: {
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