import WA_UserActivityLogs from '../models/WA_UserActivityLogs.js';
import { Sequelize } from 'sequelize';


const create = async (data) => {
    const activityLog = new WA_UserActivityLogs(data);
    return await activityLog.save();
};

const getAll = async () => {
    return await WA_UserActivityLogs.findAll();
};

const getByPhoneNumber = async (phoneNumber, botPhoneNumberId, limit = 15, offset = 0, profile_id) => {
    return await WA_UserActivityLogs.findAll({
        where: {
            phoneNumber: phoneNumber,
            bot_phone_number_id: botPhoneNumberId,
            profile_id: profile_id,
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
        group: ['profile_id', 'phoneNumber', 'messageContent']
    });

    return lastMessages;
};

const getLastMarketingBotMessage = async (phoneNumber) => {
    const lastMessage = await WA_UserActivityLogs.findOne({
        where: {
            phoneNumber: phoneNumber,
            bot_phone_number_id: process.env.MARKETING_BOT_PHONE_NUMBER_ID
        },
        order: [
            ['timestamp', 'DESC']
        ]
    });
    return lastMessage;
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

const getMarketingBotChatHistory = async (phoneNumber) => {
    let previousMessages = [];
    const messages = await WA_UserActivityLogs.findAll({
        where: {
            phoneNumber: phoneNumber,
            bot_phone_number_id: process.env.MARKETING_BOT_PHONE_NUMBER_ID
        },
        order: [
            ['timestamp', 'ASC']
        ]
    });

    // If more than 50 inbound messages in the past hour, then return null
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const inboundMessagesInPastHour = await WA_UserActivityLogs.count({
        where: {
            phoneNumber: phoneNumber,
            bot_phone_number_id: process.env.MARKETING_BOT_PHONE_NUMBER_ID,
            messageDirection: "inbound",
            timestamp: {
                [Sequelize.Op.gte]: oneHourAgo
            }
        }
    });
    if (inboundMessagesInPastHour > 50) {
        return null;
    }

    messages.forEach(message => {
        if (message.messageDirection == "inbound") {
            previousMessages.push({
                role: "user",
                content: message.messageContent[0]
            });
        } else {
            previousMessages.push({
                role: "assistant",
                content: message.messageContent[0]
            });
        }
    });
    return previousMessages;
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
    getStudentCoursePriceByFirstMessage,
    getMarketingBotChatHistory,
    getLastMarketingBotMessage
};
