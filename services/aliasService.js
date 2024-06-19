import aliasRepository from "../repositories/aliasRepository.js";

const createAliasService = async (alias) => {
    await aliasRepository.create(alias);
}

const getAllAliasService = async () => {
    const aliases = await aliasRepository.getAll();
    return aliases;
}

const getAliasByIdService = async (id) => {
    const alias = await aliasRepository.getById(id);
    return alias;
}

const updateAliasService = async (id, alias) => {
    await aliasRepository.update(id, alias);
}

const deleteAliasService = async (id) => {
    await aliasRepository.deleteAlias(id);
}

export default {
    createAliasService,
    getAllAliasService,
    getAliasByIdService,
    updateAliasService,
    deleteAliasService
};