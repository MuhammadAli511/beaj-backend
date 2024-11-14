import sequelize from "../config/sequelize.js";

const getDataFromPostgres = async () => {
  try {
    const res = await sequelize.query("SELECT * FROM wa_users_metadata");
    // console.log(res[0]);
    return res[0];
  } catch (error) {
    error.fileName = "etlRepository.js";
    throw error;
  }
};

export default { getDataFromPostgres };
