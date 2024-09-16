import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class WA_Constants extends Model { }

WA_Constants.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    key: {
        type: DataTypes.TEXT,
        unique: true,
        allowNull: false,
    },
    constantValue: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    category: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'createdAt',
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'updatedAt',
    }
}, {
    sequelize,
    modelName: 'WA_Constants',
    tableName: 'wa_constants',
    timestamps: false,
    hooks: {
        beforeUpdate: (constant) => {
            constant.updatedAt = new Date();
        },
    },
});

export default WA_Constants;
