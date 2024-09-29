import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";

const getAllWaUsersMetadataService = async () => {
    return await waUsersMetadataRepository.getAll();
};

const getWaUserMetadataByPhoneNumberService = async (phoneNumber) => {
    return await waUsersMetadataRepository.getByPhoneNumber(phoneNumber);
};



export default {
    getAllWaUsersMetadataService,
    getWaUserMetadataByPhoneNumberService
};