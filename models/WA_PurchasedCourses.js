import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class WA_PurchasedCourses extends Model { }

WA_PurchasedCourses.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    phoneNumber: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    courseCategoryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    courseId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    courseStartDate: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    courseEndDate: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    purchaseDate: {
        type: DataTypes.DATE,
        allowNull: true,
    }
}, {
    sequelize,
    modelName: 'WA_PurchasedCourses',
    tableName: 'wa_purchased_courses',
    timestamps: false,
});

export default WA_PurchasedCourses;
