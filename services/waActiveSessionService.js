import waActiveSessionRepository from "../repositories/waActiveSessionRepository.js";

const getByPhoneNumberAndBotPhoneNumberIdService = async (phoneNumber, botPhoneNumberId) => {
    return await waActiveSessionRepository.getByPhoneNumberAndBotPhoneNumberId(phoneNumber, botPhoneNumberId);
};

export default {
    getByPhoneNumberAndBotPhoneNumberIdService
};