import service from '../services/waPurchasedCoursesService.js';

const getAllCoursesByPhoneNumberController = async (req, res, next) => {
    try {
        const phoneNumber = req.params.phoneNumber;
        const result = await service.getAllCoursesByPhoneNumberService(phoneNumber);
        res.status(200).send(result);
    }
    catch (error) {
        error.fileName = 'waPurchasedCoursesController.js';
        next(error);
    }
};

const getPurchasedCoursesByPhoneNumberController = async (req, res, next) => {
    try {
        const phoneNumber = req.params.phoneNumber;
        const result = await service.getPurchasedCoursesByPhoneNumberService(phoneNumber);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'waPurchasedCoursesController.js';
        next(error);
    }
};

const getUnpurchasedCoursesByPhoneNumberController = async (req, res, next) => {
    try {
        const phoneNumber = req.params.phoneNumber;
        const result = await service.getUnpurchasedCoursesByPhoneNumberService(phoneNumber);
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
        const result = await service.purchaseCourseService(phoneNumber, courseId);
        res.status(200).send({ message: "Course purchased successfully" });
    } catch (error) {
        error.fileName = 'waPurchasedCoursesController.js';
        next(error);
    }
};

const getCompletedCourseController = async (req, res, next) => {
    try {
        const phoneNumber = req.params.phoneNumber;
        const result = await service.getCompletedCourseService(phoneNumber);
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'waPurchasedCoursesController.js';
        next(error);
    }
};


export default {
    getPurchasedCoursesByPhoneNumberController,
    getUnpurchasedCoursesByPhoneNumberController,
    purchaseCourseController,
    getCompletedCourseController,
    getAllCoursesByPhoneNumberController
};