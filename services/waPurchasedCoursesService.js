import waPurchasedCoursesRepository from '../repositories/waPurchasedCoursesRepository.js';
import courseRepository from '../repositories/courseRepository.js';

const getAllCoursesByProfileIdService = async (profileId) => {
    const allCourses = await courseRepository.getAll();
    const purchasedCourses = await waPurchasedCoursesRepository.getPurchasedCoursesByProfileId(profileId);
    const courses = allCourses.map(course => {
        const purchasedCourse = purchasedCourses.find(purchasedCourse => purchasedCourse.courseId === course.CourseId);
        let userStatus;
        if (purchasedCourse) {
            if (purchasedCourse.courseEndDate) {
                userStatus = "completed";
            } else {
                userStatus = "purchased";
            }
        } else {
            userStatus = "unpurchased";
        }
        return {
            ...course.dataValues,
            user_status: userStatus
        };
    });
    return courses;
};

const getPurchasedCoursesByProfileIdService = async (profileId) => {
    const purchasedCourses = await waPurchasedCoursesRepository.getPurchasedCoursesByProfileId(profileId);
    const allCourses = await courseRepository.getAll();
    const courses = allCourses.map(course => {
        const purchasedCourse = purchasedCourses.find(purchasedCourse => purchasedCourse.courseId === course.CourseId);
        let userStatus;
        if (purchasedCourse) {
            if (purchasedCourse.courseEndDate) {
                userStatus = "completed";
            } else {
                userStatus = "purchased";
            }
        } else {
            userStatus = "unpurchased";
        }
        return {
            ...course.dataValues,
            user_status: userStatus
        };
    });
    return courses.filter(course => course.user_status !== "unpurchased");
};

const getUnpurchasedCoursesByProfileIdService = async (profileId) => {
    const purchasedCourses = await waPurchasedCoursesRepository.getPurchasedCoursesByProfileId(profileId);
    const allCourses = await courseRepository.getAll();
    const courses = allCourses.map(course => {
        const purchasedCourse = purchasedCourses.find(purchasedCourse => purchasedCourse.courseId === course.CourseId);
        const userStatus = purchasedCourse ? purchasedCourse.courseEndDate ? "completed" : "purchased" : "unpurchased";
        return {
            ...course.dataValues,
            user_status: userStatus
        };
    });
    return courses.filter(course => course.user_status === "unpurchased");
};

const purchaseCourseService = async (phoneNumber,profileId, courseId) => {
    const allCourses = await courseRepository.getAll();
    const course = allCourses.find(course => course.CourseId == courseId);
    if (!course) {
        throw new Error("Course not found");
    }
    const purchasedCourses = await waPurchasedCoursesRepository.getPurchasedCoursesByProfileId(profileId);
    if (purchasedCourses.some(purchasedCourse => purchasedCourse.courseId == courseId)) {
        throw new Error("Course already purchased");
    }
    return await waPurchasedCoursesRepository.create({
        phoneNumber: phoneNumber,
        profile_id: profileId,
        courseId: courseId,
        courseCategoryId: course.CourseCategoryId,
        courseStartDate: new Date(),
        purchaseDate: new Date(),
    });
};

const getCompletedCourseService = async (profileId) => {
    const purchasedCourses = await waPurchasedCoursesRepository.getPurchasedCoursesByProfileId(profileId);
    const allCourses = await courseRepository.getAll();
    const courses = allCourses.map(course => {
        const purchasedCourse = purchasedCourses.find(purchasedCourse => purchasedCourse.courseId === course.CourseId);
        const userStatus = purchasedCourse ? purchasedCourse.courseEndDate ? "completed" : "purchased" : "unpurchased";
        return {
            ...course.dataValues,
            user_status: userStatus
        };
    });
    return courses.filter(course => course.user_status === "completed");
};


export default {
    getPurchasedCoursesByProfileIdService,
    getUnpurchasedCoursesByProfileIdService,
    purchaseCourseService,
    getCompletedCourseService,
    getAllCoursesByProfileIdService
};