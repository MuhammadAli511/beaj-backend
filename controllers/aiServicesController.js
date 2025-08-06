import service from '../services/aiServicesService.js';

const speechToTextController = async (req, res, next) => {
    try {
        const { language, provider } = req.body;
        const audioFile = req.file;

        if (!audioFile) {
            return res.status(400).json({ error: 'Audio file is required' });
        }

        const result = await service.speechToTextService(audioFile, language, provider);
        res.status(200).json(result);
    } catch (error) {
        error.fileName = 'aiServicesController.js';
        next(error);
    }
};

export default {
    speechToTextController,
};