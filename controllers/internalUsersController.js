import service from '../services/internalUsersService.js'


const loginController = async (req, res) => {
    try {
        const email = req.body.email;
        const password = req.body.password;
        const token = await service.loginService(email, password);
        res.status(200).send({ token });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};


export default { loginController };