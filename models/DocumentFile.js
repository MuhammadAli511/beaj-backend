import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

class DocumentFile extends Model { }

DocumentFile.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  lessonId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Lesson',
      key: 'LessonId'
    },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  },
  language: {
    type: DataTypes.STRING,
    allowNull: false
  },
  video: {
    type: DataTypes.STRING,
    allowNull: true
  },
  videoMediaId: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  audio: {
    type: DataTypes.STRING,
    allowNull: true
  },
  audioMediaId: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  image: {
    type: DataTypes.STRING,
    allowNull: true
  },
  imageMediaId: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  mediaType: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'DocumentFile',
  tableName: 'DocumentFiles',
  timestamps: false,
  indexes: [
    {
      name: 'DocumentFiles_lessonId',
      fields: ['lessonId']
    }
  ]
});

export default DocumentFile;