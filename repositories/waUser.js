import WA_User from '../models/WA_User.js';

const create = async (phone_number, state) => {
    const waUser = new WA_User({
        phone_number: phone_number,
        state: state
    });
    return await waUser.save();
};

const getAll = async () => {
    return await WA_User.findAll();
};

const getByPhoneNumber = async (phone_number) => {
    return await WA_User.findByPk(phone_number);
};

const update = async (phone_number, state, persona) => {
    return await WA_User.update({
        state: state,
        persona: persona
    }, {
        where: {
            phone_number: phone_number
        }
    });
};

export default {
    create,
    getAll,
    getByPhoneNumber,
    update
};
