import waUserActivityLogsRepository from "../repositories/waUserActivityLogsRepository.js";

const getAllWaUserActivityLogsService = async () => {
    return await waUserActivityLogsRepository.getAll();
};

const getWaUserActivityLogByPhoneNumberService = async (phoneNumber, page = 1, pageSize = 15) => {
    const offset = (page - 1) * pageSize;
    return await waUserActivityLogsRepository.getByPhoneNumber(phoneNumber, pageSize, offset);
};

const getLastMessageTimeService = async () => {
    return await waUserActivityLogsRepository.getLastMessageTime();
};


export default {
    getAllWaUserActivityLogsService,
    getWaUserActivityLogByPhoneNumberService,
    getLastMessageTimeService
};