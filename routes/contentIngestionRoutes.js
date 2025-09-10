import express from 'express';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import contentIngestionController from '../controllers/contentIngestionController.js';
import errorHandler from '../middlewares/errorHandler.js';

const router = express.Router();

// GET  api/contentIngestion/status
router.get('/status', (req, res) => {
    res.status(200).send("Content Ingestion Route Status : Working");
});


// POST api/contentIngestion/validateIngestion
router.post('/validateIngestion', beajEmployeesAuth, contentIngestionController.validateIngestionController);

// POST api/contentIngestion/processIngestion
router.post('/processIngestion', beajEmployeesAuth, contentIngestionController.processIngestionController);


// Use error handler middleware
router.use(errorHandler);

export default router;