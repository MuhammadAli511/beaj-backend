import sequelize from "../config/sequelize.js";

const getDataFromPostgres = async (date, grp, course_id) => {
  try {
    const qry =
      `select m."phoneNumber", m."name",count(case when (Date(l."startTime") <= ` +
      `'${date}'` +
      ` and l."completionStatus" = 'Completed') Then 1 else null end) ` +
      `as "activity_completd" from "wa_users_metadata" m left join "wa_lessons_completed" l on m."phoneNumber" = l."phoneNumber" and l."courseId" = ${course_id} ` +
      `where m."targetGroup" = ` +
      `'${grp}' ` +
      ` group by m."name", m."phoneNumber" order by m."phoneNumber" asc;`;

    // const qry = `select * from "wa_users_metadata" m where m."targetGroup" = 'T2';`;

    const res = await sequelize.query(qry);

    // console.log(res[0]);
    return res[0];
  } catch (error) {
    error.fileName = "etlRepository.js";
    throw error;
  }
};

export default { getDataFromPostgres };