import courseRepository from "../repositories/courseRepository.js";
import courseWeekRepository from "../repositories/courseWeekRepository.js";

const createCourseService = async (courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription, courseStartDate) => {
    try {
        const course = await courseRepository.create(courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription, courseStartDate);
        for (let i = 1; i <= parseInt(courseWeeks); i++) {
            await courseWeekRepository.create(i, course.CourseId, null, null);
        }
    } catch (error) {
        error.fileName = 'courseService.js';
        throw error;
    }
};

const getAllCourseService = async () => {
    try {
        const courses = await courseRepository.getAll();
        return courses;
    } catch (error) {
        error.fileName = 'courseService.js';
        throw error;
    }
};

const getCourseByIdService = async (id) => {
    try {
        const course = await courseRepository.getById(id);
        return course;
    } catch (error) {
        error.fileName = 'courseService.js';
        throw error;
    }
};

const updateCourseService = async (id, courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription, courseStartDate) => {
    try {
        await courseRepository.update(id, courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription, courseStartDate);
    } catch (error) {
        error.fileName = 'courseService.js';
        throw error;
    }
};

const deleteCourseService = async (id) => {
    try {
        await courseRepository.deleteCourse(id);
        await courseWeekRepository.deleteCourseWeekByCourseId(id);
    } catch (error) {
        error.fileName = 'courseService.js';
        throw error;
    }
};

const getCourseByCourseCategoryIdService = async (id) => {
    try {
        const courses = await courseRepository.getByCourseCategoryId(id);
        return courses;
    } catch (error) {
        error.fileName = 'courseService.js';
        throw error;
    }
};

export default {
    createCourseService,
    getAllCourseService,
    getCourseByIdService,
    updateCourseService,
    deleteCourseService,
    getCourseByCourseCategoryIdService
};
