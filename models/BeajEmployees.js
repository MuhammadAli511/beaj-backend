import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class BeajEmployees extends Model { }

BeajEmployees.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
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
        allowNull: true,
        validate: {
            isIn: [['employee', 'admin']]
        }
    },
    profile_picture: {
        type: DataTypes.STRING,
        allowNull: true
    },
}, {
    sequelize,
    modelName: 'beajEmployees',
    tableName: 'beaj_employees',
    timestamps: false,
    indexes: [
        {
            unique: true,
            fields: ['email']
        }
    ]
});

export default BeajEmployees;