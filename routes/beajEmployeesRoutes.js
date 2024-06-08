import express from 'express';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import beajEmployeesController from '../controllers/beajEmployeesController.js';

const router = express.Router();

// GET  api/beajEmployeesRoutes/status
router.get('/status', (req, res) => {
    res.status(200).send("Internal Users Route Status : Working");
});

// POST api/beajEmployeesRoutes/register
router.post('/register', beajEmployeesAuth, beajEmployeesController.registerController);

// POST api/beajEmployeesRoutes/login
router.post('/login', beajEmployeesAuth, beajEmployeesController.loginController);



export default router;