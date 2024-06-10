import generateToken from '../utils/generateToken.js'
import beajEmployeesRepository from '../repositories/beajEmployeesRepository.js';
import bcryptjs from 'bcryptjs';

const loginService = async (email, password) => {
    const user = await beajEmployeesRepository.findByEmail(email);
    if (!user || !(await beajEmployeesRepository.validatePassword(user, password))) {
        throw new Error('Invalid credentials - Login Service');
    }
    const token = generateToken(email);
    return token;
};


const registerService = async (email, password, first_name, last_name, role) => {
    if (!email.endsWith('@beaj.org')) {
        throw new Error('Invalid email format. Email must end with @beaj.org - Register Service');
    }

    const existingUser = await beajEmployeesRepository.findByEmail(email);
    if (existingUser) {
        throw new Error('User already exists - Register Service');
    }
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);
    const date_registered = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const user = await beajEmployeesRepository.create(email, hashedPassword, first_name, last_name, role, date_registered);

    if (!user) {
        throw new Error('User not created - Register Service');
    }
    return 'User created';
}



export default { loginService, registerService };