import WA_UsersMetadata from '../models/WA_UsersMetadata.js';
import Sequelize from 'sequelize';

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

const assignTargetGroup = async (phoneNumber, targetGroup) => {
    return await WA_UsersMetadata.update({
        targetGroup: targetGroup
    }, {
        where: {
            phoneNumber: phoneNumber
        }
    });
};

const getTotalUsersCount = async () => {
    return await WA_UsersMetadata.count();
};

const getRegisteredUsersCount = async () => {
    return await WA_UsersMetadata.count({
        where: {
            phoneNumber: {
                [Sequelize.Op.not]: null
            },
            name: {
                [Sequelize.Op.not]: null
            },
            city: {
                [Sequelize.Op.not]: null
            },
            scholarshipvalue: {
                [Sequelize.Op.not]: null
            }
        }
    });
};

const getSelectedUsersCount = async () => {
    return await WA_UsersMetadata.count({
        where: {
            targetGroup: {
                [Sequelize.Op.or]: ['T1', 'T2']
            }
        }
    });
};

const getFreeDemoStartedUsersCount = async () => {
    return await WA_UsersMetadata.count({
        where: {
            freeDemoStarted: true
        }
    });
};

const getFreeDemoEndedUsersCount = async () => {
    return await WA_UsersMetadata.count({
        where: {
            freeDemoEnded: true
        }
    });
};

export default {
    create,
    getAll,
    getByPhoneNumber,
    update,
    deleteByPhoneNumber,
    assignTargetGroup,
    getTotalUsersCount,
    getRegisteredUsersCount,
    getSelectedUsersCount,
    getFreeDemoStartedUsersCount,
    getFreeDemoEndedUsersCount
};
