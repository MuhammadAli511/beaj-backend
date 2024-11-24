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

const getWeeklyActivityCompleted = async (grp, course_id) => {
  try {
    const qry = `select m."phoneNumber", m."name", sum(case when s."weekNumber" = 1 then 1 else null end) as "week1_activities",
                sum(case when s."weekNumber" = 2 then 1 else null end) as "week2_activities",
                sum(case when s."weekNumber" = 3 then 1 else null end) as "week3_activities",
                sum(case when s."weekNumber" = 4 then 1 else null end) as "week4_activities",
                (select count(s1."LessonId") from "Lesson" s1 where s1."weekNumber" = 1 and s1."courseId" = ${course_id}) as "total_activity1",
                case when sum(case when s."weekNumber" = 1 then 1 else null end) = (select count(s1."LessonId") from "Lesson" s1 where s1."weekNumber" = 1 and s1."courseId" = ${course_id})
                then 1 else null end as "completion_match1",
                case when sum(case when s."weekNumber" = 2 then 1 else null end) = (select count(s1."LessonId") from "Lesson" s1 where s1."weekNumber" = 2 and s1."courseId" = ${course_id})
                then 1 else null end as "completion_match2",
                case when sum(case when s."weekNumber" = 3 then 1 else null end) = (select count(s1."LessonId") from "Lesson" s1 where s1."weekNumber" = 3 and s1."courseId" = ${course_id})
                then 1 else null end as "completion_match3",
                case when sum(case when s."weekNumber" = 4 then 1 else null end) = (select count(s1."LessonId") from "Lesson" s1 where s1."weekNumber" = 4 and s1."courseId" = ${course_id})
                then 1 else null end as "completion_match4"
                from "wa_users_metadata" m left join "wa_lessons_completed" l on m."phoneNumber" = l."phoneNumber" 
                and l."completionStatus" = 'Completed' left join "Lesson" s on s."LessonId" = l."lessonId" and s."courseId" = l."courseId" and s."courseId" = ${course_id}
                and s."weekNumber" IN (1,2,3,4) where m."targetGroup" = '${grp}' group by m."name", m."phoneNumber" order by m."phoneNumber" asc;`;

    const res = await sequelize.query(qry);

    // console.log(res[0]);
    return res[0];
  } catch (error) {
    error.fileName = "etlRepository.js";
    throw error;
  }
};



// SELECT 
//     m."phoneNumber",
//     m."name",
//     SUM(CASE WHEN s."weekNumber" = 1 THEN 1 ELSE 0 END) AS "week1_activities",
//     SUM(CASE WHEN s."weekNumber" = 2 THEN 1 ELSE 0 END) AS "week2_activities",
//     SUM(CASE WHEN s."weekNumber" = 3 THEN 1 ELSE 0 END) AS "week3_activities",
//     SUM(CASE WHEN s."weekNumber" = 4 THEN 1 ELSE 0 END) AS "week4_activities"
// FROM 
//     "wa_users_metadata" m
// LEFT JOIN 
//     "wa_lessons_completed" l 
// ON 
//     m."phoneNumber" = l."phoneNumber" and l."completionStatus" = 'Completed'
// LEFT JOIN 
//     "Lesson" s 
// ON 
//     s."LessonId" = l."lessonId" 
//     AND s."courseId" = l."courseId"
// 	AND s."courseId" = 99
//     AND s."weekNumber" IN (1, 2, 3, 4)
// WHERE 
//     m."targetGroup" = 'T2' 
// GROUP BY 
//     m."phoneNumber", 
//     m."name"
// ORDER BY 
//     m."phoneNumber" ASC;

export default { getDataFromPostgres, getDataActivityComplete, getWeeklyActivityCompleted };
