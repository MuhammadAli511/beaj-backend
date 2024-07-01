import service from '../services/documentFilesService.js';

const createDocumentFilesController = async (req, res, next) => {
    try {
        const { lessonId, language, mediaType } = req.body;
        const file = req.file;
        await service.createDocumentFilesService(file, lessonId, language, mediaType);
        res.status(200).send({ message: "Document File created successfully" });
    } catch (error) {
        error.fileName = 'documentFilesController.js';
        next(error);
    }
};

const getAllDocumentFilesController = async (req, res, next) => {
    try {
        const result = await service.getAllDocumentFilesService();
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'documentFilesController.js';
        next(error);
    }
};

const getDocumentFilesByIdController = async (req, res, next) => {
    try {
        const id = req.params.id;
        const result = await service.getDocumentFilesByIdService(id);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'documentFilesController.js';
        next(error);
    }
};

const updateDocumentFilesController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { lessonId, language, mediaType } = req.body;
        const file = req.file;
        await service.updateDocumentFilesService(id, file, lessonId, language, mediaType);
        res.status(200).send({ message: "Document File updated successfully" });
    } catch (error) {
        error.fileName = 'documentFilesController.js';
        next(error);
    }
};

const deleteDocumentFilesController = async (req, res, next) => {
    try {
        const id = req.params.id;
        await service.deleteDocumentFilesService(id);
        res.status(200).send({ message: "Document File deleted successfully" });
    } catch (error) {
        error.fileName = 'documentFilesController.js';
        next(error);
    }
};

export default {
    createDocumentFilesController,
    getAllDocumentFilesController,
    getDocumentFilesByIdController,
    updateDocumentFilesController,
    deleteDocumentFilesController
};
