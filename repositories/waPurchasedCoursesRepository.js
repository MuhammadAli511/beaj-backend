import WA_PurchasedCourses from '../models/WA_PurchasedCourses.js';

const create = async (data) => {
    const purchasedCourse = new WA_PurchasedCourses(data);
    return await purchasedCourse.save();
};

const getAll = async () => {
    return await WA_PurchasedCourses.findAll();
};

const getById = async (id) => {
    return await WA_PurchasedCourses.findByPk(id);
};

const update = async (id, data) => {
    return await WA_PurchasedCourses.update(data, {
        where: {
            id: id
        }
    });
};

const deleteById = async (id) => {
    return await WA_PurchasedCourses.destroy({
        where: {
            id: id
        }
    });
};

export default {
    create,
    getAll,
    getById,
    update,
    deleteById
};