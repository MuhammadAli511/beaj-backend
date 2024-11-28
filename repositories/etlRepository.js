import sequelize from "../config/sequelize.js";
import { Op, Sequelize } from "sequelize";
import WA_UsersMetadata from "../models/WA_UsersMetadata.js";

const getDataFromPostgres = async () => {
  try {

    const res = await WA_UsersMetadata.findAll();
    
    return res;
  } catch (error) {
    error.fileName = "etlRepository.js";
    throw error;
  }
};

export default { getDataFromPostgres };
