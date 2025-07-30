import express from 'express';
import beajFacilitatorsAuth from '../middlewares/beajFacilitatorsAuth.js';
import waUserMetaDataController from '../controllers/waUserMetaDataController.js';
import errorHandler from '../middlewares/errorHandler.js';

const router = express.Router();

// GET  api/waUserMetaData/status
router.get('/status', (req, res) => {
    res.status(200).send("Wa User Meta Data Route Status : Working");
});

// GET  api/waUserMetaData/getAll
router.get('/getAll', beajFacilitatorsAuth, waUserMetaDataController.getAllWaUserMetaDataController);

// GET api/waUserMetaData/getByPhoneNumber/:phoneNumber
router.get('/getByPhoneNumber/:phoneNumber', beajFacilitatorsAuth, waUserMetaDataController.getWaUserMetaDataByPhoneNumberController);

// POST api/waUserMetaData/assignTargetGroup
router.post('/assignTargetGroup', beajFacilitatorsAuth, waUserMetaDataController.assignTargetGroupController);

// POST api/waUserMetaData/update
router.post('/update', beajFacilitatorsAuth, waUserMetaDataController.updateWaUserMetaDataController);

// Use error handler middleware
router.use(errorHandler);

export default router;