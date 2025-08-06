import "./instrument.js";
import * as Sentry from "@sentry/node"
import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();
import sequelize from './config/sequelize.js';
import cors from 'cors';
import cron from 'node-cron';
import routes from './routes/index.js';
import runCumulativeSheets1 from './services/etlService.js';

const port = 8080;

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '500mb' }));
app.use(bodyParser.urlencoded({ limit: '500mb', extended: false }));
app.use(express.static(path.join(path.resolve(), './public')));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Welcome to Beaj!');
});

app.use('/api', routes)

app.get("/debug-sentry", function mainHandler(req, res) {
  throw new Error("My first Sentry error!");
});

Sentry.setupExpressErrorHandler(app);

sequelize.authenticate()
  .then(() => console.log('Database connected.'))
  .catch(err => console.error('Unable to connect to the database:', err));



async function startETLProcess() {
  try {
    console.log("Starting ETL process...");
    const startTimeInitial = new Date();
    await runCumulativeSheets1.runCumulativeSheets();
    const endTimeInitial = new Date();
    const totalTimeInitial = endTimeInitial - startTimeInitial;
    console.log(`Initial ETL process completed in ${totalTimeInitial / 1000} seconds.`);

    // Schedule for every day at 9:00 AM
    cron.schedule("0 9 * * *", async () => {
      console.log("Running scheduled ETL process at 9:00 AM...");
      await runCumulativeSheets1.runCumulativeSheets();
    });

    console.log("ETL schedule set for 9:00 AM daily.");
  } catch (error) {
    console.error("Error during ETL process:", error);
  }
}

app.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  if (process.env.ENVIRONMENT != 'DEV') {
    // startETLProcess();
  }
});
