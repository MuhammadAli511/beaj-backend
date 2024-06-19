import service from '../services/courseCategoryService.js'


const createCourseCategoryController = async (req, res) => {
    try {
        const courseCategoryName = req.body.courseCategoryName;
        const image = req.file;
        const categorySequenceNum = req.body.categorySequenceNum;
        await service.createCourseCategoryService(courseCategoryName, image, categorySequenceNum);
        res.status(200).send({ message: "Category created successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getAllCourseCategoryController = async (req, res) => {
    try {
        const result = await service.getAllCourseCategoryService();
        res.status(200).send(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getCourseCategoryByIdController = async (req, res) => {
    try {
        const id = req.params.id;
        const result = await service.getCourseCategoryByIdService(id);
        res.status(200).send(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const updateCourseCategoryController = async (req, res) => {
    try {
        const id = req.params.id;
        const courseCategoryName = req.body.courseCategoryName;
        const image = req.file;
        const categorySequenceNum = req.body.categorySequenceNum;
        await service.updateCourseCategoryService(id, courseCategoryName, image, categorySequenceNum);
        res.status(200).send({ message: "Category updated successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteCourseCategoryController = async (req, res) => {
    try {
        const id = req.params.id;
        await service.deleteCourseCategoryService(id);
        res.status(200).send({ message: "Category deleted successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export default {
    createCourseCategoryController,
    getAllCourseCategoryController,
    getCourseCategoryByIdController,
    updateCourseCategoryController,
    deleteCourseCategoryController
};