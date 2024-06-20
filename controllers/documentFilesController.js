import service from '../services/documentFilesService.js';


const createDocumentFilesController = async (req, res) => {
    try {
        const file = req.files.file[0];
        const lessonId = req.body.lessonId;
        const language = req.body.language;
        const mediaType = req.body.mediaType;
        await service.createDocumentFilesService(file, lessonId, language, mediaType);
        res.status(200).send({ message: "Document File created successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getAllDocumentFilesController = async (req, res) => {
    try {
        const result = await service.getAllDocumentFilesService();
        res.status(200).send(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getDocumentFilesByIdController = async (req, res) => {
    try {
        const id = req.params.id;
        const result = await service.getDocumentFilesByIdService(id);
        res.status(200).send(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const updateDocumentFilesController = async (req, res) => {
    try {
        const id = req.params.id;
        const lessonId = req.body.lessonId;
        const language = req.body.language;
        const mediaType = req.body.mediaType;
        const file = req.files.file[0];
        await service.updateDocumentFilesService(id, file, lessonId, language, mediaType);
        res.status(200).send({ message: "Document File updated successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteDocumentFilesController = async (req, res) => {
    try {
        const id = req.params.id;
        await service.deleteDocumentFilesService(id);
        res.status(200).send({ message: "Document File deleted successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};



export default {
    createDocumentFilesController,
    getAllDocumentFilesController,
    getDocumentFilesByIdController,
    updateDocumentFilesController,
    deleteDocumentFilesController
};