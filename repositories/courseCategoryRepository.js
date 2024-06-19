import CourseCategory from '../models/CourseCategory.js';

const totalCourseCategoriesRepository = async () => {
    return await CourseCategory.count();
};

const create = async (courseCategoryName, image, categorySequenceNum) => {
    const courseCategory = new CourseCategory({
        CourseCategoryName: courseCategoryName,
        image: image,
        CategorySequenceNum: categorySequenceNum
    });
    return await courseCategory.save();
};

const getAll = async () => {
    return await CourseCategory.findAll({
        order: [
            ['CategorySequenceNum', 'ASC']
        ]
    });
};

const getById = async (id) => {
    return await CourseCategory.findByPk(id);
};

const update = async (id, courseCategoryName, image, categorySequenceNum) => {
    return await CourseCategory.update({
        CourseCategoryName: courseCategoryName,
        image: image,
        CategorySequenceNum: categorySequenceNum
    }, {
        where: {
            CourseCategoryId: id
        }
    });
};

const deleteCourseCategory = async (id) => {
    return await CourseCategory.destroy({
        where: {
            CourseCategoryId: id
        }
    });
};

export default {
    totalCourseCategoriesRepository,
    create,
    getAll,
    getById,
    update,
    deleteCourseCategory
};