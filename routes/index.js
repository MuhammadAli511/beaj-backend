import express from 'express';
import internalUsersRoutes from './internalUsersRoutes.js';

const router = express.Router();

// GET  api/status/
router.get('/status', (req, res) => {
    res.status(200).send("App Status : Working");
});

router.use('/internalUsersRoutes', internalUsersRoutes);

export default router;
