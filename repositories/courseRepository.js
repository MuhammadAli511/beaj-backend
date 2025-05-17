import Course from '../models/Course.js';
import Sequelize from 'sequelize';

const totalCoursesRepository = async () => {
    return await Course.count();
}

const create = async (courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription, courseStartDate) => {
    const course = new Course({
        CourseName: courseName,
        CoursePrice: coursePrice,
        CourseWeeks: courseWeeks,
        CourseCategoryId: courseCategoryId,
        status: status,
        SequenceNumber: sequenceNumber,
        CourseDescription: courseDescription,
        courseStartDate: new Date(courseStartDate).setHours(13)
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

const update = async (id, courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription, courseStartDate) => {
    return await Course.update({
        CourseName: courseName,
        CoursePrice: coursePrice,
        CourseWeeks: courseWeeks,
        CourseCategoryId: courseCategoryId,
        status: status,
        SequenceNumber: sequenceNumber,
        CourseDescription: courseDescription,
        courseStartDate: new Date(courseStartDate).setHours(13)
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

const getCourseIdByName = async (courseName) => {
    const course = await Course.findOne({
        where: {
            CourseName: courseName
        }
    });
    return course.CourseId;
};

const getCourseCategoryIdByName = async (courseName) => {
    const course = await Course.findOne({
        where: {
            CourseName: courseName
        }
    });
    return course.CourseCategoryId;
};

const getCourseNameById = async (courseId) => {
    const course = await Course.findByPk(courseId);
    return course.CourseName;
};

const getCourseByCourseName = async (courseName) => {
    const course = await Course.findOne({
        where: {
            CourseName: courseName
        }
    });
    return course;
};

const getByCourseIds = async (courseIds) => {
    return await Course.findAll({
        where: {
            CourseId: {
                [Sequelize.Op.in]: courseIds
            }
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
    deleteByCourseCategoryId,
    getCourseIdByName,
    getCourseNameById,
    getCourseByCourseName,
    getByCourseIds,
    getCourseCategoryIdByName
};