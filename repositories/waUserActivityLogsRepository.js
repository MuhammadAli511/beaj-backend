import WA_UserActivityLogs from '../models/WA_UserActivityLogs.js';
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const create = async (data) => {
    const activityLog = new WA_UserActivityLogs(data);
    return await activityLog.save();
};

const getAll = async () => {
    return await WA_UserActivityLogs.findAll();
};

const getByPhoneNumber = async (phoneNumber, botPhoneNumberId, limit = 15, offset = 0) => {
    return await WA_UserActivityLogs.findAll({
        where: {
            phoneNumber: phoneNumber,
            bot_phone_number_id: botPhoneNumberId
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
            bot_phone_number_id: botNumberId
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


const getLastMessageTime = async () => {
    const lastMessages = await WA_UserActivityLogs.findAll({
        attributes: [
            'phoneNumber',
            [Sequelize.fn('MAX', Sequelize.col('timestamp')), 'timestamp']
        ],
        group: ['profile_id', 'phoneNumber']
    });

    return lastMessages;
};

const getStudentCoursePriceByFirstMessage = async (phoneNumber) => {
    try {
        const firstMessage = await WA_UserActivityLogs.findOne({
            attributes: ['messageContent'],
            where: {
                phoneNumber: phoneNumber,
                bot_phone_number_id: process.env.STUDENT_BOT_PHONE_NUMBER_ID
            },
            order: [
                ['timestamp', 'ASC'],
                ['id', 'ASC']
            ]
        });

        if (!firstMessage) {
            return 1500;
        }

        const messageContent = firstMessage.messageContent[0];

        if (messageContent == 'Start Free Trial now!') {
            return 1200;
        } else if (messageContent == 'سٹارٹ فری ٹرائل') {
            return 750;
        } else {
            return 1500;
        }
    } catch (error) {
        console.error('Error in getStudentCoursePriceByFirstMessage:', error);
        return 1500;
    }
};

export default {
    create,
    getAll,
    getByPhoneNumber,
    getByProfileId,
    getByPhoneNumberAndBotNumberId,
    deleteByPhoneNumber,
    getLastActiveUsers,
    getLastMessageTime,
    getStudentCoursePriceByFirstMessage
};
