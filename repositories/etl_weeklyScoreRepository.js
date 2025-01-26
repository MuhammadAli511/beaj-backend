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
const getDataActivityComplete = async (date, grp, course_id, weekno,cohort) => {
  try {
  
    const qry = `select distinct m."phoneNumber", m."name",count(case when (Date(l."startTime") <= '${date}'
                  and l."completionStatus" = 'Completed') Then 1 else null end)
                  as "activity_completd", (select count(s."LessonId") from "Lesson" s where s."weekNumber" <= ${weekno} and s."courseId" = ${course_id}) as "total_activity",
                  case when count(case when (Date(l."startTime") <= '${date}' and l."completionStatus" = 'Completed') Then 1 else null end) =
                  (select count(s."LessonId") from "Lesson" s where s."weekNumber" <= ${weekno}  and s."courseId" = ${course_id}) then 1 else 0 end as "completion_match"
                  from "wa_users_metadata" m left join "wa_lessons_completed" l on m."phoneNumber" = l."phoneNumber" and l."courseId" = ${course_id}
                  where m."targetGroup" = '${grp}' and m."cohort" = '${cohort}'
                  group by m."name", m."phoneNumber" order by m."phoneNumber" asc;`;


    const res = await sequelize.query(qry);

    return res[0];
  } catch (error) {
    error.fileName = "etlRepository.js";
    throw error;
  }
};

const getWeeklyActivityCompleted = async (grp, course_id,cohort) => {
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
                and s."weekNumber" IN (1,2,3,4) where m."targetGroup" = '${grp}' and m."cohort" = '${cohort}' group by m."name", m."phoneNumber" order by m."phoneNumber" asc;`;

    const res = await sequelize.query(qry);

    return res[0];
  } catch (error) {
    error.fileName = "etlRepository.js";
    throw error;
  }
};

const getUserMetadataAll = async (cohort) => {
  try {
    let cohortCondition;

    if (cohort === 'Control') {
      cohortCondition = `"targetGroup" = 'Control'`; 
    } 
    else {
      if (cohort === 'Pilot') {
        cohortCondition = `("targetGroup" = 'T1' OR "targetGroup" = 'T2') and "cohort" = 'Pilot'`; 
      } else {
        const cohortList = [];
        for (let i = 1; i <= 48; i++) {
          cohortList.push(`'Cohort ${i}'`);
        }
        cohortCondition = `("targetGroup" = 'T1' OR "targetGroup" = 'T2') and ("cohort" = ${cohortList.join(' OR "cohort" = ')})`; 
      }
    }
    const qry = `
      SELECT 
        "userId",
        "phoneNumber", 
        name, 
        city, 
        "targetGroup", 
        cohort, 
        TO_CHAR("userClickedLink" AT TIME ZONE 'UTC', 'MM/DD/YYYY HH12:MI:SS AM') AS "userClickedLink_utc",
        TO_CHAR("userRegistrationComplete" AT TIME ZONE 'UTC', 'MM/DD/YYYY HH12:MI:SS AM') AS "userRegistrationComplete_utc",
        "isTeacher", 
        "schoolName",
        TO_CHAR("freeDemoStarted" AT TIME ZONE 'UTC', 'MM/DD/YYYY HH12:MI:SS AM') AS "freeDemoStarted_utc",
        TO_CHAR("freeDemoEnded" AT TIME ZONE 'UTC', 'MM/DD/YYYY HH12:MI:SS AM') AS "freeDemoEnded_utc",
        scholarshipvalue, 
        "timingPreference"
      FROM 
        "wa_users_metadata"
      WHERE 
         ${cohortCondition} 
      ORDER BY 
        "targetGroup", "cohort";
    `;

    const res = await sequelize.query(qry);

    return res[0];
  } catch (error) {
    error.fileName = "etlRepository.js";
    throw error;
  }
};

const getUserMetadataTime = async () => {
  try {
    const qry = `
      SELECT 
        TO_CHAR("userClickedLink" AT TIME ZONE 'UTC', 'MM/DD/YYYY HH12:MI:SS AM') AS "userClickedLink_utc",
        TO_CHAR("userRegistrationComplete" AT TIME ZONE 'UTC', 'MM/DD/YYYY HH12:MI:SS AM') AS "userRegistrationComplete_utc"
      FROM 
        "wa_users_metadata";`;

    const res = await sequelize.query(qry);

    return res[0];
  } catch (error) {
    error.fileName = "etlRepository.js";
    throw error;
  }
};

const getLessonCompletions = async (course_id1,course_id2,course_id3,grp) => {
  try {

    var offsetT1 = 0;

    if (grp == 'T2') {
        const qryT1 = `
        SELECT COUNT(DISTINCT m."phoneNumber") AS totalT1
        FROM "wa_users_metadata" m
        WHERE m."targetGroup" = 'T1' and m."cohort" != 'Pilot';
      `;
      const resT1 = await sequelize.query(qryT1);

      if (resT1[0] && resT1[0][0]) {
        offsetT1 = resT1[0][0].totalt1 || 0; 
      } else {
        console.log("No records found for targetGroup 'T1' and cohort not 'Pilot'.");
        offsetT1 = 0;  
      }
    }
  
    const qry = `WITH LessonAssignments AS (
    SELECT
        "courseId",
        "weekNumber",
        "dayNumber",
        COUNT("LessonId") AS "TotalLessons"
    FROM
        "Lesson"
    WHERE
        "courseId" IN (${course_id1},${course_id2},${course_id3}) 
    GROUP BY
        "courseId", "weekNumber", "dayNumber"
),
Students AS (
    SELECT DISTINCT
        m."phoneNumber",
		m."name",
        m."cohort",
        m."targetGroup"
    FROM
        "wa_users_metadata" m
    WHERE
        m."targetGroup" = '${grp}' and m."cohort" != 'Pilot'
),
AllCombinations AS (
    SELECT
        s."phoneNumber",
        s."cohort",
        s."targetGroup",
		s."name",
        la."courseId",
        la."weekNumber",
        la."dayNumber"
    FROM
        Students s
    CROSS JOIN
        LessonAssignments la
),
StudentCompletions AS (
    SELECT
        m."phoneNumber",
		    m."name",
        m."cohort",
        m."targetGroup",
        s."courseId",
        s."weekNumber",
        s."dayNumber",
        COUNT(l."lessonId") AS "CompletedLessons"
    FROM
        "wa_users_metadata" m
    LEFT JOIN
        "wa_lessons_completed" l 
        ON m."phoneNumber" = l."phoneNumber" AND l."completionStatus" = 'Completed'
    LEFT JOIN
        "Lesson" s 
        ON s."LessonId" = l."lessonId" AND s."courseId" = l."courseId"
    WHERE
        m."targetGroup" = '${grp}' and m."cohort" != 'Pilot'
        AND s."courseId" IN (${course_id1},${course_id2},${course_id3}) 
    GROUP BY
        m."phoneNumber",m."name",m."cohort",m."targetGroup", s."courseId", s."weekNumber", s."dayNumber"
),
FinalProgress AS (
    SELECT
        ac."phoneNumber",
        ac."name",
       ac."cohort",
       ac."targetGroup",
        ac."courseId",
        ac."weekNumber",
        ac."dayNumber",
        COALESCE(sc."CompletedLessons", 0) AS "CompletedLessons"
    FROM
        AllCombinations ac
    LEFT JOIN
        StudentCompletions sc 
        ON ac."phoneNumber" = sc."phoneNumber"
        AND ac."courseId" = sc."courseId"
        AND ac."weekNumber" = sc."weekNumber"
        AND ac."dayNumber" = sc."dayNumber"
),
DailyProgress AS (
    SELECT
        fp."phoneNumber",
        fp."cohort",
        fp."targetGroup",
		    fp."name",
        fp."courseId",
        fp."weekNumber",
        fp."dayNumber",
        CASE
            WHEN fp."CompletedLessons" = la."TotalLessons" THEN 1
            ELSE 0
        END AS "DayCompleted"
    FROM
        FinalProgress fp
    JOIN
        LessonAssignments la 
        ON fp."courseId" = la."courseId"
        AND fp."weekNumber" = la."weekNumber"
        AND fp."dayNumber" = la."dayNumber"
),
WeeklyProgress AS (
    SELECT
        dp."phoneNumber",
        dp."cohort",
        dp."targetGroup",
		    dp."name",
        dp."courseId",
        dp."weekNumber",
        SUM(dp."DayCompleted") AS "DaysCompletedInWeek"
    FROM
        DailyProgress dp
    GROUP BY
        dp."phoneNumber",dp."name",dp."cohort",dp."targetGroup", dp."courseId", dp."weekNumber"
),
PivotedProgress AS (
    SELECT
        wp."phoneNumber",
        wp."cohort",
        wp."targetGroup",
		    wp."name",
        wp."courseId",
        MAX(CASE WHEN wp."weekNumber" = 1 THEN NULLIF(wp."DaysCompletedInWeek", 0) END) AS "week1",
        MAX(CASE WHEN wp."weekNumber" = 2 THEN NULLIF(wp."DaysCompletedInWeek", 0) END) AS "week2",
        MAX(CASE WHEN wp."weekNumber" = 3 THEN NULLIF(wp."DaysCompletedInWeek", 0) END) AS "week3",
        MAX(CASE WHEN wp."weekNumber" = 4 THEN NULLIF(wp."DaysCompletedInWeek", 0) END) AS "week4"
    FROM
        WeeklyProgress wp
    GROUP BY
        wp."phoneNumber",wp."name", wp."cohort",wp."targetGroup",wp."courseId"
),
AggregatedProgress AS (
    SELECT
	    COALESCE(ROW_NUMBER() OVER (ORDER BY pp."targetGroup", pp."cohort", pp."phoneNumber" ASC) + COALESCE(${offsetT1},0) , 0) AS sr_no,
            pp."phoneNumber",
		    pp."name",
        MAX(CASE WHEN pp."courseId" = ${course_id1} THEN pp."week1" END) AS "course1_week1",
        MAX(CASE WHEN pp."courseId" = ${course_id1} THEN pp."week2" END) AS "course1_week2",
        MAX(CASE WHEN pp."courseId" = ${course_id1} THEN pp."week3" END) AS "course1_week3",
        MAX(CASE WHEN pp."courseId" = ${course_id1} THEN pp."week4" END) AS "course1_week4",
        MAX(CASE WHEN pp."courseId" = ${course_id1} THEN NULLIF(
    COALESCE(pp."week1", 0) +
    COALESCE(pp."week2", 0) +
    COALESCE(pp."week3", 0) +
    COALESCE(pp."week4", 0), 0
) END) AS "course1_total",
        MAX(CASE WHEN pp."courseId" = ${course_id2} THEN pp."week1" END) AS "course2_week1",
        MAX(CASE WHEN pp."courseId" = ${course_id2} THEN pp."week2" END) AS "course2_week2",
        MAX(CASE WHEN pp."courseId" = ${course_id2} THEN pp."week3" END) AS "course2_week3",
        MAX(CASE WHEN pp."courseId" = ${course_id2} THEN pp."week4" END) AS "course2_week4",
        MAX(CASE WHEN pp."courseId" = ${course_id2} THEN NULLIF(
    COALESCE(pp."week1", 0) +
    COALESCE(pp."week2", 0) +
    COALESCE(pp."week3", 0) +
    COALESCE(pp."week4", 0), 0
) END) AS "course2_total",
    MAX(CASE WHEN pp."courseId" = ${course_id3} THEN pp."week1" END) AS "course3_week1",
MAX(CASE WHEN pp."courseId" = ${course_id3} THEN pp."week2" END) AS "course3_week2",
MAX(CASE WHEN pp."courseId" = ${course_id3} THEN pp."week3" END) AS "course3_week3",
MAX(CASE WHEN pp."courseId" = ${course_id3} THEN pp."week4" END) AS "course3_week4",
    MAX(CASE WHEN pp."courseId" = ${course_id3} THEN NULLIF(
    COALESCE(pp."week1", 0) +
    COALESCE(pp."week2", 0) +
    COALESCE(pp."week3", 0) +
    COALESCE(pp."week4", 0), 0
) END) AS "course3_total",
    NULLIF(
    MAX(CASE WHEN pp."courseId" = ${course_id1} THEN 
        COALESCE(pp."week1", 0) +
        COALESCE(pp."week2", 0) +
        COALESCE(pp."week3", 0) +
        COALESCE(pp."week4", 0)
    END) +
    MAX(CASE WHEN pp."courseId" = ${course_id2} THEN 
        COALESCE(pp."week1", 0) +
        COALESCE(pp."week2", 0) +
        COALESCE(pp."week3", 0) +
        COALESCE(pp."week4", 0)
    END) +
    MAX(CASE WHEN pp."courseId" = ${course_id3} THEN 
        COALESCE(pp."week1", 0) +
        COALESCE(pp."week2", 0) +
        COALESCE(pp."week3", 0) +
        COALESCE(pp."week4", 0)
    END), 0
) AS grand_total,
       pp."cohort",
       pp."targetGroup"
    FROM
        PivotedProgress pp
    GROUP BY
        pp."phoneNumber",pp."name",pp."cohort",pp."targetGroup"
)
SELECT
    *
FROM
    AggregatedProgress
ORDER BY
    "targetGroup","cohort","phoneNumber" asc;`;


    const res = await sequelize.query(qry);

    return res[0];
  } catch (error) {
    error.fileName = "etlRepository.js";
    throw error;
  }
};

const getActivity_Completions = async (course1_id, course2_id, course3_id,grp) => {
  try {

    var offsetT1 = 0;

    if (grp == 'T2') {
        const qryT1 = `
        SELECT COUNT(DISTINCT m."phoneNumber") AS totalT1
        FROM "wa_users_metadata" m
        WHERE m."targetGroup" = 'T1' and m."cohort" != 'Pilot';
      `;
      const resT1 = await sequelize.query(qryT1);

      if (resT1[0] && resT1[0][0]) {
        offsetT1 = resT1[0][0].totalt1 || 0; 
      } else {
        console.log("No records found for targetGroup 'T1' and cohort not 'Pilot'.");
        offsetT1 = 0;  
      }
    }

      const qry = `
          SELECT 
              COALESCE(ROW_NUMBER() OVER (ORDER BY m."targetGroup", m."cohort", m."phoneNumber" ASC) + COALESCE(${offsetT1},0) , 0) AS sr_no,
              m."phoneNumber", 
              m."name",
              SUM(CASE WHEN s."weekNumber" = 1 AND s."courseId" = ${course1_id} THEN 1 ELSE NULL END) AS "course1_week1_activities",
              SUM(CASE WHEN s."weekNumber" = 2 AND s."courseId" = ${course1_id} THEN 1 ELSE NULL END) AS "course1_week2_activities",
              SUM(CASE WHEN s."weekNumber" = 3 AND s."courseId" = ${course1_id} THEN 1 ELSE NULL END) AS "course1_week3_activities",
              SUM(CASE WHEN s."weekNumber" = 4 AND s."courseId" = ${course1_id} THEN 1 ELSE NULL END) AS "course1_week4_activities",
              
              NULLIF(SUM(CASE WHEN s."courseId" = ${course1_id} THEN 1 ELSE 0 END), 0) AS course1_total,

              SUM(CASE WHEN s."weekNumber" = 1 AND s."courseId" = ${course2_id} THEN 1 ELSE NULL END) AS "course2_week1_activities",
              SUM(CASE WHEN s."weekNumber" = 2 AND s."courseId" = ${course2_id} THEN 1 ELSE NULL END) AS "course2_week2_activities",
              SUM(CASE WHEN s."weekNumber" = 3 AND s."courseId" = ${course2_id} THEN 1 ELSE NULL END) AS "course2_week3_activities",
              SUM(CASE WHEN s."weekNumber" = 4 AND s."courseId" = ${course2_id} THEN 1 ELSE NULL END) AS "course2_week4_activities",

              NULLIF(SUM(CASE WHEN s."courseId" = ${course2_id} THEN 1 ELSE 0 END), 0) AS course2_total,

              SUM(CASE WHEN s."weekNumber" = 1 AND s."courseId" = ${course3_id} THEN 1 ELSE NULL END) AS "course3_week1_activities",
              SUM(CASE WHEN s."weekNumber" = 2 AND s."courseId" = ${course3_id} THEN 1 ELSE NULL END) AS "course3_week2_activities",
              SUM(CASE WHEN s."weekNumber" = 3 AND s."courseId" = ${course3_id} THEN 1 ELSE NULL END) AS "course3_week3_activities",
              SUM(CASE WHEN s."weekNumber" = 4 AND s."courseId" = ${course3_id} THEN 1 ELSE NULL END) AS "course3_week4_activities",

              NULLIF(SUM(CASE WHEN s."courseId" = ${course3_id} THEN 1 ELSE 0 END), 0) AS course3_total,
              NULLIF(
                  SUM(CASE WHEN s."courseId" IN (${course1_id}, ${course2_id}, ${course3_id}) THEN 1 ELSE 0 END)
              , 0) AS grand_total,
              m."cohort",
              m."targetGroup"
          FROM 
              "wa_users_metadata" m 
          LEFT JOIN 
              "wa_lessons_completed" l 
              ON m."phoneNumber" = l."phoneNumber" 
              AND l."completionStatus" = 'Completed' 
          LEFT JOIN 
              "Lesson" s 
              ON s."LessonId" = l."lessonId" 
              AND s."courseId" = l."courseId" 
              AND s."courseId" IN (${course1_id}, ${course2_id}, ${course3_id}) 
              AND s."weekNumber" IN (1, 2, 3, 4) 
          WHERE 
              m."targetGroup" = '${grp}'
              and m."cohort" != 'Pilot' 
          GROUP BY 
              m."name", m."phoneNumber", m."cohort", m."targetGroup"
          ORDER BY 
               m."targetGroup",m."cohort",m."phoneNumber" ASC;
      `;

      const res = await sequelize.query(qry);
      return res[0];
  } catch (error) {
      error.fileName = "etlRepository.js";
      throw error;
  }
};

const getWeeklyScore = async (course_id,grp) => {
  try {
  
    const qry = `
WITH target_group_users AS (
    SELECT "phoneNumber"
    FROM "wa_users_metadata" 
    WHERE "targetGroup" = '${grp}' and "cohort" != 'Pilot'
),
course_activities AS (
    SELECT "LessonId", "activity", "courseId", "weekNumber"
    FROM "Lesson" 
    WHERE "courseId" = ${course_id} AND "weekNumber" IN (1,2,3,4)
),
listen_and_speak AS (
    SELECT 
        q."phoneNumber",  
        COUNT(CASE WHEN l."weekNumber" = 1 AND q."correct" @> ARRAY[TRUE] THEN 1 ELSE NULL END) AS listenAndSpeak_week1_correct_count,
        COUNT(CASE WHEN l."weekNumber" = 1 THEN 1 ELSE NULL END) AS listenAndSpeak_week1_total,
        COUNT(CASE WHEN l."weekNumber" = 2 AND q."correct" @> ARRAY[TRUE] THEN 1 ELSE NULL END) AS listenAndSpeak_week2_correct_count,
        COUNT(CASE WHEN l."weekNumber" = 2 THEN 1 ELSE NULL END) AS listenAndSpeak_week2_total,
        COUNT(CASE WHEN l."weekNumber" = 3 AND q."correct" @> ARRAY[TRUE] THEN 1 ELSE NULL END) AS listenAndSpeak_week3_correct_count,
        COUNT(CASE WHEN l."weekNumber" = 3 THEN 1 ELSE NULL END) AS listenAndSpeak_week3_total,
        COUNT(CASE WHEN l."weekNumber" = 4 AND q."correct" @> ARRAY[TRUE] THEN 1 ELSE NULL END) AS listenAndSpeak_week4_correct_count,
        COUNT(CASE WHEN l."weekNumber" = 4 THEN 1 ELSE NULL END) AS listenAndSpeak_week4_total
    FROM 
        "wa_question_responses" q 
    LEFT JOIN 
        course_activities l ON q."lessonId" = l."LessonId"
    WHERE 
        l."activity" = 'listenAndSpeak' 
        AND q."phoneNumber" IN (SELECT "phoneNumber" FROM target_group_users)
    GROUP BY 
        q."phoneNumber" ORDER BY q."phoneNumber"
),
mcqs AS (
    SELECT 
		q."phoneNumber",
        COUNT(CASE WHEN l."weekNumber" = 1 AND element = TRUE THEN 1 ELSE NULL END) AS mcqs_week1_correct_count,
        COUNT(CASE WHEN l."weekNumber" = 1 THEN 1 ELSE NULL END) AS mcqs_week1_total,
        COUNT(CASE WHEN l."weekNumber" = 2 AND element = TRUE THEN 1 ELSE NULL END) AS mcqs_week2_correct_count,
        COUNT(CASE WHEN l."weekNumber" = 2 THEN 1 ELSE NULL END) AS mcqs_week2_total,
        COUNT(CASE WHEN l."weekNumber" = 3 AND element = TRUE THEN 1 ELSE NULL END) AS mcqs_week3_correct_count,
        COUNT(CASE WHEN l."weekNumber" = 3 THEN 1 ELSE NULL END) AS mcqs_week3_total,
        COUNT(CASE WHEN l."weekNumber" = 4 AND element = TRUE THEN 1 ELSE NULL END) AS mcqs_week4_correct_count,
        COUNT(CASE WHEN l."weekNumber" = 4 THEN 1 ELSE NULL END) AS mcqs_week4_total
    FROM 
        "wa_question_responses" q 
    LEFT JOIN 
        course_activities l ON q."lessonId" = l."LessonId",
        UNNEST(q."correct") AS element
    WHERE 
        l."activity" = 'mcqs' 
        AND q."phoneNumber" IN (SELECT "phoneNumber" FROM target_group_users)
    GROUP BY 
        q."phoneNumber"
),
watch_and_speak AS (
    SELECT 
        q."phoneNumber",
        COUNT(CASE WHEN l."weekNumber" = 1 THEN 1 ELSE NULL END) * 2 AS watchAndSpeak_week1_total,
        COALESCE(
            SUM(
                CASE WHEN l."weekNumber" = 1 THEN 
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                END
            ) / 300 * 2, 0
        ) AS watchAndSpeak_week1_score,
        COUNT(CASE WHEN l."weekNumber" = 2 THEN 1 ELSE NULL END) * 2 AS watchAndSpeak_week2_total,
        COALESCE(
            SUM(
                CASE WHEN l."weekNumber" = 2 THEN 
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                END
            ) / 300 * 2, 0
        ) AS watchAndSpeak_week2_score,
        COUNT(CASE WHEN l."weekNumber" = 3 THEN 1 ELSE NULL END) * 2 AS watchAndSpeak_week3_total,
        COALESCE(
            SUM(
                CASE WHEN l."weekNumber" = 3 THEN 
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                END
            ) / 300 * 2, 0
        ) AS watchAndSpeak_week3_score,
        COUNT(CASE WHEN l."weekNumber" = 4 THEN 1 ELSE NULL END) * 2 AS watchAndSpeak_week4_total,
        COALESCE(
            SUM(
                CASE WHEN l."weekNumber" = 4 THEN 
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                END
            ) / 300 * 2, 0
        ) AS watchAndSpeak_week4_score
    FROM 
        "wa_question_responses" q 
    LEFT JOIN 
        course_activities l ON l."LessonId" = q."lessonId"
    WHERE 
        l."activity" = 'watchAndSpeak' 
        AND q."phoneNumber" IN (SELECT "phoneNumber" FROM target_group_users)
    GROUP BY 
        q."phoneNumber"
),
read_activity AS (
    SELECT 
        q."phoneNumber",
        COUNT(CASE WHEN l."weekNumber" = 1 THEN 1 ELSE NULL END) * 6 AS read_week1_total,
        COALESCE(
            SUM(
                CASE WHEN l."weekNumber" = 1 THEN 
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                END
            ) / 300 * 6, 0
        ) AS read_week1_score,
        COUNT(CASE WHEN l."weekNumber" = 2 THEN 1 ELSE NULL END) * 6 AS read_week2_total,
        COALESCE(
            SUM(
                CASE WHEN l."weekNumber" = 2 THEN 
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                END
            ) / 300 * 6, 0
        ) AS read_week2_score,
        COUNT(CASE WHEN l."weekNumber" = 3 THEN 1 ELSE NULL END) * 6 AS read_week3_total,
        COALESCE(
            SUM(
                CASE WHEN l."weekNumber" = 3 THEN 
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                END
            ) / 300 * 6, 0
        ) AS read_week3_score,
        COUNT(CASE WHEN l."weekNumber" = 4 THEN 1 ELSE NULL END) * 6 AS read_week4_total,
        COALESCE(
            SUM(
                CASE WHEN l."weekNumber" = 4 THEN 
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                END
            ) / 300 * 6, 0
        ) AS read_week4_score
    FROM 
        "wa_question_responses" q 
    LEFT JOIN 
        course_activities l ON l."LessonId" = q."lessonId"
    WHERE 
        l."activity" = 'read' 
        AND q."phoneNumber" IN (SELECT "phoneNumber" FROM target_group_users)
    GROUP BY 
        q."phoneNumber"
),
conversational_monologue AS (
    SELECT 
        q."phoneNumber",
        COALESCE(
            SUM(
                CASE 
                    WHEN l."weekNumber" = 1 THEN 
                        CASE 
                            WHEN (l."courseId" = 98 OR l."courseId" = 99) THEN
                                COALESCE(("submittedFeedbackJson"[1]->0->'NBest'->0->'PronunciationAssessment'->>'AccuracyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->0->'NBest'->0->'PronunciationAssessment'->>'FluencyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->0->'NBest'->0->'contentAssessment'->>'CompScore')::DECIMAL, 0)
                            ELSE
                                COALESCE(("submittedFeedbackJson"[1]->'pronunciationAssessment'->>'AccuracyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'pronunciationAssessment'->>'FluencyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'contentAssessment'->>'GrammarScore')::DECIMAL, 0)
                        END
                    ELSE NULL
                END
            ) / 300 * 5, 0
        ) AS conversationalMonologue_week1_score,
        COUNT(CASE WHEN l."weekNumber" = 1 THEN 1 ELSE NULL END) * 5 AS conversationalMonologue_week1_total,
   
        COALESCE(
            SUM(
                CASE 
                    WHEN l."weekNumber" = 2 THEN 
                        CASE 
                            WHEN (l."courseId" = 98 OR l."courseId" = 99) THEN
                                COALESCE(("submittedFeedbackJson"[1]->0->'NBest'->0->'PronunciationAssessment'->>'AccuracyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->0->'NBest'->0->'PronunciationAssessment'->>'FluencyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->0->'NBest'->0->'contentAssessment'->>'CompScore')::DECIMAL, 0)
                            ELSE
                                COALESCE(("submittedFeedbackJson"[1]->'pronunciationAssessment'->>'AccuracyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'pronunciationAssessment'->>'FluencyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'contentAssessment'->>'GrammarScore')::DECIMAL, 0)
                        END
                    ELSE NULL
                END
            ) / 300 * 5, 0
        ) AS conversationalMonologue_week2_score,
        COUNT(CASE WHEN l."weekNumber" = 2 THEN 1 ELSE NULL END) * 5 AS conversationalMonologue_week2_total,

        COALESCE(
            SUM(
                CASE 
                    WHEN l."weekNumber" = 3 THEN 
                        CASE 
                            WHEN (l."courseId" = 98 OR l."courseId" = 99) THEN
                                COALESCE(("submittedFeedbackJson"[1]->0->'NBest'->0->'PronunciationAssessment'->>'AccuracyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->0->'NBest'->0->'PronunciationAssessment'->>'FluencyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->0->'NBest'->0->'contentAssessment'->>'CompScore')::DECIMAL, 0)
                            ELSE
                                COALESCE(("submittedFeedbackJson"[1]->'pronunciationAssessment'->>'AccuracyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'pronunciationAssessment'->>'FluencyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'contentAssessment'->>'GrammarScore')::DECIMAL, 0)
                        END
                    ELSE NULL
                END
            ) / 300 * 5, 0
        ) AS conversationalMonologue_week3_score,
        COUNT(CASE WHEN l."weekNumber" = 3 THEN 1 ELSE NULL END) * 5 AS conversationalMonologue_week3_total,

        COALESCE(
            SUM(
                CASE 
                    WHEN l."weekNumber" = 4 THEN 
                        CASE 
                            WHEN (l."courseId" = 98 OR l."courseId" = 99) THEN
                                COALESCE(("submittedFeedbackJson"[1]->0->'NBest'->0->'PronunciationAssessment'->>'AccuracyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->0->'NBest'->0->'PronunciationAssessment'->>'FluencyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->0->'NBest'->0->'contentAssessment'->>'CompScore')::DECIMAL, 0)
                            ELSE
                                COALESCE(("submittedFeedbackJson"[1]->'pronunciationAssessment'->>'AccuracyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'pronunciationAssessment'->>'FluencyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'contentAssessment'->>'GrammarScore')::DECIMAL, 0)
                        END
                    ELSE NULL
                END
            ) / 300 * 5, 0
        ) AS conversationalMonologue_week4_score,
        COUNT(CASE WHEN l."weekNumber" = 4 THEN 1 ELSE NULL END) * 5 AS conversationalMonologue_week4_total
    FROM 
        "wa_question_responses" q 
    LEFT JOIN 
        course_activities l ON l."LessonId" = q."lessonId"
    WHERE 
        l."activity" = 'conversationalMonologueBot' 
        AND q."phoneNumber" IN (SELECT "phoneNumber" FROM target_group_users)
    GROUP BY 
        q."phoneNumber"
),
wa_lessons_completed AS (
       select
        m."phoneNumber",
        COALESCE(SUM(CASE WHEN s."weekNumber" = 1 THEN 1 ELSE 0 END), 0) AS completed_activities_week1,
        (SELECT COALESCE(COUNT(s1."LessonId"), 0) 
         FROM "Lesson" s1 
         WHERE s1."weekNumber" = 1 AND s1."courseId" = ${course_id}) AS total_activities_week1,
       
                CASE 
                    WHEN COALESCE(SUM(CASE WHEN s."weekNumber" = 1 THEN 1 ELSE 0 END), 0) = 
                         (SELECT COALESCE(COUNT(s1."LessonId"), 0) 
                          FROM "Lesson" s1 
                          WHERE s1."weekNumber" = 1 AND s1."courseId" = ${course_id})
                    THEN 1
                    ELSE NULL
        END AS completion_activity_week1,

        COALESCE(SUM(CASE WHEN s."weekNumber" = 2 THEN 1 ELSE 0 END), 0) AS completed_activities_week2,
        (SELECT COALESCE(COUNT(s1."LessonId"), 0) 
         FROM "Lesson" s1 
         WHERE s1."weekNumber" = 2 AND s1."courseId" = ${course_id}) AS total_activities_week2,
       
                CASE 
                    WHEN COALESCE(SUM(CASE WHEN s."weekNumber" = 2 THEN 1 ELSE 0 END), 0) = 
                         (SELECT COALESCE(COUNT(s1."LessonId"), 0) 
                          FROM "Lesson" s1 
                          WHERE s1."weekNumber" = 2 AND s1."courseId" = ${course_id})
                    THEN 1
                    ELSE NULL
              
        END AS completion_activity_week2,

        COALESCE(SUM(CASE WHEN s."weekNumber" = 3 THEN 1 ELSE 0 END), 0) AS completed_activities_week3,
        (SELECT COALESCE(COUNT(s1."LessonId"), 0) 
         FROM "Lesson" s1 
         WHERE s1."weekNumber" = 3 AND s1."courseId" = ${course_id}) AS total_activities_week3,
       
                CASE 
                    WHEN COALESCE(SUM(CASE WHEN s."weekNumber" = 3 THEN 1 ELSE 0 END), 0) = 
                         (SELECT COALESCE(COUNT(s1."LessonId"), 0) 
                          FROM "Lesson" s1 
                          WHERE s1."weekNumber" = 3 AND s1."courseId" = ${course_id})
                    THEN 1
                    ELSE NULL
                
        END AS completion_activity_week3,

        COALESCE(SUM(CASE WHEN s."weekNumber" = 4 THEN 1 ELSE 0 END), 0) AS completed_activities_week4,
        (SELECT COALESCE(COUNT(s1."LessonId"), 0) 
         FROM "Lesson" s1 
         WHERE s1."weekNumber" = 4 AND s1."courseId" = ${course_id}) AS total_activities_week4,
        
                CASE 
                    WHEN COALESCE(SUM(CASE WHEN s."weekNumber" = 4 THEN 1 ELSE 0 END), 0) = 
                         (SELECT COALESCE(COUNT(s1."LessonId"), 0) 
                          FROM "Lesson" s1 
                          WHERE s1."weekNumber" = 4 AND s1."courseId" = ${course_id})
                    THEN 1
                    ELSE NULL
                
        END AS completion_activity_week4
     FROM 
        "wa_users_metadata" m 
    LEFT JOIN 
        "wa_lessons_completed" l ON m."phoneNumber" = l."phoneNumber" 
        AND l."completionStatus" = 'Completed'
    LEFT JOIN 
        "Lesson" s ON s."LessonId" = l."lessonId" 
        AND s."courseId" = l."courseId" 
        AND s."courseId" = ${course_id}
    WHERE 
        m."targetGroup" != 'Control' or m."cohort" != 'Pilot'
    GROUP BY 
       m."targetGroup", m."phoneNumber",m."cohort"
)
SELECT 
     ROW_NUMBER() OVER (ORDER BY m."phoneNumber") AS sr_no,
     m."phoneNumber", 
     m."name",
    CASE 
        WHEN wc.completion_activity_week1 = 1 THEN
            CASE 
                WHEN COALESCE(ls.listenAndSpeak_week1_total, 0) + COALESCE(mc.mcqs_week1_total, 0) + COALESCE(ws.watchAndSpeak_week1_total, 0) + 
                     COALESCE(rd.read_week1_total, 0) + COALESCE(cm.conversationalMonologue_week1_total, 0) = 0
                THEN null
                ELSE 
                     ROUND((COALESCE(ls.listenAndSpeak_week1_correct_count, 0) + COALESCE(mc.mcqs_week1_correct_count, 0) + COALESCE(ws.watchAndSpeak_week1_score, 0) + 
                     COALESCE(rd.read_week1_score, 0) + COALESCE(cm.conversationalMonologue_week1_score, 0)) /
                    (COALESCE(ls.listenAndSpeak_week1_total, 0) + COALESCE(mc.mcqs_week1_total, 0) + COALESCE(ws.watchAndSpeak_week1_total, 0) + 
                     COALESCE(rd.read_week1_total, 0) + COALESCE(cm.conversationalMonologue_week1_total, 0)) * 100, 2)
            END || '%'
        ELSE null
    END AS final_percentage_week1,

    CASE 
        WHEN wc.completion_activity_week2 = 1 THEN
            CASE 
                WHEN COALESCE(ls.listenAndSpeak_week2_total, 0) + COALESCE(mc.mcqs_week2_total, 0) + COALESCE(ws.watchAndSpeak_week2_total, 0) + 
                     COALESCE(rd.read_week2_total, 0) + COALESCE(cm.conversationalMonologue_week2_total, 0) = 0
                THEN null
                ELSE 
                     ROUND((COALESCE(ls.listenAndSpeak_week2_correct_count, 0) + COALESCE(mc.mcqs_week2_correct_count, 0) + COALESCE(ws.watchAndSpeak_week2_score, 0) + 
                     COALESCE(rd.read_week2_score, 0) + COALESCE(cm.conversationalMonologue_week2_score, 0)) /
                    (COALESCE(ls.listenAndSpeak_week2_total, 0) + COALESCE(mc.mcqs_week2_total, 0) + COALESCE(ws.watchAndSpeak_week2_total, 0) + 
                     COALESCE(rd.read_week2_total, 0) + COALESCE(cm.conversationalMonologue_week2_total, 0)) * 100, 2)
            END || '%'
        ELSE null
    END AS final_percentage_week2,

    CASE 
        WHEN wc.completion_activity_week3 = 1 THEN
            CASE 
                WHEN COALESCE(ls.listenAndSpeak_week3_total, 0) + COALESCE(mc.mcqs_week3_total, 0) + COALESCE(ws.watchAndSpeak_week3_total, 0) + 
                     COALESCE(rd.read_week3_total, 0) + COALESCE(cm.conversationalMonologue_week3_total, 0) = 0
                THEN null
                ELSE 
                     ROUND((COALESCE(ls.listenAndSpeak_week3_correct_count, 0) + COALESCE(mc.mcqs_week3_correct_count, 0) + COALESCE(ws.watchAndSpeak_week3_score, 0) + 
                     COALESCE(rd.read_week3_score, 0) + COALESCE(cm.conversationalMonologue_week3_score, 0)) /
                    (COALESCE(ls.listenAndSpeak_week3_total, 0) + COALESCE(mc.mcqs_week3_total, 0) + COALESCE(ws.watchAndSpeak_week3_total, 0) + 
                     COALESCE(rd.read_week3_total, 0) + COALESCE(cm.conversationalMonologue_week3_total, 0)) * 100, 2)
            END || '%'
        ELSE null
    END AS final_percentage_week3,

    CASE 
        WHEN wc.completion_activity_week4 = 1 THEN
            CASE 
                WHEN COALESCE(ls.listenAndSpeak_week4_total, 0) + COALESCE(mc.mcqs_week4_total, 0) + COALESCE(ws.watchAndSpeak_week4_total, 0) + 
                     COALESCE(rd.read_week4_total, 0) + COALESCE(cm.conversationalMonologue_week4_total, 0) = 0
                THEN null
                ELSE 
                     ROUND((COALESCE(ls.listenAndSpeak_week4_correct_count, 0) + COALESCE(mc.mcqs_week4_correct_count, 0) + COALESCE(ws.watchAndSpeak_week4_score, 0) + 
                     COALESCE(rd.read_week4_score, 0) + COALESCE(cm.conversationalMonologue_week4_score, 0)) /
                    (COALESCE(ls.listenAndSpeak_week4_total, 0) + COALESCE(mc.mcqs_week4_total, 0) + COALESCE(ws.watchAndSpeak_week4_total, 0) + 
                     COALESCE(rd.read_week4_total, 0) + COALESCE(cm.conversationalMonologue_week4_total, 0)) * 100, 2)
            END || '%'
        ELSE null
    END AS final_percentage_week4,
    m."cohort",
    m."targetGroup"
FROM 
    "wa_users_metadata" m 
LEFT JOIN 
    listen_and_speak ls ON m."phoneNumber" = ls."phoneNumber"
LEFT JOIN 
    mcqs mc ON m."phoneNumber" = mc."phoneNumber"
LEFT JOIN 
    watch_and_speak ws ON m."phoneNumber" = ws."phoneNumber"
LEFT JOIN 
    read_activity rd ON m."phoneNumber" = rd."phoneNumber"
LEFT JOIN 
    conversational_monologue cm ON m."phoneNumber" = cm."phoneNumber"
LEFT JOIN 
    wa_lessons_completed wc ON m."phoneNumber" = wc."phoneNumber"
WHERE 
    m."targetGroup" = '${grp}' and m."cohort" != 'Pilot' order by m."targetGroup",m."cohort", m."phoneNumber" asc;`;


    const res = await sequelize.query(qry);

    return res[0];
  } catch (error) {
    error.fileName = "etlRepository.js";
    throw error;
  }
};

export default { getDataFromPostgres, getDataActivityComplete, getWeeklyActivityCompleted,getUserMetadataAll,getUserMetadataTime,getLessonCompletions,getActivity_Completions, getWeeklyScore };
