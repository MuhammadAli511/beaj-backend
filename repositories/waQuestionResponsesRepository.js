import WA_QuestionResponses from '../models/WA_QuestionResponses.js';

const create = async (data) => {
    const response = new WA_QuestionResponses(data);
    return await response.save();
};

const getAll = async () => {
    return await WA_QuestionResponses.findAll();
};

const getById = async (id) => {
    return await WA_QuestionResponses.findByPk(id);
};

const update = async (id, data) => {
    return await WA_QuestionResponses.update(data, {
        where: {
            id: id
        }
    });
};

const deleteById = async (id) => {
    return await WA_QuestionResponses.destroy({
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
