import WA_Profile from "../models/WA_Profiles.js";

const create = async (data) => {
    const profile = new WA_Profile(data);
    return await profile.save();
};

const deleteByPhoneNumber = async (phoneNumber) => {
    return await WA_Profile.destroy({ where: { phone_number: phoneNumber } });
};


export default {
    create,
    deleteByPhoneNumber
};