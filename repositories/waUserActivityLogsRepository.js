import WA_UserActivityLogs from '../models/WA_UserActivityLogs.js';
import { Sequelize } from 'sequelize';

const create = async (data) => {
    const activityLog = new WA_UserActivityLogs(data);
    return await activityLog.save();
};

const getAll = async () => {
    return await WA_UserActivityLogs.findAll();
};

const getByPhoneNumber = async (phoneNumber, limit = 15, offset = 0) => {
    return await WA_UserActivityLogs.findAll({
        where: {
            phoneNumber: phoneNumber
        },
        order: [
            ['timestamp', 'DESC']
        ],
        limit: limit,
        offset: offset
    });
};

const getByProfileId = async (profileId, limit = 15, offset = 0) => {
    return await WA_UserActivityLogs.findAll({
        where: {
            profile_id: profileId
        }
    });
};

const getByPhoneNumberAndBotNumberId = async (phoneNumber, botNumberId, limit = 15, offset = 0) => {
    return await WA_UserActivityLogs.findAll({
        where: {
            phoneNumber: phoneNumber,
            botNumberId: botNumberId
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

const getLastActiveUsers = async (days, filteredUsers) => {
    return await WA_UserActivityLogs.findAll({
        attributes: [
            'phoneNumber',
            [Sequelize.fn('MAX', Sequelize.col('timestamp')), 'timestamp']
        ],
        where: {
            phoneNumber: {
                [Sequelize.Op.in]: filteredUsers.map(user => user.phoneNumber)
            }
        },
        group: ['phoneNumber']
    });
};


const getLastMessageTime = async () => {
    const lastMessages = await WA_UserActivityLogs.findAll({
        attributes: [
            'phoneNumber',
            [Sequelize.fn('MAX', Sequelize.col('timestamp')), 'timestamp']
        ],
        group: ['phoneNumber']
    });

    return lastMessages;
};


export default {
    create,
    getAll,
    getByPhoneNumber,
    getByProfileId,
    getByPhoneNumberAndBotNumberId,
    deleteByPhoneNumber,
    getLastActiveUsers,
    getLastMessageTime
};
