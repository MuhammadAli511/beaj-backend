import WA_UsersMetadata from '../models/WA_UsersMetadata.js';

const create = async (data) => {
    const userMetadata = new WA_UsersMetadata(data);
    return await userMetadata.save();
};

const getAll = async () => {
    return await WA_UsersMetadata.findAll();
};

const getByPhoneNumber = async (phoneNumber) => {
    return await WA_UsersMetadata.findByPk(phoneNumber);
};

const update = async (phoneNumber, data) => {
    return await WA_UsersMetadata.update(data, {
        where: {
            phoneNumber: phoneNumber
        }
    });
};

const deleteByPhoneNumber = async (phoneNumber) => {
    return await WA_UsersMetadata.destroy({
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
