import BeajEmployees from '../models/BeajEmployees.js';
import bcrypt from 'bcryptjs';

const findByEmail = async (email) => {
    return await BeajEmployees.findOne({ where: { email } });
};

const validatePassword = async (user, password) => {
    return bcrypt.compare(password, user.password);
};

const create = async (email, password, first_name, last_name, role, date_registered) => {
    return await BeajEmployees.create({ email, password, first_name, last_name, role, date_registered });
};


export default { findByEmail, validatePassword, create };