import waConstantsRepository from '../repositories/waConstantsRepository.js';

const getAllWaConstantsService = async () => {
    return await waConstantsRepository.getAll();
};

const getWaConstantByConstantNameService = async (constantName) => {
    return await waConstantsRepository.getByKey(constantName);
};

const createWaConstantService = async (waConstant) => {
    return await waConstantsRepository.create(waConstant.key, waConstant.constantValue, waConstant.category);
};

const updateWaConstantService = async (waConstant) => {
    return await waConstantsRepository.updateByKey(waConstant.key, waConstant.constantValue, waConstant.category);
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