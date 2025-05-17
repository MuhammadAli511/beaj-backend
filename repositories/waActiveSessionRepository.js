import WA_ActiveSession from '../models/WA_ActiveSession.js';

const create = async (data) => {
    const activeSession = new WA_ActiveSession(data);
    return await activeSession.save();
};

const getAll = async () => {
    return await WA_ActiveSession.findAll();
};

const getByPhoneNumberAndBotPhoneNumberId = async (phoneNumber, botPhoneNumberId) => {
    return await WA_ActiveSession.findOne({
        where: { phone_number: phoneNumber, bot_phone_number_id: botPhoneNumberId }
    });
};

const updateCurrentProfileIdOnPhoneNumber = async (phoneNumber, profileId, botPhoneNumberId) => {
    return await WA_ActiveSession.update({ profile_id: profileId }, { where: { phone_number: phoneNumber, bot_phone_number_id: botPhoneNumberId } });
};

const deleteByPhoneNumber = async (phoneNumber) => {
    return await WA_ActiveSession.destroy({ where: { phone_number: phoneNumber } });
};

const deleteByProfileId = async (profileId) => {
    return await WA_ActiveSession.destroy({ where: { profile_id: profileId } });
};


export default { create, getAll, getByPhoneNumberAndBotPhoneNumberId, updateCurrentProfileIdOnPhoneNumber, deleteByPhoneNumber, deleteByProfileId };