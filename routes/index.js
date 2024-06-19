import express from 'express';
import beajEmployeesRoutes from './beajEmployeesRoutes.js';
import statsRoutes from './statsRoutes.js';
import courseCategoryRoutes from './courseCategoryRoutes.js';
import courseRoutes from './courseRoutes.js';

const router = express.Router();

// GET  api/status/
router.get('/status', (req, res) => {
    res.status(200).send("App Status : Working");
});

router.use('/beajEmployees', beajEmployeesRoutes);
router.use('/stats', statsRoutes);
router.use('/courseCategory', courseCategoryRoutes);
router.use('/course', courseRoutes);

export default router;
