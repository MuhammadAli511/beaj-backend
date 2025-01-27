import WA_Feedback from '../models/WA_Feedback.js';

const create = async (data) => {
    const feedback = new WA_Feedback(data);
    return await feedback.save();
};

const getAll = async () => {
    return await WA_Feedback.findAll();
};

const getByPhoneNumber = async (phoneNumber) => {
    return await WA_Feedback.findAll({
        where: {
            phoneNumber: phoneNumber
        },
        order: [
            ['timestamp', 'DESC']
        ]
    });
};


export default {
    create,
    getAll,
    getByPhoneNumber,
};
