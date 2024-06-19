import azure_blob from "../utils/azureBlobStorage.js";
import courseCategoryRepository from "../repositories/courseCategoryRepository.js";

const createCourseCategoryService = async (courseCategoryName, image, categorySequenceNum) => {
    const imageUrl = await azure_blob.uploadToBlobStorage(image);
    const courseCategory = await courseCategoryRepository.create(courseCategoryName, imageUrl, categorySequenceNum);
    return courseCategory;
}

const getAllCourseCategoryService = async () => {
    const courseCategories = await courseCategoryRepository.getAll();
    return courseCategories;
}

const getCourseCategoryByIdService = async (id) => {
    const courseCategory = await courseCategoryRepository.getById(id);
    return courseCategory;
}

const updateCourseCategoryService = async (id, courseCategoryName, image, categorySequenceNum) => {
    const imageUrl = await azure_blob.uploadToBlobStorage(image);
    const courseCategory = await courseCategoryRepository.update(id, courseCategoryName, imageUrl, categorySequenceNum);
    return courseCategory;
}

const deleteCourseCategoryService = async (id) => {
    await courseCategoryRepository.deleteCourseCategory(id);
}

export default {
    createCourseCategoryService,
    getAllCourseCategoryService,
    getCourseCategoryByIdService,
    updateCourseCategoryService,
    deleteCourseCategoryService
};
