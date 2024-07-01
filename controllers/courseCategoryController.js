import service from '../services/courseCategoryService.js';

const createCourseCategoryController = async (req, res, next) => {
    try {
        const courseCategoryName = req.body.courseCategoryName;
        const image = req.file;
        const categorySequenceNum = req.body.categorySequenceNum;
        await service.createCourseCategoryService(courseCategoryName, image, categorySequenceNum);
        res.status(200).send({ message: "Category created successfully" });
    } catch (error) {
        error.fileName = 'courseCategoryController.js';
        next(error);
    }
};

const getAllCourseCategoryController = async (req, res, next) => {
    try {
        const result = await service.getAllCourseCategoryService();
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'courseCategoryController.js';
        next(error);
    }
};

const getCourseCategoryByIdController = async (req, res, next) => {
    try {
        const id = req.params.id;
        const result = await service.getCourseCategoryByIdService(id);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'courseCategoryController.js';
        next(error);
    }
};

const updateCourseCategoryController = async (req, res, next) => {
    try {
        const id = req.params.id;
        const courseCategoryName = req.body.courseCategoryName;
        const image = req.file;
        const categorySequenceNum = req.body.categorySequenceNum;
        await service.updateCourseCategoryService(id, courseCategoryName, image, categorySequenceNum);
        res.status(200).send({ message: "Category updated successfully" });
    } catch (error) {
        error.fileName = 'courseCategoryController.js';
        next(error);
    }
};

const deleteCourseCategoryController = async (req, res, next) => {
    try {
        const id = req.params.id;
        await service.deleteCourseCategoryService(id);
        res.status(200).send({ message: "Category deleted successfully" });
    } catch (error) {
        error.fileName = 'courseCategoryController.js';
        next(error);
    }
};

export default {
    createCourseCategoryController,
    getAllCourseCategoryController,
    getCourseCategoryByIdController,
    updateCourseCategoryController,
    deleteCourseCategoryController
};
