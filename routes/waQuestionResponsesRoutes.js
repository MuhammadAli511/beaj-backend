import express from 'express';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import waQuestionResponsesController from '../controllers/waQuestionResponsesController.js';
import errorHandler from '../middlewares/errorHandler.js';

const router = express.Router();

// GET  api/waQuestionResponses/status
router.get('/status', (req, res) => {
    res.status(200).send("Wa Question Responses Route Status : Working");
});

// GET  api/waQuestionResponses/getAll
router.get('/getAll', beajEmployeesAuth, waQuestionResponsesController.getAllWaQuestionResponsesController);

// GET api/waQuestionResponses/getByActivityType/:activityType
router.get('/getByActivityType/:activityType', beajEmployeesAuth, waQuestionResponsesController.getWaQuestionResponsesByActivityTypeController);

// Use error handler middleware
router.use(errorHandler);

export default router;