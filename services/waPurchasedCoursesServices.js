import waPurchasedCoursesRepository from "../repositories/waPurchasedCoursesRepository";
import courseRepository from "../repositories/courseRepository";

const getAllWaPurchasedCoursesServiceByPhoneNumber = async (phoneNumber) => {
    const courses = await waPurchasedCoursesRepository.getAllByPhoneNumber(phoneNumber);
};

const getUnpurchasedCourses = async (phoneNumber) => {
    const purchasedCourses = await waPurchasedCoursesRepository.getAllByPhoneNumber(phoneNumber);
    const allCourses = await courseRepository.getAll();
    return allCourses.filter(course => {
        return !purchasedCourses.some(purchasedCourse => purchasedCourse.courseId === course.id);
    });
};

const purchaseCourse = async (phoneNumber, courseId) => {
    const course = await courseRepository.getById(courseId);
    const purchasedCourse = {
        phoneNumber: phoneNumber,
        courseId: courseId,
        courseCategoryId: course.courseCategoryId,
        purchaseDate: new Date(),
    };
    return await waPurchasedCoursesRepository.create(purchasedCourse);
};

const deletePurchasedCourse = async (id) => {
    return await waPurchasedCoursesRepository.deleteById(id);
};

export default {
    getAllWaPurchasedCoursesServiceByPhoneNumber,
    getUnpurchasedCourses,
    purchaseCourse,
    deletePurchasedCourse
};