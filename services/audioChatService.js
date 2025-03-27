import azure_blob from "../utils/azureBlobStorage.js";
import { performance } from 'perf_hooks';
import audioChatRepository from '../repositories/audioChatsRepository.js';
import azureAIServices from "../utils/azureAIServices.js";

const createAudioChatService = async (prompt, userAudioFile) => {
    try {
        let startTime, endTime, userSpeechToTextTime, modelFeedbackTime, modelTextToSpeechTime, finalStartTime, finalEndTime, totalTime;

        // OpenAI Speech to Text
        finalStartTime = performance.now();
        const userFileUrl = await azure_blob.uploadToBlobStorage(userAudioFile);
        startTime = performance.now();
        const audioBuffer = userAudioFile.buffer;
        const transcription = await azureAIServices.openaiSpeechToText(audioBuffer);
        endTime = performance.now();
        userSpeechToTextTime = (endTime - startTime).toFixed(2) / 1000;


        // OpenAI Feedback
        startTime = performance.now();
        const model_response = await azureAIServices.openaiCustomFeedback(transcription, prompt);
        endTime = performance.now();
        modelFeedbackTime = (endTime - startTime).toFixed(2) / 1000;


        // Text to Speech
        startTime = performance.now();
        const audioFileUrl = await azureAIServices.openaiTextToSpeechAndUpload(model_response);
        endTime = performance.now();
        modelTextToSpeechTime = (endTime - startTime).toFixed(2) / 1000;

        finalEndTime = performance.now();
        totalTime = (finalEndTime - finalStartTime).toFixed(2) / 1000;
        audioChatRepository.create(userFileUrl, transcription, audioFileUrl, userSpeechToTextTime, modelFeedbackTime, modelTextToSpeechTime, totalTime, prompt, model_response);
        if (audioFileUrl) {
            return "Feedback successfully submitted";
        } else {
            return "Failed to submit feedback";
        }
    } catch (error) {
        console.log('Error in audioChatService', error);
        throw error;
    }
};

const getAllAudioChatService = async () => {
    const feedback = await audioChatRepository.getAll();
    return feedback;
};

export default { createAudioChatService, getAllAudioChatService };