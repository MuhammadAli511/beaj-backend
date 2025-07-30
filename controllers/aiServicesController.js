import service from '../services/aiServicesService.js';

const speechToTextController = async (req, res, next) => {
    try {
        const { language } = req.body;
        const audioFile = req.file;
        
        if (!audioFile) {
            return res.status(400).json({ error: 'Audio file is required' });
        }
        
        if (!language || !['en', 'ur'].includes(language)) {
            return res.status(400).json({ error: 'Language must be either "en" or "ur"' });
        }
        
        const result = await service.speechToTextService(audioFile, language);
        res.status(200).json(result);
    } catch (error) {
        error.fileName = 'aiServicesController.js';
        next(error);
    }
};

export default {
    speechToTextController,
};