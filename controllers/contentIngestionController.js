import service from '../services/contentIngestionService.js';


const validateIngestionController = async (req, res, next) => {
    try {
        const { sheetId, sheetTitle } = req.body;
        const result = await service.validateIngestionService(sheetId, sheetTitle);
        res.status(200).send({ message: "Ingestion validated successfully", result });
    } catch (error) {
        error.fileName = 'contentIngestionController.js';
        next(error);
    }
};

const processIngestionController = async (req, res, next) => {
    try {
        const { courseId, sheetId, sheetTitle } = req.body;
        const result = await service.processIngestionService(courseId, sheetId, sheetTitle);
        res.status(200).send({ message: "Ingestion processed successfully", result });
    } catch (error) {
        error.fileName = 'contentIngestionController.js';
        next(error);
    }
};


export default {
    validateIngestionController,
    processIngestionController,
};
