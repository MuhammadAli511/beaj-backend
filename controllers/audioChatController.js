import service from '../services/audioChatService.js'

const analyzeAudioChatController = async (req, res) => {
    try {
        const audioChat = req.file;

        const response = await service.analyzeAudioChatService(audioChat);
        res.status(200).send({ message: response });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};


export default {
    analyzeAudioChatController
};