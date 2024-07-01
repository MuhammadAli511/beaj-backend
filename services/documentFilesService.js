import azure_blob from '../utils/azureBlobStorage.js';
import documentFileRepository from '../repositories/documentFileRepository.js';

const createDocumentFilesService = async (file, lessonId, language, mediaType) => {
    try {
        const blob_url = await azure_blob.uploadToBlobStorage(file);
        if (mediaType == "video") {
            const documentFile = await documentFileRepository.create(lessonId, language, null, blob_url, null, mediaType);
            return documentFile;
        }
        if (mediaType == "audio") {
            const documentFile = await documentFileRepository.create(lessonId, language, null, null, blob_url, mediaType);
            return documentFile;
        }
        if (mediaType == "image") {
            const documentFile = await documentFileRepository.create(lessonId, language, blob_url, null, null, mediaType);
            return documentFile;
        }
    } catch (error) {
        error.fileName = 'documentFilesService.js';
        throw error;
    }
};

const getAllDocumentFilesService = async () => {
    try {
        const documentFiles = await documentFileRepository.getAll();
        return documentFiles;
    } catch (error) {
        error.fileName = 'documentFilesService.js';
        throw error;
    }
};

const getDocumentFilesByIdService = async (id) => {
    try {
        const documentFile = await documentFileRepository.getById(id);
        return documentFile;
    } catch (error) {
        error.fileName = 'documentFilesService.js';
        throw error;
    }
};

const updateDocumentFilesService = async (id, file, lessonId, language, mediaType) => {
    try {
        const blob_url = await azure_blob.uploadToBlobStorage(file);
        if (mediaType == "video") {
            const documentFile = await documentFileRepository.update(id, lessonId, language, null, blob_url, null, mediaType);
            return documentFile;
        }
        if (mediaType == "audio") {
            const documentFile = await documentFileRepository.update(id, lessonId, language, null, null, blob_url, mediaType);
            return documentFile;
        }
        if (mediaType == "image") {
            const documentFile = await documentFileRepository.update(id, lessonId, language, blob_url, null, null, mediaType);
            return documentFile;
        }
    } catch (error) {
        error.fileName = 'documentFilesService.js';
        throw error;
    }
};

const deleteDocumentFilesService = async (id) => {
    try {
        await documentFileRepository.deleteDocumentFile(id);
    } catch (error) {
        error.fileName = 'documentFilesService.js';
        throw error;
    }
};

export default {
    createDocumentFilesService,
    getAllDocumentFilesService,
    getDocumentFilesByIdService,
    updateDocumentFilesService,
    deleteDocumentFilesService
};
