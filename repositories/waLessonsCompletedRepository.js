import WA_LessonsCompleted from '../models/WA_LessonsCompleted.js';

const create = async (data) => {
    const lessonCompleted = new WA_LessonsCompleted(data);
    return await lessonCompleted.save();
};

const getAll = async () => {
    return await WA_LessonsCompleted.findAll();
};

const getById = async (id) => {
    return await WA_LessonsCompleted.findByPk(id);
};

const update = async (id, data) => {
    return await WA_LessonsCompleted.update(data, {
        where: {
            id: id
        }
    });
};

const deleteById = async (id) => {
    return await WA_LessonsCompleted.destroy({
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
