import waUserActivityLogsRepository from "../repositories/waUserActivityLogsRepository.js";

const getAllWaUserActivityLogsService = async () => {
    return await waUserActivityLogsRepository.getAll();
};

const getWaUserActivityLogByPhoneNumberService = async (phoneNumber) => {
    return await waUserActivityLogsRepository.getByPhoneNumber(phoneNumber);
};


export default {
    getAllWaUserActivityLogsService,
    getWaUserActivityLogByPhoneNumberService
};