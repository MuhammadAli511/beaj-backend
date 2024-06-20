import azure_blob from "../utils/azureBlobStorage.js";
import documentFileRepository from "../repositories/documentFileRepository.js";


const createDocumentFilesService = async (file, lessonId, language, mediaType) => {
    const blob_url = await azure_blob.uploadBlob(file);
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
};

const getAllDocumentFilesService = async () => {
    const documentFiles = await documentFileRepository.getAll();
    return documentFiles;
};

const getDocumentFilesByIdService = async (id) => {
    const documentFile = await documentFileRepository.getById(id);
    return documentFile;
};

const updateDocumentFilesService = async (id, file, lessonId, language, mediaType) => {
    const blob_url = await azure_blob.uploadBlob(file);
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
};

const deleteDocumentFilesService = async (id) => {
    await documentFileRepository.deleteDocumentFile(id);
};

export default {
    createDocumentFilesService,
    getAllDocumentFilesService,
    getDocumentFilesByIdService,
    updateDocumentFilesService,
    deleteDocumentFilesService
};