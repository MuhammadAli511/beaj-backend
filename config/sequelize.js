import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();

const database = process.env.db_database;
const username = process.env.db_username;
const password = process.env.db_password;
const host = process.env.db_host;


const sequelize = new Sequelize(database, username, password, {
  host: host,
  dialect: 'postgres'
});

export default sequelize;
