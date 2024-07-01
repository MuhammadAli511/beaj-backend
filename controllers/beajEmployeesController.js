import service from '../services/beajEmployeesService.js'


const loginController = async (req, res, next) => {
    try {
        const email = req.body.email;
        const password = req.body.password;
        const token = await service.loginService(email, password);
        res.status(200).send({ token });
    } catch (error) {
        error.fileName = 'beajEmployeesController.js';
        next(error);
    }
};

const registerController = async (req, res, next) => {
    try {
        const email = req.body.email;
        const password = req.body.password;
        const first_name = req.body.first_name;
        const last_name = req.body.last_name;
        const role = req.body.role;
        const message = await service.registerService(email, password, first_name, last_name, role);
        res.status(200).send({ message: message });
    } catch (error) {
        error.fileName = 'beajEmployeesController.js';
        next(error);
    }
}


export default { loginController, registerController };