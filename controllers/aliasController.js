import service from '../services/aliasService.js'

const createAliasController = async (req, res, next) => {
    try {
        const alias = req.body.alias;
        await service.createAliasService(alias);
        res.status(200).send({ message: "Alias created successfully" });
    } catch (error) {
        error.fileName = 'aliasController.js';
        next(error);
    }
};

const getAllAliasController = async (req, res, next) => {
    try {
        const result = await service.getAllAliasService();
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'aliasController.js';
        next(error);
    }
};

const getAliasByIdController = async (req, res, next) => {
    try {
        const id = req.params.id;
        const result = await service.getAliasByIdService(id);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'aliasController.js';
        next(error);
    }
};

const updateAliasController = async (req, res, next) => {
    try {
        const id = req.params.id;
        const alias = req.body.alias;
        await service.updateAliasService(id, alias);
        res.status(200).send({ message: "Alias updated successfully" });
    } catch (error) {
        error.fileName = 'aliasController.js';
        next(error);
    }
};

const deleteAliasController = async (req, res, next) => {
    try {
        const id = req.params.id;
        await service.deleteAliasService(id);
        res.status(200).send({ message: "Alias deleted successfully" });
    } catch (error) {
        error.fileName = 'aliasController.js';
        next(error);
    }
};

export default {
    createAliasController,
    getAllAliasController,
    getAliasByIdController,
    updateAliasController,
    deleteAliasController
};
