import WA_UsersMetadata from '../models/WA_UsersMetadata.js';
import Sequelize from 'sequelize';

const create = async (data) => {
    const userMetadata = new WA_UsersMetadata(data);
    return await userMetadata.save();
};

const getAll = async () => {
    return await WA_UsersMetadata.findAll({
        order: [['userRegistrationComplete', 'ASC']],
    });
};

const getByPhoneNumber = async (phoneNumber) => {
    return await WA_UsersMetadata.findByPk(phoneNumber);
};

const update = async (phoneNumber, data) => {
    return await WA_UsersMetadata.update(data, {
        where: {
            phoneNumber: phoneNumber
        }
    });
};

const deleteByPhoneNumber = async (phoneNumber) => {
    return await WA_UsersMetadata.destroy({
        where: {
            phoneNumber: phoneNumber
        }
    });
};

const assignTargetGroup = async (phoneNumber, targetGroup) => {
    if (targetGroup == "None") {
        targetGroup = null;
    }
    return await WA_UsersMetadata.update({
        targetGroup: targetGroup
    }, {
        where: {
            phoneNumber: phoneNumber
        }
    });
};

const getTotalUsersCount = async () => {
    return await WA_UsersMetadata.count();
};

const getRegisteredUsersCount = async () => {
    return await WA_UsersMetadata.count({
        where: {
            userRegistrationComplete: {
                [Sequelize.Op.not]: null
            },
        }
    });
};

const getSelectedUsersCount = async () => {
    return await WA_UsersMetadata.count({
        where: {
            targetGroup: {
                [Sequelize.Op.or]: ['T1', 'T2']
            }
        }
    });
};

const getFreeDemoStartedUsersCount = async () => {
    return await WA_UsersMetadata.count({
        where: {
            freeDemoStarted: {
                [Sequelize.Op.not]: null
            },
        }
    });
};

const getFreeDemoEndedUsersCount = async () => {
    return await WA_UsersMetadata.count({
        where: {
            freeDemoEnded: {
                [Sequelize.Op.not]: null
            },
        }
    });
};

const getFilteredUsersWithControlGroupAndCohort = async (cohorts) => {
    if (cohorts.includes("All")) {
        return await WA_UsersMetadata.findAll({
            where: {
                targetGroup: {
                    [Sequelize.Op.in]: ["T1", "T2"]
                },
                cohort: {
                    [Sequelize.Op.not]: null
                }
            }
        });
    }
    return await WA_UsersMetadata.findAll({
        where: {
            cohort: {
                [Sequelize.Op.in]: cohorts
            },
            targetGroup: {
                [Sequelize.Op.in]: ["T1", "T2"]
            }
        }
    });
};

const getByPhoneNumbers = async (phoneNumbers) => {
    return await WA_UsersMetadata.findAll({
        where: {
            phoneNumber: {
                [Sequelize.Op.in]: phoneNumbers
            }
        }
    });
};

const updateSchoolName = async (phoneNumber, schoolName) => {
    return await WA_UsersMetadata.update({
        schoolName: schoolName
    }, {
        where: { phoneNumber: phoneNumber }
    });
};

export default {
    create,
    getAll,
    getByPhoneNumber,
    update,
    deleteByPhoneNumber,
    assignTargetGroup,
    getTotalUsersCount,
    getRegisteredUsersCount,
    getSelectedUsersCount,
    getFreeDemoStartedUsersCount,
    getFreeDemoEndedUsersCount,
    getFilteredUsersWithControlGroupAndCohort,
    getByPhoneNumbers,
    updateSchoolName
};