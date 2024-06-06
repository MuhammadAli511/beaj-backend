import express from 'express';
import interalUsersAuth from '../middlewares/internalUsersAuth.js';
import internalUsersController from '../controllers/internalUsersController.js';

const router = express.Router();

// GET  api/internalUsersRoutes/status
router.get('/status', (req, res) => {
    res.status(200).send("Internal Users Route Status : Working");
});


// POST api/internalUsersRoutes/login
router.post('/login', interalUsersAuth, internalUsersController.loginController);



export default router;