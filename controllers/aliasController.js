import service from '../services/aliasService.js'

const createAliasController = async (req, res) => {
    try {
        const alias = req.body.alias;

        await service.createAliasService(alias);
        res.status(200).send({ message: "Alias created successfully" });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getAllAliasController = async (req, res) => {
    try {
        const result = await service.getAllAliasService();
        res.status(200).send(result);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getAliasByIdController = async (req, res) => {
    try {
        const id = req.params.id;
        const result = await service.getAliasByIdService(id);
        res.status(200).send(result);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const updateAliasController = async (req, res) => {
    try {
        const id = req.params.id;
        const alias = req.body.alias;

        await service.updateAliasService(id, alias);
        res.status(200).send({ message: "Alias updated successfully" });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteAliasController = async (req, res) => {
    try {
        const id = req.params.id;
        await service.deleteAliasService(id);
        res.status(200).send({ message: "Alias deleted successfully" });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export default {
    createAliasController,
    getAllAliasController,
    getAliasByIdController,
    updateAliasController,
    deleteAliasController
};