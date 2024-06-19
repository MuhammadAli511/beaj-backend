import courseRepository from "../repositories/courseRepository.js";

const createCourseService = async (courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription) => {
    await courseRepository.create(courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription);
};

const getAllCourseService = async () => {
    const courses = await courseRepository.getAll();
    return courses;
};

const getCourseByIdService = async (id) => {
    const course = await courseRepository.getById(id);
    return course;
};

const updateCourseService = async (id, courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription) => {
    await courseRepository.update(id, courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription);
};

const deleteCourseService = async (id) => {
    await courseRepository.deleteCourse(id);
};

export default {
    createCourseService,
    getAllCourseService,
    getCourseByIdService,
    updateCourseService,
    deleteCourseService
};