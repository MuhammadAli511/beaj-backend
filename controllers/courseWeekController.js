import service from '../services/courseWeekService.js';

const createCourseWeekController = async (req, res, next) => {
    try {
        const { weekNumber, description, courseId } = req.body;
        const image = req.file;
        await service.createCourseWeekService(weekNumber, courseId, image, description);
        res.status(200).send({ message: "Course Week created successfully" });
    } catch (error) {
        error.fileName = 'courseWeekController.js';
        next(error);
    }
};

const getAllCourseWeekController = async (req, res, next) => {
    try {
        const result = await service.getAllCourseWeekService();
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'courseWeekController.js';
        next(error);
    }
};

const getCourseWeekByIdController = async (req, res, next) => {
    try {
        const id = req.params.id;
        const result = await service.getCourseWeekByIdService(id);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'courseWeekController.js';
        next(error);
    }
};

const updateCourseWeekController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { weekNumber, description, courseId } = req.body;
        const image = req.file;
        await service.updateCourseWeekService(id, weekNumber, image, description, courseId);
        res.status(200).send({ message: "Course Week updated successfully" });
    } catch (error) {
        error.fileName = 'courseWeekController.js';
        next(error);
    }
};

const deleteCourseWeekController = async (req, res, next) => {
    try {
        const id = req.params.id;
        await service.deleteCourseWeekService(id);
        res.status(200).send({ message: "Course Week deleted successfully" });
    } catch (error) {
        error.fileName = 'courseWeekController.js';
        next(error);
    }
};

export default {
    createCourseWeekController,
    getAllCourseWeekController,
    getCourseWeekByIdController,
    updateCourseWeekController,
    deleteCourseWeekController
};
