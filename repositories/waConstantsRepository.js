import WA_Constants from '../models/WA_Constants.js';

// Create a new constant
const create = async (key, constantValue, category) => {
    const constant = new WA_Constants({
        key: key,
        constantValue: constantValue,
        category: category
    });
    return await constant.save();
};

// Get all constants
const getAll = async () => {
    return await WA_Constants.findAll();
};

// Get a constant by key
const getByKey = async (key) => {
    return await WA_Constants.findOne({
        where: { key: key }
    });
};

// Update a constant by key
const updateByKey = async (key, constantValue, category) => {
    return await WA_Constants.update(
        {
            constantValue: constantValue,
            category: category,
            updatedAt: new Date()
        },
        {
            where: { key: key }
        }
    );
};

// Delete a constant by key
const deleteByKey = async (key) => {
    return await WA_Constants.destroy({
        where: { key: key }
    });
};

export default {
    create,
    getAll,
    getByKey,
    updateByKey,
    deleteByKey
};
