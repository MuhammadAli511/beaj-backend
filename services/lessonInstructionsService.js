import lessonInstructionsRepository from '../repositories/lessonInstructionsRepository.js';
import azure_blob from '../utils/azureBlobStorage.js';

const createLessonInstructionService = async (lessonId, instructionType, position, file, mediaId) => {
    try {
        let url = null;
        if (file) {
            url = await azure_blob.uploadToBlobStorage(file);
        }

        const instruction = await lessonInstructionsRepository.create(lessonId, instructionType, position, url, mediaId);
        return instruction;
    } catch (error) {
        console.error('Error creating lesson instruction:', error);
        throw error;
    }
};

const getLessonInstructionsService = async (lessonId) => {
    try {
        return await lessonInstructionsRepository.getByLessonId(lessonId);
    } catch (error) {
        console.error('Error getting lesson instructions:', error);
        throw error;
    }
};

const getLessonInstructionService = async (lessonId, instructionType, position) => {
    try {
        return await lessonInstructionsRepository.getByLessonIdAndType(lessonId, instructionType, position);
    } catch (error) {
        console.error('Error getting lesson instruction:', error);
        throw error;
    }
};

const updateLessonInstructionService = async (id, lessonId, instructionType, position, file, mediaId) => {
    let url = null;
    if (file) {
        url = await azure_blob.uploadToBlobStorage(file);
    }
    try {
        const instruction = await lessonInstructionsRepository.update(id, lessonId, instructionType, position, file, mediaId);
        return instruction;
    } catch (error) {
        console.error('Error updating lesson instruction:', error);
        throw error;
    }
};

const deleteLessonInstructionService = async (id) => {
    try {
        return await lessonInstructionsRepository.deleteById(id);
    } catch (error) {
        console.error('Error deleting lesson instruction:', error);
        throw error;
    }
};

const deleteLessonInstructionsByLessonIdService = async (lessonId) => {
    try {
        return await lessonInstructionsRepository.deleteByLessonId(lessonId);
    } catch (error) {
        console.error('Error deleting lesson instructions:', error);
        throw error;
    }
};

export default {
    createLessonInstructionService,
    getLessonInstructionsService,
    getLessonInstructionService,
    updateLessonInstructionService,
    deleteLessonInstructionService,
    deleteLessonInstructionsByLessonIdService
};