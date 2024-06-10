import express from 'express';
import beajEmployeesController from '../controllers/beajEmployeesController.js';

const router = express.Router();

// GET  api/beajEmployees/status
router.get('/status', (req, res) => {
    res.status(200).send("Beaj Employees Route Status : Working");
});

// POST api/beajEmployees/register
router.post('/register', beajEmployeesController.registerController);

// POST api/beajEmployees/login
router.post('/login', beajEmployeesController.loginController);



export default router;