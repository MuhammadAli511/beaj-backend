import express from 'express';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import waUserMetaDataController from '../controllers/waUserMetaDataController.js';
import errorHandler from '../middlewares/errorHandler.js';

const router = express.Router();

// GET  api/waUserMetaData/status
router.get('/status', (req, res) => {
    res.status(200).send("Wa User Meta Data Route Status : Working");
});

// GET  api/waUserMetaData/getAll
router.get('/getAll', beajEmployeesAuth, waUserMetaDataController.getAllWaUserMetaDataController);

// GET api/waUserMetaData/getByPhoneNumber/:phoneNumber
router.get('/getByPhoneNumber/:phoneNumber', beajEmployeesAuth, waUserMetaDataController.getWaUserMetaDataByPhoneNumberController);


// Use error handler middleware
router.use(errorHandler);

export default router;