import courseWeekRepository from '../repositories/courseWeekRepository.js';
import courseRepository from '../repositories/courseRepository.js';
import azure_blob from '../utils/azureBlobStorage.js';

const createCourseWeekService = async (weekNumber, courseId, image, description) => {
    try {
        const weekData = await courseWeekRepository.getByCourseId(courseId);
        for (let i = 0; i < weekData.length; i++) {
            if (weekData[i].weekNumber == weekNumber) {
                throw new Error("Week number already exists in the course");
            }
        }
        const imageUrl = await azure_blob.uploadToBlobStorage(image);
        await courseRepository.addOneInCourseWeeks(courseId);
        const courseWeek = await courseWeekRepository.create(weekNumber, courseId, imageUrl, description);
        return courseWeek;
    } catch (error) {
        error.fileName = 'courseWeekService.js';
        throw error;
    }
};

const getAllCourseWeekService = async () => {
    try {
        const courseWeeks = await courseWeekRepository.getAll();
        return courseWeeks;
    } catch (error) {
        error.fileName = 'courseWeekService.js';
        throw error;
    }
};

const getCourseWeekByIdService = async (id) => {
    try {
        const courseWeek = await courseWeekRepository.getById(id);
        return courseWeek;
    } catch (error) {
        error.fileName = 'courseWeekService.js';
        throw error;
    }
};

const updateCourseWeekService = async (id, weekNumber, image, description, courseId) => {
    try {
        const imageUrl = await azure_blob.uploadToBlobStorage(image);
        const courseWeek = await courseWeekRepository.update(id, weekNumber, imageUrl, description, courseId);
        return courseWeek;
    } catch (error) {
        error.fileName = 'courseWeekService.js';
        throw error;
    }
};

const deleteCourseWeekService = async (id) => {
    try {
        const courseWeek = await courseWeekRepository.getById(id);
        await courseWeekRepository.deleteCourseWeek(id);
        await courseRepository.deleteOneInCourseWeeks(courseWeek.courseId);
    } catch (error) {
        error.fileName = 'courseWeekService.js';
        throw error;
    }
};

export default {
    createCourseWeekService,
    getAllCourseWeekService,
    getCourseWeekByIdService,
    updateCourseWeekService,
    deleteCourseWeekService
};
