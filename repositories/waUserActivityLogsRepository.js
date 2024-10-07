import WA_UserActivityLogs from '../models/WA_UserActivityLogs.js';

const create = async (data) => {
    const activityLog = new WA_UserActivityLogs(data);
    return await activityLog.save();
};

const getAll = async () => {
    return await WA_UserActivityLogs.findAll();
};

const getById = async (id) => {
    return await WA_UserActivityLogs.findByPk(id);
};

const update = async (id, data) => {
    return await WA_UserActivityLogs.update(data, {
        where: {
            id: id
        }
    });
};

const deleteById = async (id) => {
    return await WA_UserActivityLogs.destroy({
        where: {
            id: id
        }
    });
};

const getByPhoneNumber = async (phoneNumber) => {
    return await WA_UserActivityLogs.findAll({
        where: {
            phoneNumber: phoneNumber
        }
    });
};

const deleteByPhoneNumber = async (phoneNumber) => {
    return await WA_UserActivityLogs.destroy({
        where: {
            phoneNumber: phoneNumber
        }
    });
};

export default {
    create,
    getAll,
    getById,
    update,
    deleteById,
    getByPhoneNumber,
    deleteByPhoneNumber
};
