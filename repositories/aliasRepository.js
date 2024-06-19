import ActivityAlias from '../models/ActivityAlias.js';

const create = async (alias) => {
    const activityAlias = new ActivityAlias({
        Alias: alias
    });
    return await activityAlias.save();
};

const getAll = async () => {
    return await ActivityAlias.findAll();
};

const getById = async (id) => {
    return await ActivityAlias.findByPk(id);
};

const update = async (id, alias) => {
    return await ActivityAlias.update({
        Alias: alias
    }, {
        where: {
            id: id
        }
    });
};

const deleteAlias = async (id) => {
    return await ActivityAlias.destroy({
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
    deleteAlias
};
