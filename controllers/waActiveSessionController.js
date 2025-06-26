import waActiveSessionService from "../services/waActiveSessionService.js";

const getWaActiveSessionByPhoneNumberAndBotPhoneNumberIdController = async (req, res, next) => {
    try {
        const phoneNumber = req.params.phoneNumber;
        const botPhoneNumberId = req.params.botPhoneNumberId;
        const result = await waActiveSessionService.getByPhoneNumberAndBotPhoneNumberIdService(phoneNumber, botPhoneNumberId);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'waActiveSessionController.js';
        next(error);
    }
};

export default {
    getWaActiveSessionByPhoneNumberAndBotPhoneNumberIdController
};