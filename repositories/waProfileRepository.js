import WA_Profile from "../models/WA_Profiles.js";

const create = async (data) => {
    const profile = new WA_Profile(data);
    return await profile.save();
};

const getByProfileId = async (profileId) => {
    return await WA_Profile.findOne({ where: { profile_id: profileId } });
};

const getByPhoneNumberAndBotPhoneNumberId = async (phoneNumber, botPhoneNumberId) => {
    return await WA_Profile.findOne({ where: { phone_number: phoneNumber, bot_phone_number_id: botPhoneNumberId } });
};

const deleteByPhoneNumber = async (phoneNumber) => {
    return await WA_Profile.destroy({ where: { phone_number: phoneNumber } });
};

const deleteByProfileId = async (profileId) => {
    return await WA_Profile.destroy({ where: { profile_id: profileId } });
};

const getAllSortOnProfileId = async (userMobileNumber) => {
    return await WA_Profile.findAll({ where: { profile_type: "student", phone_number: userMobileNumber }, order: [['profile_id', 'ASC']] });
};


export default {
    create,
    deleteByPhoneNumber,
    deleteByProfileId,
    getByProfileId,
    getByPhoneNumberAndBotPhoneNumberId,
    getAllSortOnProfileId
};