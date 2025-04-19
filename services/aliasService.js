import aliasRepository from '../repositories/aliasRepository.js';

const createAliasService = async (alias) => {
    try {
        await aliasRepository.create(alias);
    } catch (error) {
        error.fileName = 'aliasService.js';
        throw error;
    }
};

const getAllAliasService = async () => {
    try {
        const aliases = await aliasRepository.getAll();
        return aliases;
    } catch (error) {
        error.fileName = 'aliasService.js';
        throw error;
    }
};

const getAliasByIdService = async (id) => {
    try {
        const alias = await aliasRepository.getById(id);
        return alias;
    } catch (error) {
        error.fileName = 'aliasService.js';
        throw error;
    }
};

const updateAliasService = async (id, alias) => {
    try {
        await aliasRepository.update(id, alias);
    } catch (error) {
        error.fileName = 'aliasService.js';
        throw error;
    }
};

const deleteAliasService = async (id) => {
    try {
        await aliasRepository.deleteAlias(id);
    } catch (error) {
        error.fileName = 'aliasService.js';
        throw error;
    }
};

export default {
    createAliasService,
    getAllAliasService,
    getAliasByIdService,
    updateAliasService,
    deleteAliasService
};
