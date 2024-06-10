import express from 'express';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import statsController from '../controllers/statsController.js';


const router = express.Router();

// GET  api/stats/status
router.get('/status', (req, res) => {
    res.status(200).send("Stats Route Status : Working");
});

// GET  api/stats/totalContentStats
router.get('/totalContentStats', beajEmployeesAuth, statsController.totalContentStatsController);



export default router;