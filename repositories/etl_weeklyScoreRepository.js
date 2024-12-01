import sequelize from "../config/sequelize.js";
import WA_UsersMetadata from "../models/WA_UsersMetadata.js";

const getDataFromPostgres = async (grp) => {
  try {

    const res = await WA_UsersMetadata.findAll({
      where : {targetGroup : grp},
      order: [["phoneNumber" , "ASC"]],
    });
    
    return res;
  } catch (error) {
    error.fileName = "etlRepository.js";
    throw error;
  }
};
const getDataActivityComplete = async (date, grp, course_id, weekno) => {
  try {
  
    const qry = `select distinct m."phoneNumber", m."name",count(case when (Date(l."startTime") <= '${date}'
                  and l."completionStatus" = 'Completed') Then 1 else null end)
                  as "activity_completd", (select count(s."LessonId") from "Lesson" s where s."weekNumber" <= ${weekno} and s."courseId" = ${course_id}) as "total_activity",
                  case when count(case when (Date(l."startTime") <= '${date}' and l."completionStatus" = 'Completed') Then 1 else null end) =
                  (select count(s."LessonId") from "Lesson" s where s."weekNumber" <= ${weekno}  and s."courseId" = ${course_id}) then 1 else 0 end as "completion_match"
                  from "wa_users_metadata" m left join "wa_lessons_completed" l on m."phoneNumber" = l."phoneNumber" and l."courseId" = ${course_id}
                  where m."targetGroup" = '${grp}'
                  group by m."name", m."phoneNumber" order by m."phoneNumber" asc;`;


    const res = await sequelize.query(qry);

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

    return res[0];
  } catch (error) {
    error.fileName = "etlRepository.js";
    throw error;
  }
};

export default { getDataFromPostgres, getDataActivityComplete, getWeeklyActivityCompleted };
