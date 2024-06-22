import service from '../services/courseService.js'

const createCourseController = async (req, res) => {
    try {
        const courseName = req.body.courseName;
        const coursePrice = req.body.coursePrice;
        const courseWeeks = req.body.courseWeeks;
        const courseCategoryId = req.body.courseCategoryId;
        const status = req.body.courseStatus;
        const sequenceNumber = req.body.sequenceNumber;
        const courseDescription = req.body.courseDescription;

        await service.createCourseService(courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription);
        res.status(200).send({ message: "Course created successfully" });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getAllCourseController = async (req, res) => {
    try {
        const result = await service.getAllCourseService();
        res.status(200).send(result);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getCourseByIdController = async (req, res) => {
    try {
        const id = req.params.id;
        const result = await service.getCourseByIdService(id);
        res.status(200).send(result);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const updateCourseController = async (req, res) => {
    try {
        const id = req.params.id;
        const courseName = req.body.courseName;
        const coursePrice = req.body.coursePrice;
        const courseWeeks = req.body.courseWeeks;
        const courseCategoryId = req.body.courseCategoryId;
        const status = req.body.status;
        const sequenceNumber = req.body.sequenceNumber;
        const courseDescription = req.body.courseDescription;

        await service.updateCourseService(id, courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription);
        res.status(200).send({ message: "Course updated successfully" });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteCourseController = async (req, res) => {
    try {
        const id = req.params.id;
        await service.deleteCourseService(id);
        res.status(200).send({ message: "Course deleted successfully" });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getCourseByCourseCategoryIdController = async (req, res) => {
    try {
        const id = req.params.id;
        const result = await service.getCourseByCourseCategoryIdService(id);
        res.status(200).send(result);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export default {
    createCourseController,
    getAllCourseController,
    getCourseByIdController,
    updateCourseController,
    deleteCourseController,
    getCourseByCourseCategoryIdController
};