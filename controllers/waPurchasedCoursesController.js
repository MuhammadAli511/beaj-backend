import service from '../services/waPurchasedCoursesService.js';

const getAllCoursesByProfileIdController = async (req, res, next) => {
    try {
        const profileId = req.params.profileId;
        const result = await service.getAllCoursesByProfileIdService(profileId);
        res.status(200).send(result);
    }
    catch (error) {
        error.fileName = 'waPurchasedCoursesController.js';
        next(error);
    }
};

const getPurchasedCoursesByProfileIdController = async (req, res, next) => {
    try {
        const profileId = req.params.profileId;
        const result = await service.getPurchasedCoursesByProfileIdService(profileId);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'waPurchasedCoursesController.js';
        next(error);
    }
};

const getUnpurchasedCoursesByProfileIdController = async (req, res, next) => {
    try {
        const profileId = req.params.profileId;
        const result = await service.getUnpurchasedCoursesByProfileIdService(profileId);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'waPurchasedCoursesController.js';
        next(error);
    }
};

const purchaseCourseController = async (req, res, next) => {
    try {
        const phoneNumber = req.body.phoneNumber;
        const courseId = req.body.courseId;
        const profileId = req.body.profile_id;
        await service.purchaseCourseService(phoneNumber, profileId,courseId);
        res.status(200).send({ message: "Course purchased successfully" });
    } catch (error) {
        error.fileName = 'waPurchasedCoursesController.js';
        next(error);
    }
};

const getCompletedCourseController = async (req, res, next) => {
    try {
        const profileId = req.params.profileId;
        const result = await service.getCompletedCourseService(profileId);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'waPurchasedCoursesController.js';
        next(error);
    }
};


export default {
    getPurchasedCoursesByProfileIdController,
    getUnpurchasedCoursesByProfileIdController,
    purchaseCourseController,
    getCompletedCourseController,
    getAllCoursesByProfileIdController
};