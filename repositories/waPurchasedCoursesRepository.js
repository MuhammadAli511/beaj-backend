import WA_PurchasedCourses from '../models/WA_PurchasedCourses.js';
import { Op } from 'sequelize';

const create = async (data) => {
    const purchasedCourse = new WA_PurchasedCourses(data);
    return await purchasedCourse.save();
};

const getAll = async () => {
    return await WA_PurchasedCourses.findAll();
};

const getById = async (id) => {
    return await WA_PurchasedCourses.findByPk(id);
};

const update = async (id, data) => {
    return await WA_PurchasedCourses.update(data, {
        where: {
            id: id
        }
    });
};

const deleteById = async (id) => {
    return await WA_PurchasedCourses.destroy({
        where: {
            id: id
        }
    });
};

const getAllByPhoneNumber = async (phoneNumber) => {
    return await WA_PurchasedCourses.findAll({
        where: {
            phoneNumber: phoneNumber
        }
    });
};

const deleteByPhoneNumber = async (phoneNumber) => {
    return await WA_PurchasedCourses.destroy({
        where: {
            phoneNumber: phoneNumber
        }
    });
};

const getPurchasedCoursesByPhoneNumber = async (phoneNumber) => {
    return await WA_PurchasedCourses.findAll({
        where: {
            phoneNumber: phoneNumber,
        }
    });
};

const getPurchasedCoursesByProfileId = async (profileId) => {
    return await WA_PurchasedCourses.findAll({
        where: {
            profile_id: profileId
        }
    });
};

const getPurchasedCount = async () => {
    return await WA_PurchasedCourses.count({
        distinct: true,
        col: 'phoneNumber'
    });
};

const getPurchasedCourseByPaymentStatus = async (paymentStatus) => {
    return await WA_PurchasedCourses.findAll({
        where: {
            paymentStatus: paymentStatus,
            courseStartDate: {
                [Op.gt]: new Date('2025-04-26')
            }
        }
    });
};

const updatePaymentStatusByProfileId = async (profileId, paymentStatus) => {
    return await WA_PurchasedCourses.update({
        paymentStatus: paymentStatus
    }, {
        where: { profile_id: profileId }
    });
};


export default {
    create,
    getAll,
    getById,
    update,
    deleteById,
    getAllByPhoneNumber,
    getPurchasedCoursesByPhoneNumber,
    getPurchasedCount,
    getPurchasedCoursesByProfileId,
    getPurchasedCourseByPaymentStatus,
    updatePaymentStatusByProfileId,
    deleteByPhoneNumber,
};