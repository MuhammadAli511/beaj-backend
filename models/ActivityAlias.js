import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class ActivityAlias extends Model { }

ActivityAlias.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    Alias: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    sequelize,
    modelName: 'ActivityAlias',
    tableName: 'activityAlias',
    timestamps: false,
    indexes: [
        {
            name: 'PK_activityAlias',
            unique: true,
            fields: ['id']
        },
        {
            name: 'idx_activityalias_alias',
            fields: ['Alias']
        }
    ]
});

export default ActivityAlias;
