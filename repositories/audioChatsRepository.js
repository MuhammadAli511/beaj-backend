import AudioChats from '../models/AudioChats.js';

const create = async (userAudio, modelAudio, userSpeechToTextTime, modelFeedbackTime, modelTextToSpeechTime, totalTime, modelPrompt, modelText) => {
    const audioChat = new AudioChats({
        userAudio,
        modelAudio,
        userSpeechToTextTime,
        modelFeedbackTime,
        modelTextToSpeechTime,
        totalTime,
        modelPrompt,
        modelText,
    });
    return await audioChat.save();
};

const getAll = async () => {
    return await AudioChats.findAll();
};

const getById = async (id) => {
    return await AudioChats.findByPk(id);
};


export default {
    create,
    getAll,
    getById,
};