import courseWeekRepository from "../repositories/courseWeekRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import azure_blob from "../utils/azureBlobStorage.js";

const createCourseWeekService = async (weekNumber, courseId, image, description) => {
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