import WA_Profile from "../models/WA_Profiles.js";

const create = async (data) => {
    const profile = new WA_Profile(data);
    return await profile.save();
};


export default {
    create
};