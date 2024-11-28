import DocumentFile from '../models/DocumentFile.js';
import Sequelize from 'sequelize';

const create = async (lessonId, language, image, video, audio, mediaType) => {
    try {
        const documentFile = new DocumentFile({
            lessonId: lessonId,
            language: language,
            image: image,
            video: video,
            audio: audio,
            mediaType: mediaType
        });

        await documentFile.save();
        return documentFile;
    } catch (error) {
        error.fileName = 'documentFileRepository.js';
        throw error;
    }
};


const getAll = async () => {
    return await DocumentFile.findAll();
}

const getById = async (id) => {
    return await DocumentFile.findByPk(id);
}

const getByLessonId = async (lessonId) => {
    return await DocumentFile.findAll({
        where: {
            lessonId: lessonId
        }
    });
}

const getByLessonIds = async (lessonIds) => {
    return await DocumentFile.findAll({
        where: {
            lessonId: {
                [Sequelize.Op.in]: lessonIds
            }
        }
    });
}

const update = async (id, lessonId, language, image, video, audio, mediaType) => {
    return await DocumentFile.update({
        lessonId: lessonId,
        language: language,
        image: image,
        video: video,
        audio: audio,
        mediaType: mediaType
    }, {
        where: {
            id: id
        }
    });
}

const deleteDocumentFile = async (id) => {
    return await DocumentFile.destroy({
        where: {
            id: id
        }
    });
}

const deleteByLessonId = async (lessonId) => {
    return await DocumentFile.destroy({
        where: {
            lessonId: lessonId
        }
    });
};

const getDocumentFileByLessonIds = async (lessonIds) => {
    return await DocumentFile.findAll({
        where: {
            lessonId: {
                [Sequelize.Op.in]: lessonIds
            }
        }
    });
};


export default {
    create,
    getAll,
    getById,
    update,
    deleteDocumentFile,
    getByLessonId,
    getByLessonIds,
    deleteByLessonId,
    getDocumentFileByLessonIds
};