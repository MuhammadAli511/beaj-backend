import waPurchasedCoursesRepository from '../repositories/waPurchasedCoursesRepository.js';
import courseRepository from '../repositories/courseRepository.js';

const getPurchasedCoursesByPhoneNumberService = async (phoneNumber) => {
    return await waPurchasedCoursesRepository.getPurchasedCoursesByPhoneNumber(phoneNumber);
};

const getUnpurchasedCoursesByPhoneNumberService = async (phoneNumber) => {
    const purchasedCourses = await waPurchasedCoursesRepository.getPurchasedCoursesByPhoneNumber(phoneNumber);
    const allCourses = await courseRepository.getAll();
    const unpurchasedCourses = allCourses.filter(course => !purchasedCourses.some(purchasedCourse => purchasedCourse.courseId === course.id));
    return unpurchasedCourses;
};

const purchaseCourseService = async (phoneNumber, courseId) => {
    const allCourses = await courseRepository.getAll();
    const course = allCourses.find(course => course.id === courseId);
    if (!course) {
        throw new Error("Course not found");
    }
    const purchasedCourses = await waPurchasedCoursesRepository.getPurchasedCoursesByPhoneNumber(phoneNumber);
    if (purchasedCourses.some(purchasedCourse => purchasedCourse.courseId === courseId)) {
        throw new Error("Course already purchased");
    }
    return await waPurchasedCoursesRepository.create({
        phoneNumber: phoneNumber,
        courseId: courseId,
        courseCategoryId: course.CourseCategoryId,
        courseStartDate: new Date(),
        coursePurchaseDate: new Date()
    });
};

const getCompletedCourseService = async (phoneNumber) => {
    const purchasedCourses = await waPurchasedCoursesRepository.getPurchasedCoursesByPhoneNumber(phoneNumber);
    return purchasedCourses.filter(purchasedCourse => purchasedCourse.courseEndDate !== null);
}


export default {
    getPurchasedCoursesByPhoneNumberService,
    getUnpurchasedCoursesByPhoneNumberService,
    purchaseCourseService,
    getCompletedCourseService
};