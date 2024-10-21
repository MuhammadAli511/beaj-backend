import waConstantsRepository from '../repositories/waConstantsRepository.js';
import azure_blob from '../utils/azureBlobStorage.js';

const getAllWaConstantsService = async () => {
    return await waConstantsRepository.getAll();
};

const getWaConstantByConstantNameService = async (constantName) => {
    return await waConstantsRepository.getByKey(constantName);
};

const createWaConstantService = async (waConstant) => {
    try {
        let constantValue = waConstant.constantValue;
        // if not string
        if (typeof waConstant.constantValue !== 'string') {
            constantValue = await azure_blob.uploadToBlobStorage(waConstant.constantValue);
        }
        return await waConstantsRepository.create(waConstant.key, constantValue, waConstant.category);
    } catch (error) {
        error.fileName = 'waConstantsService.js';
        throw error;
    }
};


const updateWaConstantService = async (waConstant) => {
    try {
        let constantValue = waConstant.constantValue;
        if (typeof waConstant.constantValue !== 'string') {
            constantValue = await azure_blob.uploadToBlobStorage(waConstant.constantValue);
        }
        return await waConstantsRepository.updateByKey(waConstant.key, constantValue, waConstant.category);
    } catch (error) {
        error.fileName = 'waConstantsService.js';
        throw error;
    }
};


const deleteWaConstantService = async (constantName) => {
    return await waConstantsRepository.deleteByKey(constantName);
};

export default {
    getAllWaConstantsService,
    getWaConstantByConstantNameService,
    createWaConstantService,
    updateWaConstantService,
    deleteWaConstantService
};