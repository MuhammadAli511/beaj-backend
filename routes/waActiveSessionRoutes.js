import express from 'express';
import beajFacilitatorsAuth from '../middlewares/beajFacilitatorsAuth.js';
import waActiveSessionController from '../controllers/waActiveSessionController.js';
import errorHandler from '../middlewares/errorHandler.js';

const router = express.Router();

// GET  api/waActiveSession/status
router.get('/status', (req, res) => {
    res.status(200).send("Wa Active Session Route Status : Working");
});

// GET api/waActiveSession/getByPhoneNumberAndBotPhoneNumberId/:phoneNumber/:botPhoneNumberId
router.get('/getByPhoneNumberAndBotPhoneNumberId/:phoneNumber/:botPhoneNumberId', beajFacilitatorsAuth, waActiveSessionController.getWaActiveSessionByPhoneNumberAndBotPhoneNumberIdController);


// Use error handler middleware
router.use(errorHandler);

export default router;