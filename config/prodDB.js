import { Sequelize } from 'sequelize';


const database = process.env.DB_DATABASE;
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
