import service from '../services/beajEmployeesService.js'


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

const registerController = async (req, res) => {
    try {
        const email = req.body.email;
        const password = req.body.password;
        const first_name = req.body.first_name;
        const last_name = req.body.last_name;
        const role = req.body.role;
        const message = await service.registerService(email, password, first_name, last_name, role);
        res.status(200).send({ message: message });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
}


export default { loginController, registerController };