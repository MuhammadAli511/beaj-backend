import generateToken from '../utils/generateToken.js'
import beajEmployeesRepository from '../repositories/beajEmployeesRepository.js';

const loginService = async (email, password) => {
    const user = await beajEmployeesRepository.findByEmail(email);
    if (!user || !(await userRepository.validatePassword(user, password))) {
        throw new Error('Invalid credentials');
    }
    const token = generateToken(email);
    return token;
};


export default { loginService };