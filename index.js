import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();
import sequelize from './config/sequelize.js';
import cors from 'cors';
import routes from './routes/index.js';

const port = 8080;

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '500mb' }));
app.use(bodyParser.urlencoded({ limit: '500mb', extended: false }));
app.use(express.static(path.join(path.resolve(), './public')));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.use('/api', routes)

sequelize.authenticate()
  .then(() => console.log('Database connected.'))
  .catch(err => console.error('Unable to connect to the database:', err));

app.listen(port, () => console.log(`Server running on port ${port}`));
