import azure_blob from '../utils/azureBlobStorage.js';
import courseCategoryRepository from '../repositories/courseCategoryRepository.js';

const createCourseCategoryService = async (courseCategoryName, image, categorySequenceNum) => {
    try {
        const imageUrl = await azure_blob.uploadToBlobStorage(image);
        const courseCategory = await courseCategoryRepository.create(courseCategoryName, imageUrl, categorySequenceNum);
        return courseCategory;
    } catch (error) {
        error.fileName = 'courseCategoryService.js';
        throw error;
    }
};

const getAllCourseCategoryService = async () => {
    try {
        const courseCategories = await courseCategoryRepository.getAll();
        return courseCategories;
    } catch (error) {
        error.fileName = 'courseCategoryService.js';
        throw error;
    }
};

const getCourseCategoryByIdService = async (id) => {
    try {
        const courseCategory = await courseCategoryRepository.getById(id);
        return courseCategory;
    } catch (error) {
        error.fileName = 'courseCategoryService.js';
        throw error;
    }
};

const updateCourseCategoryService = async (id, courseCategoryName, image, categorySequenceNum) => {
    try {
        const imageUrl = await azure_blob.uploadToBlobStorage(image);
        const courseCategory = await courseCategoryRepository.update(id, courseCategoryName, imageUrl, categorySequenceNum);
        return courseCategory;
    } catch (error) {
        error.fileName = 'courseCategoryService.js';
        throw error;
    }
};

const deleteCourseCategoryService = async (id) => {
    try {
        await courseCategoryRepository.deleteCourseCategory(id);
    } catch (error) {
        error.fileName = 'courseCategoryService.js';
        throw error;
    }
};

export default {
    createCourseCategoryService,
    getAllCourseCategoryService,
    getCourseCategoryByIdService,
    updateCourseCategoryService,
    deleteCourseCategoryService
};
