import express from 'express';
import beajFacilitatorsAuth from '../middlewares/beajFacilitatorsAuth.js';
import waUserActivityLogsController from '../controllers/waUserActivityLogsController.js';
import errorHandler from '../middlewares/errorHandler.js';

const router = express.Router();

// GET  api/waUserActivityLogs/status
router.get('/status', (req, res) => {
    res.status(200).send("Wa User Activity Logs Route Status : Working");
});

// GET  api/waUserActivityLogs/getAll
router.get('/getAll', beajFacilitatorsAuth, waUserActivityLogsController.getAllWaUserActivityLogsController);

// GET api/waUserActivityLogs/getByPhoneNumber/:phoneNumber?page=1&pageSize=15
// @param {string} phoneNumber - The phone number to get logs for
// @query {number} [page=1] - The page number for pagination
// @query {number} [pageSize=15] - The number of logs per page
router.get('/getByPhoneNumber/:phoneNumber', beajFacilitatorsAuth, waUserActivityLogsController.getWaUserActivityLogByPhoneNumberController);

// Use error handler middleware
router.use(errorHandler);

export default router;