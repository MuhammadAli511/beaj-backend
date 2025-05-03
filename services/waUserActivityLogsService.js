import waUserActivityLogsRepository from "../repositories/waUserActivityLogsRepository.js";

const getAllWaUserActivityLogsService = async () => {
    return await waUserActivityLogsRepository.getAll();
};

const getWaUserActivityLogByPhoneNumberService = async (phoneNumber,botPhoneNumberId, page = 1, pageSize = 15) => {
    const offset = (page - 1) * pageSize;
    return await waUserActivityLogsRepository.getByPhoneNumber(phoneNumber,botPhoneNumberId, pageSize, offset);
};

const getLastMessageTimeService = async () => {
    return await waUserActivityLogsRepository.getLastMessageTime();
};

const getWaUserActivityLogByPhoneNumberAndBotNumberIdService = async (phoneNumber, botNumberId, page = 1, pageSize = 15) => {
    const offset = (page - 1) * pageSize;
    return await waUserActivityLogsRepository.getByPhoneNumberAndBotNumberId(phoneNumber, botNumberId, pageSize, offset);
};


export default {
    getAllWaUserActivityLogsService,
    getWaUserActivityLogByPhoneNumberService,
    getLastMessageTimeService,
    getWaUserActivityLogByPhoneNumberAndBotNumberIdService
};