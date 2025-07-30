import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";

const getAllWaUsersMetadataService = async () => {
    return await waUsersMetadataRepository.getAll();
};

const getWaUserMetadataByPhoneNumberService = async (phoneNumber) => {
    return await waUsersMetadataRepository.getByPhoneNumber(phoneNumber);
};


const assignTargetGroupService = async (phoneNumber, profile_id, targetGroup) => {
    return await waUsersMetadataRepository.assignTargetGroup(phoneNumber, profile_id, targetGroup);
};

const updateWaUserMetadataService = async (profile_id, phoneNumber, metadata) => {
    return await waUsersMetadataRepository.update(profile_id, phoneNumber, metadata);
};


export default {
    getAllWaUsersMetadataService,
    getWaUserMetadataByPhoneNumberService,
    assignTargetGroupService,
    updateWaUserMetadataService,
};