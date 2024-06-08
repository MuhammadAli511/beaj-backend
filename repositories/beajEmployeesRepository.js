import BeajEmployees from '../models/BeajEmployees.js';
import bcrypt from 'bcryptjs';

const findByEmail = async (email) => {
    return await BeajEmployees.findOne({ where: { email } });
};

const validatePassword = async (user, password) => {
    return bcrypt.compare(password, user.password);
};


export default { findByEmail, validatePassword };