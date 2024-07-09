import DocumentFile from '../models/DocumentFile.js';

const create = async (lessonId, language, image, video, audio, mediaType) => {
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


export default {
    create,
    getAll,
    getById,
    update,
    deleteDocumentFile,
    getByLessonId
};