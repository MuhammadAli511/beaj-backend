import express from 'express';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import documentFilesController from '../controllers/documentFilesController.js';
import upload from '../config/multerConfig.js';


const router = express.Router();

// GET  api/documentFiles/status
router.get('/status', (req, res) => {
    res.status(200).send("DocumentFiles Route Status : Working");
});

// POST api/documentFiles/create
router.post('/create',
    beajEmployeesAuth,
    upload.fields([
        { name: 'file', maxCount: 1 }
    ]),
    documentFilesController.createDocumentFilesController
);

// GET  api/documentFiles/getAll
router.get('/getAll', beajEmployeesAuth, documentFilesController.getAllDocumentFilesController);

// GET  api/documentFiles/getById/:id
router.get('/getById/:id', beajEmployeesAuth, documentFilesController.getDocumentFilesByIdController);

// PUT  api/documentFiles/update/:id
router.put('/update/:id',
    beajEmployeesAuth,
    upload.fields([
        { name: 'file', maxCount: 1 }
    ]),
    documentFilesController.updateDocumentFilesController
);

// DELETE  api/documentFiles/delete/:id
router.delete('/delete/:id', beajEmployeesAuth, documentFilesController.deleteDocumentFilesController);


export default router;