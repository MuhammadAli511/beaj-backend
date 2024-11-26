import { Model, DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";

class WA_UserActivityLogs extends Model { }

WA_UserActivityLogs.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    phoneNumber: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    actionType: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    messageDirection: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    messageContent: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: true,
    },
    courseId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    lessonId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    weekNumber: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    dayNumber: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    questionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    activityType: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    retryCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: true,
    },
    isCorrect: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: true,
    },
    systemGenerated: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "WA_UserActivityLogs",
    tableName: "wa_user_activity_logs",
    timestamps: false,
  }
);

export default WA_UserActivityLogs;
