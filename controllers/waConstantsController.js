import service from '../services/waConstantsService.js';

const getAllWaConstants = async (req, res) => {
    try {
        const waConstants = await service.getAllWaConstantsService();
        res.status(200).send(waConstants);
    } catch (error) {
        res.status(500).send({
            message: error.message || "Some error occurred while retrieving constants."
        });
    }
};

const getWaConstantByConstantName = async (req, res) => {
    try {
        const waConstant = await service.getWaConstantByConstantNameService(req.params.constantName);
        res.status(200).send(waConstant);
    } catch (error) {
        res.status(500).send({
            message: error.message || "Some error occurred while retrieving constant."
        });
    }
};

const createWaConstant = async (req, res) => {
    try {
        const waConstant = req.body;
        const result = await service.createWaConstantService(waConstant);
        res.status(201).send(result);
    } catch (error) {
        res.status(500).send({
            message: error.message || "Some error occurred while creating the constant."
        });
    }
};

const updateWaConstant = async (req, res) => {
    try {
        const waConstant = req.body;
        const result = await service.updateWaConstantService(waConstant);
        res.status(200).send(result);
    } catch (error) {
        res.status(500).send({
            message: error.message || "Some error occurred while updating the constant."
        });
    }
};

const deleteWaConstant = async (req, res) => {
    try {
        const result = await service.deleteWaConstantService(req.params.constantName);
        res.status(200).send(result);
    } catch (error) {
        res.status(500).send({
            message: error.message || "Some error occurred while deleting the constant."
        });
    }
};

export default {
    getAllWaConstants,
    getWaConstantByConstantName,
    createWaConstant,
    updateWaConstant,
    deleteWaConstant
};