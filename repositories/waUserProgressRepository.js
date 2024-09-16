import WA_UserProgress from '../models/WA_UserProgress.js';

const create = async (data) => {
    const userProgress = new WA_UserProgress(data);
    return await userProgress.save();
};

const getAll = async () => {
    return await WA_UserProgress.findAll();
};

const getByPhoneNumber = async (phoneNumber) => {
    return await WA_UserProgress.findByPk(phoneNumber);
};

const update = async (phoneNumber, data) => {
    return await WA_UserProgress.update(data, {
        where: {
            phoneNumber: phoneNumber
        }
    });
};

const deleteByPhoneNumber = async (phoneNumber) => {
    return await WA_UserProgress.destroy({
        where: {
            phoneNumber: phoneNumber
        }
    });
};

export default {
    create,
    getAll,
    getByPhoneNumber,
    update,
    deleteByPhoneNumber
};
