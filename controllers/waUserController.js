import service from '../services/waUserService.js';

const getAllWaUsers = async (req, res, next) => {
    try {
        const result = await service.getAllWaUsersService();
        res.status(200).send(result);
    }
    catch (error) {
        error.fileName = 'waUserController.js';
        next(error);
    }
};

export default {
    getAllWaUsers
};