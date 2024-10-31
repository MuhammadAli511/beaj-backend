import service from '../services/courseService.js';

const createCourseController = async (req, res, next) => {
    try {
        const { courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription, courseStartDate } = req.body;
        await service.createCourseService(courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription, courseStartDate);
        res.status(200).send({ message: "Course created successfully" });
    } catch (error) {
        error.fileName = 'courseController.js';
        next(error);
    }
};

const getAllCourseController = async (req, res, next) => {
    try {
        const result = await service.getAllCourseService();
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'courseController.js';
        next(error);
    }
};

const getCourseByIdController = async (req, res, next) => {
    try {
        const id = req.params.id;
        const result = await service.getCourseByIdService(id);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'courseController.js';
        next(error);
    }
};

const updateCourseController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription, courseStartDate } = req.body;
        await service.updateCourseService(id, courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription, courseStartDate);
        res.status(200).send({ message: "Course updated successfully" });
    } catch (error) {
        error.fileName = 'courseController.js';
        next(error);
    }
};

const deleteCourseController = async (req, res, next) => {
    try {
        const id = req.params.id;
        await service.deleteCourseService(id);
        res.status(200).send({ message: "Course deleted successfully" });
    } catch (error) {
        error.fileName = 'courseController.js';
        next(error);
    }
};

const getCourseByCourseCategoryIdController = async (req, res, next) => {
    try {
        const id = req.params.id;
        const result = await service.getCourseByCourseCategoryIdService(id);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'courseController.js';
        next(error);
    }
};

const duplicateCourseController = async (req, res, next) => {
    try {
        const { courseId } = req.body;
        await service.duplicateCourseService(courseId);
        res.status(200).send({ message: "Course duplicated successfully" });
    } catch (error) {
        error.fileName = 'courseController.js';
        next(error);
    }
};

export default {
    createCourseController,
    getAllCourseController,
    getCourseByIdController,
    updateCourseController,
    deleteCourseController,
    getCourseByCourseCategoryIdController,
    duplicateCourseController
};
