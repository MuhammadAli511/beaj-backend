import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();
import sequelize from './config/sequelize.js';
import cors from 'cors';
import routes from './routes/index.js';
import etlController from './controllers/etlController.js';

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

sequelize.authenticate()
  .then(() => console.log('Database connected.'))
  .catch(err => console.error('Unable to connect to the database:', err));

async function startETLProcess() {
  try {
    console.log("Starting ETL process...");
    const startTimeInitial = new Date();
    await etlController.runETL();
    const endTimeInitial = new Date();
    const totalTimeInitial = endTimeInitial - startTimeInitial;
    console.log(
      `Initial ETL process completed in ${totalTimeInitial / 1000} seconds.`
    );
    console.log("ETL process completed successfully.");
    setInterval(async () => {
      try {
        console.log("Starting ETL process...");
        const startTimeInitial = new Date();
        await etlController.runETL();
        const endTimeInitial = new Date();
        const totalTimeInitial = endTimeInitial - startTimeInitial;
        console.log(
          `Initial ETL process completed in ${totalTimeInitial / 1000} seconds.`
        );
        console.log("ETL process completed successfully.");
      } catch (error) {
        console.error("Error during ETL process:", error);
      }
    }, 3600000);
    //3600000
  } catch (error) {
    console.error("Error during ETL process:", error);
  }
}
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  if (process.env.ENVIRONMENT != 'DEV') {
    // startETLProcess();
  }
});
