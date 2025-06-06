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
    type: DataTypes.TEXT,
    allowNull: false
  },
  video: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  videoMediaId: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  audio: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  audioMediaId: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  image: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  imageMediaId: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  mediaType: {
    type: DataTypes.TEXT,
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