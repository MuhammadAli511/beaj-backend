import CourseWeek from '../models/CourseWeek.js';

const create = async (weekNumber, courseId, image, description) => {
    const courseWeek = new CourseWeek({
        weekNumber: weekNumber,
        courseId: courseId,
        image: image,
        description: description
    });
    await courseWeek.save();
    return courseWeek;
};

const getAll = async () => {
    return await CourseWeek.findAll();
};

const getById = async (id) => {
    return await CourseWeek.findByPk(id);
};

const getByCourseId = async (courseId) => {
    return await CourseWeek.findAll({
        where: {
            courseId: courseId
        }
    });
};

const update = async (id, weekNumber, image, description, courseId) => {
    const courseWeek = await CourseWeek.findByPk(id);
    courseWeek.weekNumber = weekNumber;
    courseWeek.image = image;
    courseWeek.description = description;
    courseWeek.courseId = courseId;
    await courseWeek.save();
    return courseWeek;
};

const deleteCourseWeek = async (id) => {
    return await CourseWeek.destroy({
        where: {
            id: id
        }
    });
};

const deleteCourseWeekByCourseId = async (courseId) => {
    return await CourseWeek.destroy({
        where: {
            courseId: courseId
        }
    });
};

export default {
    create,
    getAll,
    getById,
    update,
    deleteCourseWeek,
    deleteCourseWeekByCourseId,
    getByCourseId
};
