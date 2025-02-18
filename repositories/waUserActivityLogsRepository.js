import WA_UserActivityLogs from '../models/WA_UserActivityLogs.js';
import { Sequelize } from 'sequelize';

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

const getCountBySpeciifcMessage = async (message) => {
    return await WA_UserActivityLogs.count({
        where: {
            messageContent: [message]
        }
    });
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


const countMessagesInLastnSeconds = async (phoneNumber, seconds) => {
    const messages = await WA_UserActivityLogs.findAll({
        where: {
            phoneNumber: phoneNumber
        },
        order: [
            ['timestamp', 'DESC']
        ]
    });
    const now = new Date();
    const lastnSeconds = new Date(now.getTime() - seconds * 1000);
    const messagesInLastnSeconds = messages.filter(message => message.dataValues.timestamp > lastnSeconds);
    return messagesInLastnSeconds.length;
};


export default {
    create,
    getAll,
    getById,
    update,
    deleteById,
    getByPhoneNumber,
    deleteByPhoneNumber,
    getCountBySpeciifcMessage,
    getLastActiveUsers,
    countMessagesInLastnSeconds
};
