import sequelize from "../config/sequelize.js";
import WA_UsersMetadata from "../models/WA_UsersMetadata.js";

const getDataFromPostgres = async (grp) => {
  try {

    const res = await WA_UsersMetadata.findAll({
      where : {targetGroup : grp},
      order: [["name" , "ASC"]],
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
                  group by m."name", m."phoneNumber" order by m."name" asc;`;


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
                and s."weekNumber" IN (1,2,3,4) where m."targetGroup" = '${grp}' and m."cohort" = '${cohort}' group by m."name", m."phoneNumber" order by m."name" asc;`;

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
        "courseId" IN (${course_id1},${course_id2},${course_id3})  and "status" = 'Active'
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
        COALESCE(ROW_NUMBER() OVER (ORDER BY pp."targetGroup", pp."cohort", pp."phoneNumber" ASC) + COALESCE(${offsetT1}, 0), 0) AS sr_no,
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
        NULLIF(COALESCE(
            MAX(CASE WHEN pp."courseId" = ${course_id1} THEN 
                COALESCE(pp."week1", 0) + COALESCE(pp."week2", 0) + COALESCE(pp."week3", 0) + COALESCE(pp."week4", 0)
            END), 0
        ) +
        COALESCE(
            MAX(CASE WHEN pp."courseId" = ${course_id2} THEN 
                COALESCE(pp."week1", 0) + COALESCE(pp."week2", 0) + COALESCE(pp."week3", 0) + COALESCE(pp."week4", 0)
            END), 0
        ) +
        COALESCE(
            MAX(CASE WHEN pp."courseId" = ${course_id3} THEN 
                COALESCE(pp."week1", 0) + COALESCE(pp."week2", 0) + COALESCE(pp."week3", 0) + COALESCE(pp."week4", 0)
            END), 0
     ),0) AS grand_total,
        pp."cohort",
        pp."targetGroup"
    FROM
        PivotedProgress pp
    GROUP BY
        pp."phoneNumber", pp."name", pp."cohort", pp."targetGroup"
)
SELECT
    *
FROM
    AggregatedProgress
ORDER BY
    "targetGroup","cohort","name" asc;`;


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
               m."targetGroup",m."cohort",m."name" ASC;
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
                                  --                      ELSEIF (l."courseId" = 107)
       --                          COALESCE(("submittedFeedbackJson"[1]->'pronunciationAssessment'->>'AccuracyScore')::DECIMAL, 0) +
       --                          COALESCE(("submittedFeedbackJson"[1]->'pronunciationAssessment'->>'FluencyScore')::DECIMAL, 0) +
       --                          COALESCE(("submittedFeedbackJson"[1]->'contentAssessment'->>'GrammarScore')::DECIMAL, 0)
                            ELSE
							    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
			                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
			                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
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
                                 --                      ELSEIF (l."courseId" = 107)
       --                          COALESCE(("submittedFeedbackJson"[1]->'pronunciationAssessment'->>'AccuracyScore')::DECIMAL, 0) +
       --                          COALESCE(("submittedFeedbackJson"[1]->'pronunciationAssessment'->>'FluencyScore')::DECIMAL, 0) +
       --                          COALESCE(("submittedFeedbackJson"[1]->'contentAssessment'->>'GrammarScore')::DECIMAL, 0)
                            ELSE
							    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
			                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
			                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
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
                                  --                      ELSEIF (l."courseId" = 107)
       --                          COALESCE(("submittedFeedbackJson"[1]->'pronunciationAssessment'->>'AccuracyScore')::DECIMAL, 0) +
       --                          COALESCE(("submittedFeedbackJson"[1]->'pronunciationAssessment'->>'FluencyScore')::DECIMAL, 0) +
       --                          COALESCE(("submittedFeedbackJson"[1]->'contentAssessment'->>'GrammarScore')::DECIMAL, 0)
                            ELSE
							    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
			                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
			                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
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
                                  --                      ELSEIF (l."courseId" = 107)
       --                          COALESCE(("submittedFeedbackJson"[1]->'pronunciationAssessment'->>'AccuracyScore')::DECIMAL, 0) +
       --                          COALESCE(("submittedFeedbackJson"[1]->'pronunciationAssessment'->>'FluencyScore')::DECIMAL, 0) +
       --                          COALESCE(("submittedFeedbackJson"[1]->'contentAssessment'->>'GrammarScore')::DECIMAL, 0)
                            ELSE
							    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
			                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
			                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
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
Speaking_practice AS (
    SELECT 
        q."phoneNumber",
        COALESCE(
            SUM(
                CASE 
                    WHEN l."weekNumber" = 1 THEN 
							    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
			                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
			                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                       
                    ELSE NULL
                END
            ) / 300 * 5, 0
        ) AS Speaking_practice_week1_score,
        COUNT(CASE WHEN l."weekNumber" = 1 THEN 1 ELSE NULL END) * 5 AS Speaking_practice_week1_total,
   
        COALESCE(
            SUM(
                CASE 
                    WHEN l."weekNumber" = 2 THEN 
							    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
			                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
			                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                
                    ELSE NULL
                END
            ) / 300 * 5, 0
        ) AS Speaking_practice_week2_score,
        COUNT(CASE WHEN l."weekNumber" = 2 THEN 1 ELSE NULL END) * 5 AS Speaking_practice_week2_total,

        COALESCE(
            SUM(
                CASE 
                    WHEN l."weekNumber" = 3 THEN 
							    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
			                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
			                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                  
                    ELSE NULL
                END
            ) / 300 * 5, 0
        ) AS Speaking_practice_week3_score,
        COUNT(CASE WHEN l."weekNumber" = 3 THEN 1 ELSE NULL END) * 5 AS Speaking_practice_week3_total,

        COALESCE(
            SUM(
                CASE 
                    WHEN l."weekNumber" = 4 THEN 
							    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
			                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
			                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                  
                    ELSE NULL
                END
            ) / 300 * 5, 0
        ) AS Speaking_practice_week4_score,
        COUNT(CASE WHEN l."weekNumber" = 4 THEN 1 ELSE NULL END) * 5 AS Speaking_practice_week4_total
    FROM 
        "wa_question_responses" q 
    LEFT JOIN 
        course_activities l ON l."LessonId" = q."lessonId"
    WHERE 
        l."activity" = 'speakingPractice' 
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
         WHERE s1."weekNumber" = 1 AND s1."courseId" = ${course_id} and s1."status" = 'Active') AS total_activities_week1,
       
                CASE 
                    WHEN COALESCE(SUM(CASE WHEN s."weekNumber" = 1 THEN 1 ELSE 0 END), 0) = 
                         (SELECT COALESCE(COUNT(s1."LessonId"), 0) 
                          FROM "Lesson" s1 
                          WHERE s1."weekNumber" = 1 AND s1."courseId" = ${course_id} and s1."status" = 'Active')
                    THEN 1
                    ELSE NULL
        END AS completion_activity_week1,

        COALESCE(SUM(CASE WHEN s."weekNumber" = 2 THEN 1 ELSE 0 END), 0) AS completed_activities_week2,
        (SELECT COALESCE(COUNT(s1."LessonId"), 0) 
         FROM "Lesson" s1 
         WHERE s1."weekNumber" = 2 AND s1."courseId" = ${course_id} and s1."status" = 'Active') AS total_activities_week2,
       
                CASE 
                    WHEN COALESCE(SUM(CASE WHEN s."weekNumber" = 2 THEN 1 ELSE 0 END), 0) = 
                         (SELECT COALESCE(COUNT(s1."LessonId"), 0) 
                          FROM "Lesson" s1 
                          WHERE s1."weekNumber" = 2 AND s1."courseId" = ${course_id} and s1."status" = 'Active')
                    THEN 1
                    ELSE NULL
              
        END AS completion_activity_week2,

        COALESCE(SUM(CASE WHEN s."weekNumber" = 3 THEN 1 ELSE 0 END), 0) AS completed_activities_week3,
        (SELECT COALESCE(COUNT(s1."LessonId"), 0) 
         FROM "Lesson" s1 
         WHERE s1."weekNumber" = 3 AND s1."courseId" = ${course_id} and s1."status" = 'Active') AS total_activities_week3,
       
                CASE 
                    WHEN COALESCE(SUM(CASE WHEN s."weekNumber" = 3 THEN 1 ELSE 0 END), 0) = 
                         (SELECT COALESCE(COUNT(s1."LessonId"), 0) 
                          FROM "Lesson" s1 
                          WHERE s1."weekNumber" = 3 AND s1."courseId" = ${course_id} and s1."status" = 'Active')
                    THEN 1
                    ELSE NULL
                
        END AS completion_activity_week3,

        COALESCE(SUM(CASE WHEN s."weekNumber" = 4 THEN 1 ELSE 0 END), 0) AS completed_activities_week4,
        (SELECT COALESCE(COUNT(s1."LessonId"), 0) 
         FROM "Lesson" s1 
         WHERE s1."weekNumber" = 4 AND s1."courseId" = ${course_id} and s1."status" = 'Active') AS total_activities_week4,
        
                CASE 
                    WHEN COALESCE(SUM(CASE WHEN s."weekNumber" = 4 THEN 1 ELSE 0 END), 0) = 
                         (SELECT COALESCE(COUNT(s1."LessonId"), 0) 
                          FROM "Lesson" s1 
                          WHERE s1."weekNumber" = 4 AND s1."courseId" = ${course_id} and s1."status" = 'Active')
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
                     COALESCE(rd.read_week1_total, 0) + COALESCE(cm.conversationalMonologue_week1_total, 0) + COALESCE(sp.Speaking_practice_week1_total, 0) = 0
                THEN null
                ELSE 
                     ROUND((COALESCE(ls.listenAndSpeak_week1_correct_count, 0) + COALESCE(mc.mcqs_week1_correct_count, 0) + COALESCE(ws.watchAndSpeak_week1_score, 0) + 
                     COALESCE(rd.read_week1_score, 0) + COALESCE(cm.conversationalMonologue_week1_score, 0) + COALESCE(sp.Speaking_practice_week1_score, 0)) /
                    (COALESCE(ls.listenAndSpeak_week1_total, 0) + COALESCE(mc.mcqs_week1_total, 0) + COALESCE(ws.watchAndSpeak_week1_total, 0) + 
                     COALESCE(rd.read_week1_total, 0) + COALESCE(cm.conversationalMonologue_week1_total, 0) + COALESCE(sp.Speaking_practice_week1_total, 0)) * 100, 0)
            END || '%'
        ELSE null
    END AS final_percentage_week1,

    CASE 
        WHEN wc.completion_activity_week2 = 1 THEN
            CASE 
                WHEN COALESCE(ls.listenAndSpeak_week2_total, 0) + COALESCE(mc.mcqs_week2_total, 0) + COALESCE(ws.watchAndSpeak_week2_total, 0) + 
                     COALESCE(rd.read_week2_total, 0) + COALESCE(cm.conversationalMonologue_week2_total, 0) + COALESCE(sp.Speaking_practice_week2_total, 0) = 0
                THEN null
                ELSE 
                     ROUND((COALESCE(ls.listenAndSpeak_week2_correct_count, 0) + COALESCE(mc.mcqs_week2_correct_count, 0) + COALESCE(ws.watchAndSpeak_week2_score, 0) + 
                     COALESCE(rd.read_week2_score, 0) + COALESCE(cm.conversationalMonologue_week2_score, 0) + COALESCE(sp.Speaking_practice_week2_score, 0)) /
                    (COALESCE(ls.listenAndSpeak_week2_total, 0) + COALESCE(mc.mcqs_week2_total, 0) + COALESCE(ws.watchAndSpeak_week2_total, 0) + 
                     COALESCE(rd.read_week2_total, 0) + COALESCE(cm.conversationalMonologue_week2_total, 0) + COALESCE(sp.Speaking_practice_week2_total, 0)) * 100, 0)
            END || '%'
        ELSE null
    END AS final_percentage_week2,

    CASE 
        WHEN wc.completion_activity_week3 = 1 THEN
            CASE 
                WHEN COALESCE(ls.listenAndSpeak_week3_total, 0) + COALESCE(mc.mcqs_week3_total, 0) + COALESCE(ws.watchAndSpeak_week3_total, 0) + 
                     COALESCE(rd.read_week3_total, 0) + COALESCE(cm.conversationalMonologue_week3_total, 0) + COALESCE(sp.Speaking_practice_week3_total, 0) = 0
                THEN null
                ELSE 
                     ROUND((COALESCE(ls.listenAndSpeak_week3_correct_count, 0) + COALESCE(mc.mcqs_week3_correct_count, 0) + COALESCE(ws.watchAndSpeak_week3_score, 0) + 
                     COALESCE(rd.read_week3_score, 0) + COALESCE(cm.conversationalMonologue_week3_score, 0) + COALESCE(sp.Speaking_practice_week3_score, 0)) /
                    (COALESCE(ls.listenAndSpeak_week3_total, 0) + COALESCE(mc.mcqs_week3_total, 0) + COALESCE(ws.watchAndSpeak_week3_total, 0) + 
                     COALESCE(rd.read_week3_total, 0) + COALESCE(cm.conversationalMonologue_week3_total, 0) + COALESCE(sp.Speaking_practice_week3_total, 0)) * 100, 0)
            END || '%'
        ELSE null
    END AS final_percentage_week3,

    CASE 
        WHEN wc.completion_activity_week4 = 1 THEN
            CASE 
                WHEN COALESCE(ls.listenAndSpeak_week4_total, 0) + COALESCE(mc.mcqs_week4_total, 0) + COALESCE(ws.watchAndSpeak_week4_total, 0) + 
                     COALESCE(rd.read_week4_total, 0) + COALESCE(cm.conversationalMonologue_week4_total, 0) + COALESCE(sp.Speaking_practice_week4_total, 0) = 0
                THEN null
                ELSE 
                     ROUND((COALESCE(ls.listenAndSpeak_week4_correct_count, 0) + COALESCE(mc.mcqs_week4_correct_count, 0) + COALESCE(ws.watchAndSpeak_week4_score, 0) + 
                     COALESCE(rd.read_week4_score, 0) + COALESCE(cm.conversationalMonologue_week4_score, 0) + COALESCE(sp.Speaking_practice_week4_score, 0)) /
                    (COALESCE(ls.listenAndSpeak_week4_total, 0) + COALESCE(mc.mcqs_week4_total, 0) + COALESCE(ws.watchAndSpeak_week4_total, 0) + 
                     COALESCE(rd.read_week4_total, 0) + COALESCE(cm.conversationalMonologue_week4_total, 0) + COALESCE(sp.Speaking_practice_week4_total, 0)) * 100, 0)
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
    Speaking_practice sp ON m."phoneNumber" = sp."phoneNumber"
LEFT JOIN 
    wa_lessons_completed wc ON m."phoneNumber" = wc."phoneNumber"
WHERE 
    m."targetGroup" = '${grp}' and m."cohort" != 'Pilot' order by m."targetGroup",m."cohort", m."name" asc;`;

    const res = await sequelize.query(qry);

    return res[0];
  } catch (error) {
    error.fileName = "etlRepository.js";
    throw error;
  }
};

const getCumulative_AvgActivity_Rollout = async (course_id, grp, cohort) => {
    try {

        let cohortCondition = '';
    if (cohort === 'Pilot') {
        cohortCondition = `m."cohort" = '${cohort}'`; 
      } 
      else {
        if((grp == 'T1' || grp == 'T2') && cohort !== 'Pilot'){
           cohortCondition = `m."cohort" != 'Pilot'`; 
      }
    }

        const qry = `
           WITH grand_total_cte AS (
    SELECT 
        m."phoneNumber", 
        SUM(CASE WHEN s."courseId" = ${course_id} THEN 1 ELSE 0 END) AS grand_total
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
        AND s."courseId" = ${course_id} 
    WHERE 
        m."targetGroup" = '${grp}'
        AND ${cohortCondition}
    GROUP BY 
        m."phoneNumber"
),
total_activities_cte AS (
    SELECT COUNT("LessonId") AS "Total_Activities"
    FROM "Lesson"
    WHERE "courseId" = ${course_id} and "status" = 'Active'
    AND (
        -- Include all lessons from previous weeks
        "weekNumber" < (
            SELECT CEIL(
                ((CURRENT_TIMESTAMP)::DATE - DATE("courseStartDate")) / 7.0
            ) 
            FROM "Courses" WHERE "CourseId" = ${course_id}
        )
        -- Include only up to the current day's lessons in the current week
        OR (
            "weekNumber" = (
                SELECT CEIL(
                    ((CURRENT_TIMESTAMP)::DATE - DATE("courseStartDate")) / 7.0
                ) 
                FROM "Courses" WHERE "CourseId" = ${course_id}
            )
            AND "dayNumber" <= (
                SELECT 
                    CASE 
                        WHEN EXTRACT(DOW FROM (CURRENT_TIMESTAMP)) = 0 THEN 7
                        ELSE EXTRACT(DOW FROM (CURRENT_TIMESTAMP))
                    END
            )
        )
    )
)
SELECT 
    ROUND(SUM(grand_total) * 1.0 / NULLIF(COUNT(CASE WHEN grand_total > 0 THEN 1 END), 0), 2) AS average_ratio,
    (SELECT "Total_Activities" FROM total_activities_cte) AS "Total_Activities"
FROM 
    grand_total_cte;
        `;

        const res = await sequelize.query(qry);
        return res[0];
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};

const getDaily_AvgActivity_Rollout = async (course_id,grp) => {
    try {
        const qry = `
            WITH grand_total_cte AS (
    SELECT 
        m."phoneNumber", 
        SUM(CASE WHEN s."courseId" IN (${course_id}) THEN 1 ELSE 0 END) AS grand_total
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
        AND s."courseId" IN (${course_id}) 
        AND s."weekNumber" = (
               SELECT CEIL(
                   ((CURRENT_TIMESTAMP)::DATE - DATE("courseStartDate")) / 7.0
               ) 
               FROM "Courses" 
               WHERE "CourseId" = ${course_id})
	   AND "dayNumber" = (
               SELECT 
                   CASE 
                       WHEN EXTRACT(DOW FROM (CURRENT_TIMESTAMP)) = 0 THEN 7
                       ELSE EXTRACT(DOW FROM (CURRENT_TIMESTAMP))
                   END AS day_number)
    WHERE 
        m."targetGroup" = '${grp}'
        AND m."cohort" != 'Pilot' 
    GROUP BY 
        m."phoneNumber"
)
SELECT 
    -- sum(grand_total) AS total_grand_total_count,
    -- COUNT(CASE WHEN grand_total > 0 THEN 1 END) AS phone_count_with_grand_total_gt_zero,
    round(sum(grand_total) * 1.0 / NULLIF(COUNT(CASE WHEN grand_total > 0 THEN 1 END), 0),2) AS average_ratio,
	(SELECT COUNT("LessonId") 
                 FROM "Lesson" 
                 WHERE "courseId" = ${course_id} AND "dayNumber" = (
               SELECT 
                   CASE 
                       WHEN EXTRACT(DOW FROM (CURRENT_TIMESTAMP)) = 0 THEN 7
                       ELSE EXTRACT(DOW FROM (CURRENT_TIMESTAMP))
                   END AS day_number)
           AND "weekNumber" = (
               SELECT CEIL(
                   ((CURRENT_TIMESTAMP)::DATE - DATE("courseStartDate")) / 7.0
               ) 
               FROM "Courses" 
               WHERE "CourseId" = ${course_id})) AS "Total_Activities"
FROM 
    grand_total_cte;
        `;
  
        const res = await sequelize.query(qry);
        return res[0];
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};

const getNotStartCohortCount_Rollout = async (course_id,grp) => {
    try {
        const qry = `
            WITH TargetGroup AS (
    SELECT 
        m."phoneNumber",
		m."cohort"
    FROM 
        "wa_users_metadata" m
    WHERE 
        m."targetGroup" = '${grp}' 
        AND m."cohort" != 'Pilot'
    ),
    UnattemptedPhoneNumbers AS (
        SELECT 
            tg."phoneNumber",
            tg."cohort"
        FROM 
            TargetGroup tg
        LEFT JOIN 
            "wa_lessons_completed" l 
        ON 
            tg."phoneNumber" = l."phoneNumber" 
            AND l."courseId" = ${course_id} and l."completionStatus" = 'Completed'
        WHERE 
            l."lessonId" IS  NULL
    )
    SELECT 
     t."cohort", count(*) FROM UnattemptedPhoneNumbers t group by t."cohort" 
	 order by CAST(SPLIT_PART(t."cohort", ' ', 2) AS INTEGER);
        `;
  
        const res = await sequelize.query(qry);
        return res[0];
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};
const getCount_NotStartedActivity = async (course_id,grp,cohort) => {
    try {
        let cohortCondition = '';
    if (cohort === 'Pilot') {
        cohortCondition = `m."cohort" = '${cohort}'`; 
      } 
      else {
        if((grp == 'T1' || grp == 'T2') && cohort !== 'Pilot'){
           cohortCondition = `m."cohort" != 'Pilot'`; 
      }
    }
        const qry = `
           WITH TargetGroup AS (
    SELECT 
        m."phoneNumber"
    FROM 
        "wa_users_metadata" m
    WHERE 
        m."targetGroup" = '${grp}' 
        AND ${cohortCondition}
),
UnattemptedPhoneNumbers AS (
    SELECT 
        tg."phoneNumber"
    FROM 
        TargetGroup tg
    LEFT JOIN 
        "wa_lessons_completed" l 
    ON 
        tg."phoneNumber" = l."phoneNumber" 
        AND l."courseId" = ${course_id}
    WHERE 
        l."lessonId" IS NULL
)
SELECT 
    (SELECT COUNT(*) FROM TargetGroup) AS "total_count",
    (SELECT COUNT(*) FROM UnattemptedPhoneNumbers) AS "total_not_started";
        `;
  
        const res = await sequelize.query(qry);
        return res[0];
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};

const getLastLessonCompleted_Rollout = async (course_id,grp,cohort) => {
    try {
    let flag = cohort;
    let cohortCondition = '';
    let total_cnt = [];
   if(cohort == 'Pilots' || cohort == 'Rollout'){
    if(cohort == 'Pilots'){cohort = 'Pilot'} else {cohort = ''}
      total_cnt = await getCount_NotStartedActivity(course_id, grp,cohort);
    if (cohort === 'Pilot') {
        cohortCondition = `m."cohort" = '${cohort}'`; 
      } 
      else {
        if((grp == 'T1' || grp == 'T2') && cohort !== 'Pilot'){
           cohortCondition = `m."cohort" != 'Pilot'`; 
      }
    }
}
else{
    cohortCondition = `m."cohort" = '${cohort}'`; 
}

//         const qry = `
//             WITH TargetGroup AS (
//     SELECT 
//         m."phoneNumber"
//     FROM 
//         "wa_users_metadata" m
//     WHERE 
//         m."targetGroup" = '${grp}' 
//         and ${cohortCondition}
// ),
// get_lessonIds AS (
//     SELECT 
//         "LessonId", 
//         "weekNumber", 
//         "dayNumber",
//         "SequenceNumber" 
//     FROM 
//         "Lesson" 
//     WHERE 
//         "courseId" = ${course_id}
// ),
// LessonWithMaxTimestamp AS (
//     SELECT 
//         l."phoneNumber",
//         l."lessonId",
//         l."endTime",
//         ROW_NUMBER() OVER (
//             PARTITION BY l."phoneNumber" 
//             ORDER BY l."endTime" DESC
//         ) AS row_num
//     FROM 
//         "wa_lessons_completed" l
//     INNER JOIN 
//         TargetGroup tg 
//     ON 
//         l."phoneNumber" = tg."phoneNumber"
//     WHERE 
//         l."completionStatus" = 'Completed'
//         AND l."courseId" = ${course_id}
// ),
// LessonCompletionCounts AS (
//     SELECT 
//         lw."lessonId",
//         COUNT(lw."phoneNumber") AS "completionCount"
//     FROM 
//         LessonWithMaxTimestamp lw
//     WHERE 
//         lw.row_num = 1
//     GROUP BY 
//         lw."lessonId"
// ),
// LessonDays AS (
//     SELECT 
//         g."LessonId",
//         ((g."weekNumber" - 1) * 6 + g."dayNumber") AS days,
//         COALESCE(lcc."completionCount", 0) AS "total_students_completed"
//     FROM 
//         get_lessonIds g
//     LEFT JOIN 
//         LessonCompletionCounts lcc 
//     ON 
//         g."LessonId" = lcc."lessonId"
// )
// SELECT 
//     CONCAT('day ', d.day) AS day,
//     NULLIF(COALESCE(SUM(ld."total_students_completed"), 0),0) AS count
// FROM 
//     generate_series(1, 24) AS d(day)
// LEFT JOIN 
//     LessonDays ld 
// ON 
//     d.day = ld.days
// GROUP BY 
//     d.day
// ORDER BY 
//     d.day;
//         `;


const qry = `WITH "TargetGroup" AS (
    SELECT 
        "m"."phoneNumber"
    FROM 
        "wa_users_metadata" AS "m"
    WHERE 
        "m"."targetGroup" = '${grp}' 
        AND ${cohortCondition}
),
"user_progress" AS (
    SELECT 
        "p"."phoneNumber",
        "p"."currentWeek",
        "p"."currentDay",
        "p"."acceptableMessages",
        CASE 
            WHEN 'start next lesson' = ANY("p"."acceptableMessages") THEN 1 
            ELSE 0 
        END AS "lesson_completed_count"
    FROM 
        "wa_user_progress" AS "p"
    INNER JOIN 
        "TargetGroup" AS "t" 
    ON 
        "p"."phoneNumber" = "t"."phoneNumber" 
        AND "p"."currentCourseId" = ${course_id}
),
get_dayCount as (
SELECT 
    "currentWeek",
    "currentDay",
    "lesson_completed_count",
	-- (("currentWeek" - 1) * 6 + "currentDay") as day
    CASE 
        WHEN ("lesson_completed_count" = 1) 
        THEN (("currentWeek" - 1) * 6 + "currentDay") 
        ELSE (("currentWeek" - 1) * 6 + "currentDay" ) - 1
    END AS "day"
FROM 
    "user_progress"
	WHERE 
    "currentWeek" IS NOT NULL 
    AND "currentDay" IS NOT NULL
ORDER BY 
    "currentWeek", "currentDay"
	),
dayseries as (SELECT generate_series(0, 24) AS "day"),
getvalues as (select "day",count(*) from get_dayCount g group by g."day")
select CONCAT('day ', d."day") as "day",v."count" from dayseries d left join getvalues v 
on d."day" = v."day" ORDER BY 
    d."day";`;
  
        const res = await sequelize.query(qry);
    let finalOutput = [];
    if(flag == 'Pilots' || flag == 'Rollout'){
    finalOutput = [
        { day: 'Total', count: parseInt(total_cnt[0].total_count, 10) },
        { day: 'Start', count: parseInt(total_cnt[0].total_not_started, 10) },
        ...res[0].map(item => ({
            day: item.day,
            count: item.count !== null ? parseInt(item.count, 10) : null
        }))
      ];
    }
    else{
        finalOutput = res[0];
    }

    return finalOutput;
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};

const getCount_UpdateLagCohortWise = async (course_id,grp) => {
    try {
        const qry = `
          WITH StudentActivities AS (
            SELECT 
                m."phoneNumber" AS "Student_Number",
				m."cohort",
                COUNT(l."lessonId") AS "Completed_Activities",
                (SELECT 
            CASE 
                WHEN (CURRENT_TIMESTAMP - INTERVAL '1 month') > (SELECT "courseStartDate" FROM "Courses" WHERE "CourseId" = ${course_id}) 
                THEN (SELECT COUNT("LessonId") FROM "Lesson" WHERE "courseId" = ${course_id} and "status" = 'Active')
                ELSE (
                    SELECT COUNT("LessonId") 
                    FROM "Lesson" 
                    WHERE "courseId" = ${course_id} and "status" = 'Active' 
                    AND (
        -- Include all lessons from previous weeks
        "weekNumber" < (
            SELECT CEIL(
                ((CURRENT_TIMESTAMP)::DATE - DATE("courseStartDate")) / 7.0
            ) 
            FROM "Courses" WHERE "CourseId" = ${course_id}
        )
        -- Include only up to the current day's lessons in the current week
        OR (
            "weekNumber" = (
                SELECT CEIL(
                    ((CURRENT_TIMESTAMP)::DATE - DATE("courseStartDate")) / 7.0
                ) 
                FROM "Courses" WHERE "CourseId" = ${course_id}
            )
            AND "dayNumber" <= (
                SELECT 
                    CASE 
                        WHEN EXTRACT(DOW FROM (CURRENT_TIMESTAMP)) = 0 THEN 7
                        ELSE EXTRACT(DOW FROM (CURRENT_TIMESTAMP))
                    END
            )
        )
    )
                )
            END
        ) AS "Total_Activities"
            FROM 
                "wa_users_metadata" m
            LEFT JOIN 
                "wa_lessons_completed" l 
            ON 
                m."phoneNumber" = l."phoneNumber" 
                AND l."courseId" = ${course_id} 
                AND l."completionStatus" = 'Completed'
            WHERE 
                m."targetGroup" = '${grp}' and m."cohort" != 'Pilot' and m."cohort" != 'Cohort 0'
            GROUP BY 
                m."phoneNumber"
        ),
        ThresholdComparison AS (
            SELECT 
                "Student_Number",
				"cohort",
                "Completed_Activities",
                "Total_Activities",
                CASE WHEN ("Completed_Activities" >= "Total_Activities") THEN 1 ELSE 0 END AS "Meets_Threshold_90",
                CASE WHEN (("Completed_Activities" > 0) and  ("Completed_Activities" < "Total_Activities")) THEN 1 ELSE 0 END AS "Meets_Threshold_50",
                CASE WHEN ("Completed_Activities" = 0) THEN 1 ELSE 0 END AS "Meets_Threshold_0"
            FROM 
                StudentActivities
        )
        SELECT 
		     "cohort",
            NULLIF(SUM("Meets_Threshold_50")::INTEGER,0) AS "lagging_behind_count",
			NULLIF(SUM("Meets_Threshold_90")::INTEGER,0) AS "up_to_date_count"
            -- SUM("Meets_Threshold_0") AS "at_zero_count",
            -- COUNT(*) AS "total_count",
            -- ROUND((SUM("Meets_Threshold_90")::DECIMAL / COUNT(*) * 100),2) AS "up_to_date_percent",
            -- ROUND((SUM("Meets_Threshold_50")::DECIMAL / COUNT(*) * 100),2) AS "lagging_behind_percent",
            -- ROUND((SUM("Meets_Threshold_0")::DECIMAL / COUNT(*) * 100),2)  AS "at_zero_percent"
        FROM 
            ThresholdComparison group by "cohort" order by CAST(SPLIT_PART("cohort", ' ', 2) AS INTEGER);
        `;
  
        const res = await sequelize.query(qry);
        return res[0];
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};


const getActivtyWiseWeeklyScore = async (course_id,grp) => {
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
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
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
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
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
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
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
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
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
Speaking_practice AS (
    SELECT 
        q."phoneNumber",
        COALESCE(
            SUM(
                CASE 
                    WHEN l."weekNumber" = 1 THEN 
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                    ELSE NULL
                END
            ) / 300 * 5, 0
        ) AS Speaking_practice_week1_score,
        COUNT(CASE WHEN l."weekNumber" = 1 THEN 1 ELSE NULL END) * 5 AS Speaking_practice_week1_total,
   
        COALESCE(
            SUM(
                CASE 
                    WHEN l."weekNumber" = 2 THEN 
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                    ELSE NULL
                END
            ) / 300 * 5, 0
        ) AS Speaking_practice_week2_score,
        COUNT(CASE WHEN l."weekNumber" = 2 THEN 1 ELSE NULL END) * 5 AS Speaking_practice_week2_total,

        COALESCE(
            SUM(
                CASE 
                    WHEN l."weekNumber" = 3 THEN 
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                    ELSE NULL
                END
            ) / 300 * 5, 0
        ) AS Speaking_practice_week3_score,
        COUNT(CASE WHEN l."weekNumber" = 3 THEN 1 ELSE NULL END) * 5 AS Speaking_practice_week3_total,

        COALESCE(
            SUM(
                CASE 
                    WHEN l."weekNumber" = 4 THEN 
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                    ELSE NULL
                END
            ) / 300 * 5, 0
        ) AS Speaking_practice_week4_score,
        COUNT(CASE WHEN l."weekNumber" = 4 THEN 1 ELSE NULL END) * 5 AS Speaking_practice_week4_total
    FROM 
        "wa_question_responses" q 
    LEFT JOIN 
        course_activities l ON l."LessonId" = q."lessonId"
    WHERE 
        l."activity" = 'speakingPractice' 
        AND q."phoneNumber" IN (SELECT "phoneNumber" FROM target_group_users)
    GROUP BY 
        q."phoneNumber"
)
SELECT 
     ROW_NUMBER() OVER (ORDER BY m."name") AS sr_no,
     m."phoneNumber", 
     m."name",
     CASE 
         WHEN round(COALESCE(ls.listenAndSpeak_week1_correct_count, 0), 2) + round(COALESCE(ls.listenAndSpeak_week2_correct_count, 0), 2)
             + round(COALESCE(ls.listenAndSpeak_week3_correct_count, 0), 2) + round(COALESCE(ls.listenAndSpeak_week4_correct_count, 0), 2) = 0 THEN NULL
         ELSE round(COALESCE(ls.listenAndSpeak_week1_correct_count, 0), 2) + round(COALESCE(ls.listenAndSpeak_week2_correct_count, 0), 2)
             + round(COALESCE(ls.listenAndSpeak_week3_correct_count, 0), 2) + round(COALESCE(ls.listenAndSpeak_week4_correct_count, 0), 2)
     END as "listenAndSpeak",

      round(COALESCE(ls.listenAndSpeak_week1_total, 0), 2) + round(COALESCE(ls.listenAndSpeak_week2_total, 0), 2)
             + round(COALESCE(ls.listenAndSpeak_week3_total, 0), 2) + round(COALESCE(ls.listenAndSpeak_week4_total, 0), 2)
      as "listenAndSpeak_total",
     
     CASE 
         WHEN round(COALESCE(mc.mcqs_week1_correct_count, 0), 2) + round(COALESCE(mc.mcqs_week2_correct_count, 0), 2) 
             + round(COALESCE(mc.mcqs_week3_correct_count, 0), 2) + round(COALESCE(mc.mcqs_week4_correct_count, 0), 2) = 0 THEN NULL
         ELSE round(COALESCE(mc.mcqs_week1_correct_count, 0), 2) + round(COALESCE(mc.mcqs_week2_correct_count, 0), 2) 
             + round(COALESCE(mc.mcqs_week3_correct_count, 0), 2) + round(COALESCE(mc.mcqs_week4_correct_count, 0), 2)
     END as "mcqs",

      round(COALESCE(mc.mcqs_week1_total, 0), 2) + round(COALESCE(mc.mcqs_week2_total, 0), 2)
             + round(COALESCE(mc.mcqs_week3_total, 0), 2) + round(COALESCE(mc.mcqs_week4_total, 0), 2)
      as "mcqs_total",

     CASE 
         WHEN round(COALESCE(ws.watchAndSpeak_week1_score, 0), 2) + round(COALESCE(ws.watchAndSpeak_week2_score, 0), 2)
             + round(COALESCE(ws.watchAndSpeak_week3_score, 0), 2) + round(COALESCE(ws.watchAndSpeak_week4_score, 0), 2) = 0 THEN NULL
         ELSE round(COALESCE(ws.watchAndSpeak_week1_score, 0), 2) + round(COALESCE(ws.watchAndSpeak_week2_score, 0), 2)
             + round(COALESCE(ws.watchAndSpeak_week3_score, 0), 2) + round(COALESCE(ws.watchAndSpeak_week4_score, 0), 2)
     END as "watchAndSpeak",
     
      round(COALESCE(ws.watchAndSpeak_week1_total, 0), 2) + round(COALESCE(ws.watchAndSpeak_week2_total, 0), 2)
             + round(COALESCE(ws.watchAndSpeak_week3_total, 0), 2) + round(COALESCE(ws.watchAndSpeak_week4_total, 0), 2)
      as "watchAndSpeak_total",
     
     CASE 
         WHEN round(COALESCE(rd.read_week1_score, 0), 2) + round(COALESCE(rd.read_week2_score, 0), 2) + round(COALESCE(rd.read_week3_score, 0), 2)
             + round(COALESCE(rd.read_week4_score, 0), 2) = 0 THEN NULL
         ELSE round(COALESCE(rd.read_week1_score, 0), 2) + round(COALESCE(rd.read_week2_score, 0), 2) + round(COALESCE(rd.read_week3_score, 0), 2)
             + round(COALESCE(rd.read_week4_score, 0), 2)
     END as "read",

      round(COALESCE(rd.read_week1_total, 0), 2) + round(COALESCE(rd.read_week2_total, 0), 2) + round(COALESCE(rd.read_week3_total, 0), 2)
             + round(COALESCE(rd.read_week4_total, 0), 2)
      as "read_total",

     CASE 
         WHEN round(COALESCE(cm.conversationalMonologue_week1_score, 0), 2) + round(COALESCE(cm.conversationalMonologue_week2_score, 0), 2) +
             round(COALESCE(cm.conversationalMonologue_week3_score, 0), 2) + round(COALESCE(cm.conversationalMonologue_week4_score, 0), 2) = 0 THEN NULL
         ELSE round(COALESCE(cm.conversationalMonologue_week1_score, 0), 2) + round(COALESCE(cm.conversationalMonologue_week2_score, 0), 2) +
             round(COALESCE(cm.conversationalMonologue_week3_score, 0), 2) + round(COALESCE(cm.conversationalMonologue_week4_score, 0), 2)
     END as "conversationalMonologue",

      round(COALESCE(cm.conversationalMonologue_week1_total, 0), 2) + round(COALESCE(cm.conversationalMonologue_week2_total, 0), 2) +
             round(COALESCE(cm.conversationalMonologue_week3_total, 0), 2) + round(COALESCE(cm.conversationalMonologue_week4_total, 0), 2)
      as "conversationalMonologue_total",

     CASE 
         WHEN round(COALESCE(sp.Speaking_practice_week1_score, 0), 2) + round(COALESCE(sp.Speaking_practice_week2_score, 0), 2) + 
             round(COALESCE(sp.Speaking_practice_week3_score, 0), 2) + round(COALESCE(sp.Speaking_practice_week4_score, 0), 2) = 0 THEN NULL
         ELSE round(COALESCE(sp.Speaking_practice_week1_score, 0), 2) + round(COALESCE(sp.Speaking_practice_week2_score, 0), 2) + 
             round(COALESCE(sp.Speaking_practice_week3_score, 0), 2) + round(COALESCE(sp.Speaking_practice_week4_score, 0), 2)
     END as "Speaking_practice",

     round(COALESCE(sp.Speaking_practice_week1_total, 0), 2) + round(COALESCE(sp.Speaking_practice_week2_total, 0), 2) + 
             round(COALESCE(sp.Speaking_practice_week3_total, 0), 2) + round(COALESCE(sp.Speaking_practice_week4_total, 0), 2)
      as "Speaking_practice_total",

     m."cohort"
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
    Speaking_practice sp ON m."phoneNumber" = sp."phoneNumber"
WHERE 
    m."targetGroup" = '${grp}' and "cohort" != 'Pilot' 
ORDER BY m."targetGroup", m."cohort", m."name" ASC;
        `;
  
        const res = await sequelize.query(qry);
        return res[0];
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};



export default { getDataFromPostgres, getDataActivityComplete, getWeeklyActivityCompleted,getUserMetadataAll,getUserMetadataTime,getLessonCompletions,getActivity_Completions, getWeeklyScore,
    getCumulative_AvgActivity_Rollout, getDaily_AvgActivity_Rollout, getNotStartCohortCount_Rollout,getLastLessonCompleted_Rollout, getCount_UpdateLagCohortWise,  getActivtyWiseWeeklyScore
 };