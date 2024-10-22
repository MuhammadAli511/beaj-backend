import service from '../services/waConstantsService.js';

const getAllWaConstants = async (req, res, next) => {
    try {
        const waConstants = await service.getAllWaConstantsService();
        res.status(200).send(waConstants);
    } catch (error) {
        error.fileName = 'waConstantsController.js';
        next(error);
    }
};

const getWaConstantByConstantName = async (req, res, next) => {
    try {
        const waConstant = await service.getWaConstantByConstantNameService(req.params.key);
        res.status(200).send(waConstant);
    } catch (error) {
        error.fileName = 'waConstantsController.js';
        next(error);
    }
};

const createWaConstant = async (req, res, next) => {
    try {
        const { key, category } = req.body;
        const constantValue = req.file ? req.file : req.body.constantValue;
        const result = await service.createWaConstantService({ key, constantValue, category });
        res.status(201).send({ message: "Constant created successfully", result });
    } catch (error) {
        error.fileName = 'waConstantsController.js';
        next(error);
    }
};

const updateWaConstant = async (req, res, next) => {
    try {
        const key = req.params.key;
        const { category } = req.body;
        const constantValue = req.file ? req.file : req.body.constantValue;
        const result = await service.updateWaConstantService({ key, constantValue, category });
        res.status(200).send({ message: "Constant updated successfully", result });
    } catch (error) {
        error.fileName = 'waConstantsController.js';
        next(error);
    }
};

const deleteWaConstant = async (req, res, next) => {
    try {
        const result = await service.deleteWaConstantService(req.params.constantName);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'waConstantsController.js';
        next(error);
    }
};

export default {
    getAllWaConstants,
    getWaConstantByConstantName,
    createWaConstant,
    updateWaConstant,
    deleteWaConstant
};