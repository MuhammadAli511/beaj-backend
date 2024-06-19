import express from 'express';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import aliasController from '../controllers/aliasController.js';

const router = express.Router();

// GET  api/alias/status
router.get('/status', (req, res) => {
    res.status(200).send("Alias Route Status : Working");
});

// POST  api/alias/create
router.post('/create', beajEmployeesAuth, aliasController.createAliasController);

// GET  api/alias/getAll
router.get('/getAll', beajEmployeesAuth, aliasController.getAllAliasController);

// GET  api/alias/getById/:id
router.get('/getById/:id', beajEmployeesAuth, aliasController.getAliasByIdController);

// PUT  api/alias/update/:id
router.put('/update/:id', beajEmployeesAuth, aliasController.updateAliasController);

// DELETE  api/alias/delete/:id
router.delete('/delete/:id', beajEmployeesAuth, aliasController.deleteAliasController);

export default router;