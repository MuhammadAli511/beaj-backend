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
        const result = await service.getWaUserActivityLogByPhoneNumberService(phoneNumber);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'waUserActivityLogsController.js';
        next(error);
    }
};


export default {
    getAllWaUserActivityLogsController,
    getWaUserActivityLogByPhoneNumberController
};