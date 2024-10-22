import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";

const getAllWaUsersMetadataService = async () => {
    return await waUsersMetadataRepository.getAll();
};

const getWaUserMetadataByPhoneNumberService = async (phoneNumber) => {
    return await waUsersMetadataRepository.getByPhoneNumber(phoneNumber);
};

const assignTargetGroupService = async (phoneNumber, targetGroup) => {
    return await waUsersMetadataRepository.assignTargetGroup(phoneNumber, targetGroup);
}


export default {
    getAllWaUsersMetadataService,
    getWaUserMetadataByPhoneNumberService,
    assignTargetGroupService
};