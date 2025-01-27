import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const database = "beajlearner-production-1-5";
const username = process.env.DB_USERNAME;
const password = process.env.DB_PASSWORD;
const host = process.env.DB_HOST;

const prodSequelize = new Sequelize(database, username, password, {
    host: host,
    dialect: 'postgres',
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    },
    logging: false,
    pool: {
        max: 30,
        min: 2,
        idle: 10000,
    }
});

export default prodSequelize;
