import Course from '../models/Course.js';

const totalCoursesRepository = async () => {
    return await Course.count();
}

const create = async (courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription) => {
    const course = new Course({
        CourseName: courseName,
        CoursePrice: coursePrice,
        CourseWeeks: courseWeeks,
        CourseCategoryId: courseCategoryId,
        status: status,
        SequenceNumber: sequenceNumber,
        CourseDescription: courseDescription
    });
    return await course.save();
};

const getAll = async () => {
    return await Course.findAll({
        order: [
            ['SequenceNumber', 'ASC']
        ]
    });
};

const getById = async (id) => {
    return await Course.findByPk(id);
};

const addOneInCourseWeeks = async (courseId) => {
    const course = await Course.findByPk(courseId);
    course.CourseWeeks++;
    return await course.save();
};

const deleteOneInCourseWeeks = async (courseId) => {
    const course = await Course.findByPk(courseId);
    course.CourseWeeks--;
    return await course.save();
};

const update = async (id, courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription) => {
    return await Course.update({
        CourseName: courseName,
        CoursePrice: coursePrice,
        CourseWeeks: courseWeeks,
        CourseCategoryId: courseCategoryId,
        status: status,
        SequenceNumber: sequenceNumber,
        CourseDescription: courseDescription
    }, {
        where: {
            CourseId: id
        }
    });
};

const deleteCourse = async (id) => {
    return await Course.destroy({
        where: {
            CourseId: id
        }
    });
};

const getByCourseCategoryId = async (courseCategoryId) => {
    return await Course.findAll({
        where: {
            CourseCategoryId: courseCategoryId
        }
    });
};

const deleteByCourseCategoryId = async (courseCategoryId) => {
    return await Course.destroy({
        where: {
            CourseCategoryId: courseCategoryId
        }
    });
};

export default {
    totalCoursesRepository,
    create,
    getAll,
    getById,
    update,
    deleteCourse,
    addOneInCourseWeeks,
    deleteOneInCourseWeeks,
    getByCourseCategoryId,
    deleteByCourseCategoryId
};