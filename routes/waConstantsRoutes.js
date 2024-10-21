import express from 'express';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import waConstantsController from '../controllers/waConstantsController.js';
import upload from '../config/multerConfig.js';
import errorHandler from '../middlewares/errorHandler.js';

const router = express.Router();

// GET  api/waConstants/status
router.get('/status', (req, res) => {
    res.status(200).send("WA Constants Route Status : Working");
});

// POST  api/waConstants/create
router.post('/create', beajEmployeesAuth, upload.single('file'), waConstantsController.createWaConstant);

// GET  api/waConstants/getAll
router.get('/getAll', beajEmployeesAuth, waConstantsController.getAllWaConstants);

// GET  api/waConstants/getByKey/:key
router.get('/getByKey/:key', beajEmployeesAuth, waConstantsController.getWaConstantByConstantName);

// PUT  api/waConstants/update/:key
router.put('/update/:key', beajEmployeesAuth, upload.single('file'), waConstantsController.updateWaConstant);

// DELETE  api/waConstants/delete/:key
router.delete('/delete/:key', beajEmployeesAuth, waConstantsController.deleteWaConstant);

// Use error handler middleware
router.use(errorHandler);

export default router;