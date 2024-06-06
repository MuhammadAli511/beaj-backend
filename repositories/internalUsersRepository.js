import InternalUsers from '../models/InternalUsers.js';
import bcrypt from 'bcryptjs';

const findByEmail = async (email) => {
    return await InternalUsers.findOne({ where: { email } });
};

const validatePassword = async (user, password) => {
    return bcrypt.compare(password, user.password);
};


export default { findByEmail, validatePassword };