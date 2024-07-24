import express from 'express';
import waUserController from '../controllers/waUserController.js';
import errorHandler from '../middlewares/errorHandler.js';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';

const router = express.Router();

// GET /wauser/status
router.get('/status', (req, res) => {
    res.status(200).send("Wa User Route Status : Working");
});

// GET /wauser/getAllWaUsers
router.get('/getAllWaUsers', beajEmployeesAuth, waUserController.getAllWaUsers);


// Use error handler middleware
router.use(errorHandler);

export default router;
