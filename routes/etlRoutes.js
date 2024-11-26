import express from "express";
import etlController from "../controllers/etlController.js";
import errorHandler from "../middlewares/errorHandler.js";

const router = express.Router();

router.get("/status", (req, res) => {
  res.status(200).send("Beaj Employees Route Status : Working");
});

router.get("/run-etl", etlController.runETL);

router.use(errorHandler);

export default router;
