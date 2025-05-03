import express from 'express';
import beajFacilitatorsAuth from '../middlewares/beajFacilitatorsAuth.js';
import userProgressController from '../controllers/userProgressController.js';
import errorHandler from '../middlewares/errorHandler.js';

const router = express.Router();

// GET  api/userProgress/status
router.get('/status', (req, res) => {
    res.status(200).send("Wa Progress Route Status : Working");
});

// GET  api/userProgress/getAll
router.get('/getAllUserProgressData', beajFacilitatorsAuth, userProgressController.getAllUserProgressController);

// GET  api/userProgress/getAll
router.get('/getUserProgressLeaderboard', beajFacilitatorsAuth, userProgressController.getUserProgressLeaderboardController);


// Use error handler middleware
router.use(errorHandler);

export default router;