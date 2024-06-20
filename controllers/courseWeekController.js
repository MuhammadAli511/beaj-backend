import service from '../services/courseWeekService.js';

const createCourseWeekController = async (req, res) => {
    try {
        const weekNumber = req.body.weekNumber;
        const courseId = req.body.courseId;

        await service.createCourseWeekService(weekNumber, courseId);
        res.status(200).send({ message: "Course Week created successfully" });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getAllCourseWeekController = async (req, res) => {
    try {
        const result = await service.getAllCourseWeekService();
        res.status(200).send(result);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getCourseWeekByIdController = async (req, res) => {
    try {
        const id = req.params.id;
        const result = await service.getCourseWeekByIdService(id);
        res.status(200).send(result);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const updateCourseWeekController = async (req, res) => {
    try {
        const id = req.params.id;
        const weekNumber = req.body.weekNumber;
        const image = req.body.image;
        const description = req.body.description;
        const courseId = req.body.courseId;

        await service.updateCourseWeekService(id, weekNumber, image, description, courseId);
        res.status(200).send({ message: "Course Week updated successfully" });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteCourseWeekController = async (req, res) => {
    try {
        const id = req.params.id;
        await service.deleteCourseWeekService(id);
        res.status(200).send({ message: "Course Week deleted successfully" });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export default {
    createCourseWeekController,
    getAllCourseWeekController,
    getCourseWeekByIdController,
    updateCourseWeekController,
    deleteCourseWeekController
};