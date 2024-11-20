import sequelize from "../config/sequelize.js";

const getDataFromPostgres = async (grp) => {
  try {
    // const qry =
    //   `select m."phoneNumber",m."name", COALESCE(SUM(array_length(array_positions(q."correct", 't'), 1)), 0) AS "correct_answers" from
    //    "wa_users_metadata" m left join "wa_lessons_completed" l on m."phoneNumber" = l."phoneNumber" and l."completionStatus" = 'Completed'
    //    and l."courseId" = ` +
    //   `'${courseid}'` +
    //   `left join "wa_question_responses" q on l."phoneNumber" = q."phoneNumber"  and l."lessonId" = q."lessonId"
    //    and Date(q."submissionDate") between ` +
    //   `'${startdate}'` +
    //   ` and ` +
    //   `'${enddate}'` +
    //   ` where m."targetGroup" = ` +
    //   `'${grp}'` +
    //   ` group by
    //    m."phoneNumber",m."name" order by m."phoneNumber" asc;`;

    const qry = `select * from "wa_users_metadata" where "targetGroup" = '${grp}' order by "phoneNumber" asc;`;

    const res = await sequelize.query(qry);

    // console.log(res[0]);
    return res[0];
  } catch (error) {
    error.fileName = "etlRepository.js";
    throw error;
  }
};

const getDataActivityComplete = async (date, grp, course_id, weekno) => {
  try {
    // const qry =
    //   `select m."phoneNumber", m."name",count(case when (Date(l."startTime") <= ` +
    //   `'${date}'` +
    //   ` and l."completionStatus" = 'Completed') Then 1 else null end) ` +
    //   `as "activity_completd" from "wa_users_metadata" m left join "wa_lessons_completed" l on m."phoneNumber" = l."phoneNumber" and l."courseId" = ${course_id} ` +
    //   `where m."targetGroup" = ` +
    //   `'${grp}' ` +
    //   ` group by m."name", m."phoneNumber" order by m."phoneNumber" asc;`;

    const qry = `select distinct m."phoneNumber", m."name",count(case when (Date(l."startTime") <= '${date}'
                  and l."completionStatus" = 'Completed') Then 1 else null end)
                  as "activity_completd", (select count(s."LessonId") from "Lesson" s where s."weekNumber" <= ${weekno} and s."courseId" = ${course_id}) as "total_activity",
                  case when count(case when (Date(l."startTime") <= '${date}' and l."completionStatus" = 'Completed') Then 1 else null end) =
                  (select count(s."LessonId") from "Lesson" s where s."weekNumber" <= ${weekno}  and s."courseId" = ${course_id}) then 1 else 0 end as "completion_match"
                  from "wa_users_metadata" m left join "wa_lessons_completed" l on m."phoneNumber" = l."phoneNumber" and l."courseId" = ${course_id}
                  where m."targetGroup" = '${grp}'
                  group by m."name", m."phoneNumber" order by m."phoneNumber" asc;`;

    // const qry = `select * from "wa_users_metadata" m where m."targetGroup" = 'T2';`;

    const res = await sequelize.query(qry);

    // console.log(res[0]);
    return res[0];
  } catch (error) {
    error.fileName = "etlRepository.js";
    throw error;
  }
};

export default { getDataFromPostgres, getDataActivityComplete };
