import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class InternalUsers extends Model { }

InternalUsers.init({
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    first_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    last_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    date_registered: {
        type: DataTypes.STRING,
        allowNull: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: true
    },
    role: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'InternalUsers',
    timestamps: false,
    indexes: [
        {
            unique: true,
            fields: ['email']
        }
    ]
});

export default InternalUsers;