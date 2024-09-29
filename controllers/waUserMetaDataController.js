import service from '../services/waUserMetadataService.js';


const getAllWaUserMetaDataController = async (req, res, next) => {
    try {
        const result = await service.getAllWaUsersMetadataService();
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'waUserMetaDataController.js';
        next(error);
    }
};

const getWaUserMetaDataByPhoneNumberController = async (req, res, next) => {
    try {
        const phoneNumber = req.params.phoneNumber;
        const result = await service.getWaUserMetadataByPhoneNumberService(phoneNumber);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'waUserMetaDataController.js';
        next(error);
    }
}


export default {
    getAllWaUserMetaDataController,
    getWaUserMetaDataByPhoneNumberController
};