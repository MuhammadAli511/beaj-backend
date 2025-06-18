
import waPurchasedCoursesRepository from '../repositories/waPurchasedCoursesRepository.js';
import courseRepository from '../repositories/courseRepository.js';

const getAllCoursesByPhoneNumberService = async (phoneNumber) => {
    const allCourses = await courseRepository.getAll();
    const purchasedCourses = await waPurchasedCoursesRepository.getPurchasedCoursesByPhoneNumber(phoneNumber);
    const courses = allCourses.map(course => {
        const purchasedCourse = purchasedCourses.find(purchasedCourse => purchasedCourse.courseId === course.CourseId);
        let userStatus;
        let profile_id = null;
        if (purchasedCourse) {
            if (purchasedCourse.courseEndDate) {
                userStatus = "completed";
                profile_id = purchasedCourse.profile_id;
            } else {
                userStatus = "purchased";
                profile_id = purchasedCourse.profile_id;
            }
        } else {
            userStatus = "unpurchased";
        }
        return {
            ...course.dataValues,
            user_status: userStatus,
            profile_id: profile_id
        };
    });
    return courses;
};

const getPurchasedCoursesByPhoneNumberService = async (phoneNumber) => {
    const purchasedCourses = await waPurchasedCoursesRepository.getPurchasedCoursesByPhoneNumber(phoneNumber);
    const allCourses = await courseRepository.getAll();
    const courses = allCourses.map(course => {
        const purchasedCourse = purchasedCourses.find(purchasedCourse => purchasedCourse.courseId === course.CourseId);
        let userStatus;
        let profile_id = null;
        if (purchasedCourse) {
            if (purchasedCourse.courseEndDate) {
                userStatus = "completed";
                profile_id = purchasedCourse.profile_id;
            } else {
                userStatus = "purchased";
                profile_id = purchasedCourse.profile_id;
            }
        } else {
            userStatus = "unpurchased";
        }
        return {
            ...course.dataValues,
            user_status: userStatus,
            profile_id: profile_id,
        };
    });
    return courses.filter(course => course.user_status !== "unpurchased");
};

const getUnpurchasedCoursesByPhoneNumberService = async (phoneNumber) => {
    const purchasedCourses = await waPurchasedCoursesRepository.getPurchasedCoursesByPhoneNumber(phoneNumber);
    const allCourses = await courseRepository.getAll();
    const courses = allCourses.map(course => {
        const purchasedCourse = purchasedCourses.find(purchasedCourse => purchasedCourse.courseId === course.CourseId);
        let userStatus = "unpurchased";
        if (purchasedCourse) {
            if (purchasedCourse.courseEndDate) {
                userStatus = "completed";
            } else {
                userStatus = "purchased";
            }
        }
        return {
            ...course.dataValues,
            user_status: userStatus
        };
    });
    return courses.filter(course => course.user_status === "unpurchased");
};

const purchaseCourseService = async (phoneNumber,courseId, profile_id) => {
    console.log("purchaseCourseService called with phoneNumber:", phoneNumber, "profile_id:", profile_id, "courseId:", courseId);
    const allCourses = await courseRepository.getAll();
    const course = allCourses.find(course => course.CourseId == courseId);
    if (!course) {
        throw new Error("Course not found");
    }
    const purchasedCourses = await waPurchasedCoursesRepository.getPurchasedCoursesByPhoneNumber(phoneNumber, profile_id);
    if (purchasedCourses.some(purchasedCourse => purchasedCourse.courseId == courseId)) {
        throw new Error("Course already purchased");
    }
    return await waPurchasedCoursesRepository.create({
        phoneNumber: phoneNumber,
        courseId: courseId,
        courseCategoryId: course.CourseCategoryId,
        courseStartDate: new Date(),
        purchaseDate: new Date(),
        profile_id: profile_id,
    });
};

const getCompletedCourseService = async (phoneNumber) => {
    const purchasedCourses = await waPurchasedCoursesRepository.getPurchasedCoursesByPhoneNumber(phoneNumber);
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
    return courses.filter(course => course.user_status === "completed");
};

const updatePaymentStatusByProfileIdService = async (profileId, paymentStatus) => {
    return await waPurchasedCoursesRepository.updatePaymentStatusByProfileId(profileId, paymentStatus);
};

const getPurchasedCourseByPaymentStatusService = async (paymentStatus) => {
    return await waPurchasedCoursesRepository.getPurchasedCourseByPaymentStatus(paymentStatus);
};


export default {
    getPurchasedCoursesByPhoneNumberService,
    getUnpurchasedCoursesByPhoneNumberService,
    purchaseCourseService,
    getCompletedCourseService,
    getAllCoursesByPhoneNumberService,
    updatePaymentStatusByProfileIdService,
    getPurchasedCourseByPaymentStatusService
};
