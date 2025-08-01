import service from '../services/waUserActivityLogsService.js';

const getAllWaUserActivityLogsController = async (req, res, next) => {
    try {
        const result = await service.getAllWaUserActivityLogsService();
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'waUserActivityLogsController.js';
        next(error);
    }
};


const getWaUserActivityLogByPhoneNumberController = async (req, res, next) => {
    try {
        const phoneNumber = req.params.phoneNumber;
        const botPhoneNumberId = req.query.botPhoneNumberId || null;
        const profile_id = req.query.profile_id;
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 15;
        const result = await service.getWaUserActivityLogByPhoneNumberService(phoneNumber,botPhoneNumberId, page, pageSize, profile_id);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'waUserActivityLogsController.js';
        next(error);
    }
};


const getLastMessageTimeController = async (req, res, next) => {
    try {
        const result = await service.getLastMessageTimeService();
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'waUserActivityLogsController.js';
        next(error);
    }
};


const getWaUserActivityLogByPhoneNumberAndBotNumberIdController = async (req, res, next) => {
    try {
        const phoneNumber = req.params.phoneNumber;
        const botNumberId = req.params.botNumberId;
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 15;
        const result = await service.getWaUserActivityLogByPhoneNumberAndBotNumberIdService(phoneNumber, botNumberId, page, pageSize);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'waUserActivityLogsController.js';
        next(error);
    }
};




export default {
    getAllWaUserActivityLogsController,
    getWaUserActivityLogByPhoneNumberController,
    getLastMessageTimeController,
    getWaUserActivityLogByPhoneNumberAndBotNumberIdController
};