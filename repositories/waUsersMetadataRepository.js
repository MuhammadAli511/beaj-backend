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

const getByProfileId = async (profileId) => {
    return await WA_UsersMetadata.findOne({
        where: { profile_id: profileId }
    });
};

const getByProfileIds = async (profileIds) => {
    return await WA_UsersMetadata.findAll({
        where: { profile_id: { [Sequelize.Op.in]: profileIds } }
    });
};

const update = async (profileId, phoneNumber, data) => {
    return await WA_UsersMetadata.update(data, {
        where: {
            profile_id: profileId,
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

const assignTargetGroup = async (phoneNumber,profile_id, targetGroup) => {
    if (targetGroup == "None") {
        targetGroup = null;
    }
    return await WA_UsersMetadata.update({
        targetGroup: targetGroup
    }, {
        where: {
            phoneNumber: phoneNumber,
            profile_id: profile_id
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

const updateSchoolName = async (profileId, phoneNumber, schoolName) => {
    return await WA_UsersMetadata.update({
        schoolName: schoolName
    }, {
        where: {
            profile_id: profileId,
            phoneNumber: phoneNumber
        }
    });
};

const updateCityName = async (profileId, phoneNumber, cityName) => {
    return await WA_UsersMetadata.update({
        city: cityName
    }, {
        where: { profile_id: profileId, phoneNumber: phoneNumber }
    });
};

const updateFreeDemoStarted = async (profileId, phoneNumber) => {
    const user = await WA_UsersMetadata.findOne({
        where: { profile_id: profileId, phoneNumber: phoneNumber }
    });

    if (user && user.dataValues.freeDemoStarted === null) {
        return await WA_UsersMetadata.update({
            freeDemoStarted: new Date()
        }, {
            where: { profile_id: profileId, phoneNumber: phoneNumber }
        });
    }
    return user;
};

const updateFreeDemoEnded = async (profileId, phoneNumber) => {
    const user = await WA_UsersMetadata.findOne({
        where: { profile_id: profileId, phoneNumber: phoneNumber }
    });

    if (user && user.dataValues.freeDemoEnded === null) {
        return await WA_UsersMetadata.update({
            freeDemoEnded: new Date()
        }, {
            where: { profile_id: profileId, phoneNumber: phoneNumber }
        });
    }
    return user;
};

const updateClassLevel = async (profileId, phoneNumber, classLevel) => {
    return await WA_UsersMetadata.update({
        classLevel: classLevel
    }, {
        where: { profile_id: profileId, phoneNumber: phoneNumber }
    });
};

const getTotalRegistrationsSummary = async (phoneNumber) => {
    const count = await WA_UsersMetadata.count({
        where: {
            classLevel: {
                [Sequelize.Op.not]: null
            },
            phoneNumber: phoneNumber
        }
    });

    const registrations = await WA_UsersMetadata.findAll({
        attributes: ['name', 'classLevel'],
        where: {
            classLevel: {
                [Sequelize.Op.not]: null
            },
            phoneNumber: phoneNumber
        }
    });

    return {
        count,
        registrations
    };
};


export default {
    create,
    getAll,
    getByPhoneNumber,
    getByProfileId,
    getByProfileIds,
    update,
    deleteByPhoneNumber,
    assignTargetGroup,
    getTotalUsersCount,
    getRegisteredUsersCount,
    getSelectedUsersCount,
    getFreeDemoStartedUsersCount,
    getFreeDemoEndedUsersCount,
    getFilteredUsersWithControlGroupAndCohort,
    updateSchoolName,
    updateCityName,
    updateFreeDemoStarted,
    updateFreeDemoEnded,
    updateClassLevel,
    getTotalRegistrationsSummary
};