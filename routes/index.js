import express from 'express';
import beajEmployeesRoutes from './beajEmployeesRoutes.js';

const router = express.Router();

// GET  api/status/
router.get('/status', (req, res) => {
    res.status(200).send("App Status : Working");
});

router.use('/beajEmployeesRoutes', beajEmployeesRoutes);

export default router;
