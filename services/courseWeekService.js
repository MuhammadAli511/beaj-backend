import courseWeekRepository from "../repositories/courseWeekRepository.js";

const createCourseWeekService = async (weekNumber, courseId) => {
    await courseWeekRepository.create(weekNumber, courseId);
};

const getAllCourseWeekService = async () => {
    const courseWeeks = await courseWeekRepository.getAll();
    return courseWeeks;
};

const getCourseWeekByIdService = async (id) => {
    const courseWeek = await courseWeekRepository.getById(id);
    return courseWeek;
};

const updateCourseWeekService = async (id, weekNumber, image, description, courseId) => {
    await courseWeekRepository.update(id, weekNumber, image, description, courseId);
};

const deleteCourseWeekService = async (id) => {
    await courseWeekRepository.deleteCourseWeek(id);
};

export default {
    createCourseWeekService,
    getAllCourseWeekService,
    getCourseWeekByIdService,
    updateCourseWeekService,
    deleteCourseWeekService
};