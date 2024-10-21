import express from 'express';
import errorHandler from '../middlewares/errorHandler.js';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';

const router = express.Router();

// GET /wauser/status
router.get('/status', (req, res) => {
    res.status(200).send("Wa User Route Status : Working");
});




// Use error handler middleware
router.use(errorHandler);

export default router;
