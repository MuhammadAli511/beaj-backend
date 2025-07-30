import { consoleIntegration } from "@sentry/node";
import sequelize from "../config/sequelize.js";
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

const getcohortList = async (botType,rollout,level,targetGroup) => {
    try {
        let grp =``, grade = ``;
        if(targetGroup != ''){
            grp = ` and m."targetGroup" = '${targetGroup}'`;
        }
        if(level != ''){
             grade = ` and m."classLevel" = '${level}'`;
        }
        const qry = `SELECT m."cohort"
            FROM "wa_users_metadata" m
            INNER JOIN "wa_profiles" p ON p."profile_id" = m."profile_id"
            WHERE p."profile_type" = '${botType}' 
            AND m."rollout" = ${rollout} ${grp} ${grade} and m."cohort" != 'Cohort 0' and m."cohort" != 'Cohort 00' group by m."cohort" 
            ORDER BY 
            CAST(regexp_replace(m."cohort", '[^0-9]', '', 'g') AS INTEGER);`;

            // console.log(qry)
        const res = await sequelize.query(qry);

        return res[0];
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};


const getSuccessRate = async (course_id, grp, cohort) => {
    try {
        let cohortCondition = '';
        if (cohort === 'Pilot') {
            cohortCondition = `m."cohort" = '${cohort}'`;
        }
        else {
            if ((grp == 'T1' || grp == 'T2') && cohort !== 'Pilot') {
                cohortCondition = `m."cohort" != 'Pilot'`;
            }
        }
        let qry = `WITH StudentActivities AS (
            SELECT 
                m."phoneNumber" AS "Student_Number", 
                COUNT(l."lessonId") AS "Completed_Activities",
                (SELECT 
            CASE 
                WHEN (CURRENT_TIMESTAMP - INTERVAL '1 month') > (SELECT "courseStartDate" FROM "Courses" WHERE "CourseId" = ${course_id}) 
                THEN (SELECT COUNT("LessonId") FROM "Lesson" WHERE "courseId" = ${course_id} and "status" = 'Active')
                ELSE (
                    SELECT COUNT("LessonId") 
                    FROM "Lesson" 
                    WHERE "courseId" = ${course_id}  and "status" = 'Active'
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
                m."targetGroup" = '${grp}' and ${cohortCondition}
            GROUP BY 
                m."phoneNumber"
        ),
        ThresholdComparison AS (
            SELECT 
                "Student_Number",
                "Completed_Activities",
                "Total_Activities",
                CASE WHEN ("Completed_Activities" >= "Total_Activities") THEN 1 ELSE 0 END AS "Meets_Threshold_90",
                CASE WHEN (("Completed_Activities" > 0) and  ("Completed_Activities" < "Total_Activities")) THEN 1 ELSE 0 END AS "Meets_Threshold_50",
                CASE WHEN ("Completed_Activities" = 0) THEN 1 ELSE 0 END AS "Meets_Threshold_0"
            FROM 
                StudentActivities
        )
        SELECT 
            SUM("Meets_Threshold_90") AS "up_to_date_count",
            SUM("Meets_Threshold_50") AS "lagging_behind_count",
            SUM("Meets_Threshold_0") AS "at_zero_count",
            COUNT(*) AS "total_count",
            ROUND((SUM("Meets_Threshold_90")::DECIMAL / COUNT(*) * 100),2) AS "up_to_date_percent",
            ROUND((SUM("Meets_Threshold_50")::DECIMAL / COUNT(*) * 100),2) AS "lagging_behind_percent",
            ROUND((SUM("Meets_Threshold_0")::DECIMAL / COUNT(*) * 100),2)  AS "at_zero_percent"
        FROM 
            ThresholdComparison;`;

        const res = await sequelize.query(qry);

        return res[0];
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};

const getActivityTotalCount = async (course_id1, course_id2) => {
    try {

        const qry = `select "activity", count("activity") from "Lesson" where "courseId" = ${course_id1} or "courseId" = ${course_id2}  group by "activity" order by "activity";`;
        const res = await sequelize.query(qry);

        return res[0];
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};

const getCompletedActivity = async (course_id1, course_id2, grp, activity_name_list, cohort) => {
    try {
        const dynamicSumActivity = activity_name_list.map(activity => `COALESCE(sum(case when s."activity" = '${activity}' then 1 else null end), null) as "${activity}"`).join(",\n");

        const qry = `
      SELECT 
        ${dynamicSumActivity}
      FROM 
        "wa_users_metadata" m
      LEFT JOIN 
        "wa_lessons_completed" l 
      ON 
        m."phoneNumber" = l."phoneNumber" 
        AND (l."courseId" = ${course_id1} OR l."courseId" = ${course_id2})
        AND l."completionStatus" = 'Completed'
      LEFT JOIN 
        "Lesson" s 
      ON 
        l."lessonId" = s."LessonId" 
        AND l."courseId" = s."courseId"
      WHERE 
        m."targetGroup" = '${grp}' and m."cohort" = '${cohort}'
      GROUP BY 
        m."phoneNumber"
      ORDER BY 
        m."name" ASC;`;

        const res = await sequelize.query(qry);

        return res[0];
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};

// const getLessonCompletions = async (botType, rollout, level, cohort, targetGroup, courseId1, courseId2, courseId3) => {
//     try {

//         let classLevel = '', course_list = '', course_array = '', target_grp = '';
//         if(botType === 'teacher'){
//             if(rollout == 1 || rollout == 0){
//                 target_grp = ` m."targetGroup" = '${targetGroup}' AND `;
//             }
//             classLevel = `m."classLevel" is null`;
//             course_list = `${courseId1}, ${courseId2}, ${courseId3}`;   
//             course_array = `MAX(CASE WHEN pp."courseId" = ${courseId1} THEN pp."week1" END) AS "course1_week1",
//                 MAX(CASE WHEN pp."courseId" = ${courseId1} THEN pp."week2" END) AS "course1_week2",
//                 MAX(CASE WHEN pp."courseId" = ${courseId1} THEN pp."week3" END) AS "course1_week3",
//                 MAX(CASE WHEN pp."courseId" = ${courseId1} THEN pp."week4" END) AS "course1_week4",
//                 MAX(CASE WHEN pp."courseId" = ${courseId1} THEN NULLIF(
//             COALESCE(pp."week1", 0) +
//             COALESCE(pp."week2", 0) +
//             COALESCE(pp."week3", 0) +
//             COALESCE(pp."week4", 0), 0
//             ) END) AS "course1_total",
//                     MAX(CASE WHEN pp."courseId" = ${courseId2} THEN pp."week1" END) AS "course2_week1",
//                     MAX(CASE WHEN pp."courseId" = ${courseId2} THEN pp."week2" END) AS "course2_week2",
//                     MAX(CASE WHEN pp."courseId" = ${courseId2} THEN pp."week3" END) AS "course2_week3",
//                     MAX(CASE WHEN pp."courseId" = ${courseId2} THEN pp."week4" END) AS "course2_week4",
//                     MAX(CASE WHEN pp."courseId" = ${courseId2} THEN NULLIF(
//                 COALESCE(pp."week1", 0) +
//                 COALESCE(pp."week2", 0) +
//                 COALESCE(pp."week3", 0) +
//                 COALESCE(pp."week4", 0), 0
//             ) END) AS "course2_total",
//                 MAX(CASE WHEN pp."courseId" = ${courseId3} THEN pp."week1" END) AS "course3_week1",
//             MAX(CASE WHEN pp."courseId" = ${courseId3} THEN pp."week2" END) AS "course3_week2",
//             MAX(CASE WHEN pp."courseId" = ${courseId3} THEN pp."week3" END) AS "course3_week3",
//             MAX(CASE WHEN pp."courseId" = ${courseId3} THEN pp."week4" END) AS "course3_week4",
//                 MAX(CASE WHEN pp."courseId" = ${courseId3} THEN NULLIF(
//                 COALESCE(pp."week1", 0) +
//                 COALESCE(pp."week2", 0) +
//                 COALESCE(pp."week3", 0) +
//                 COALESCE(pp."week4", 0), 0
//             ) END) AS "course3_total",
//         NULLIF(COALESCE(
//                     MAX(CASE WHEN pp."courseId" = ${courseId1} THEN 
//                         COALESCE(pp."week1", 0) + COALESCE(pp."week2", 0) + COALESCE(pp."week3", 0) + COALESCE(pp."week4", 0)
//                     END), 0
//                 ) +
//                 COALESCE(
//                     MAX(CASE WHEN pp."courseId" = ${courseId2} THEN 
//                         COALESCE(pp."week1", 0) + COALESCE(pp."week2", 0) + COALESCE(pp."week3", 0) + COALESCE(pp."week4", 0)
//                     END), 0
//                 ) +
//                 COALESCE(
//                     MAX(CASE WHEN pp."courseId" = ${courseId3} THEN 
//                         COALESCE(pp."week1", 0) + COALESCE(pp."week2", 0) + COALESCE(pp."week3", 0) + COALESCE(pp."week4", 0)
//                     END), 0
//             ),0) AS grand_total`;
//         }
//         else{
//             classLevel = `m."classLevel" = '${level}'`;
//             course_list = `${courseId1}`;
//             course_array = `MAX(CASE WHEN pp."courseId" = ${courseId1} THEN pp."week1" END) AS "course1_week1",
//                 MAX(CASE WHEN pp."courseId" = ${courseId1} THEN pp."week2" END) AS "course1_week2",
//                 MAX(CASE WHEN pp."courseId" = ${courseId1} THEN pp."week3" END) AS "course1_week3",
//                 MAX(CASE WHEN pp."courseId" = ${courseId1} THEN pp."week4" END) AS "course1_week4",
//                 MAX(CASE WHEN pp."courseId" = ${courseId1} THEN NULLIF(
//             COALESCE(pp."week1", 0) +
//             COALESCE(pp."week2", 0) +
//             COALESCE(pp."week3", 0) +
//             COALESCE(pp."week4", 0), 0
//             ) END) AS "course1_total"`;
//         }

//          const qry = `WITH LessonAssignments AS (
//     SELECT
//         "courseId",
//         "weekNumber",
//         "dayNumber",
//         COUNT("LessonId") AS "TotalLessons"
//     FROM
//         "Lesson"
//     WHERE
//         "courseId" IN (${course_list})  and "status" = 'Active'
//     GROUP BY
//         "courseId", "weekNumber", "dayNumber"
// ),
// Students AS (
//     SELECT DISTINCT
//         m."phoneNumber",
//         m."profile_id",
// 		m."name"
//     FROM
//         "wa_users_metadata" m inner join "wa_profiles" p on
// 		m."profile_id" = p."profile_id"
//     WHERE
//         ${target_grp} m."cohort" = '${cohort}' and m."rollout" = ${rollout}
// 		and p."profile_type" = '${botType}' and ${classLevel}
// ),
// AllCombinations AS (
//     SELECT
//         s."phoneNumber",
//         s."profile_id",
// 		s."name",
//         la."courseId",
//         la."weekNumber",
//         la."dayNumber"
//     FROM
//         Students s
//     CROSS JOIN
//         LessonAssignments la
// ),
// StudentCompletions AS (
//     SELECT
//         m."phoneNumber",
//         m."profile_id",
// 		    m."name",
//         s."courseId",
//         s."weekNumber",
//         s."dayNumber",
//         COUNT(l."lessonId") AS "CompletedLessons"
//     FROM
//         "wa_users_metadata" m inner join "wa_profiles" p on m."profile_id" = p."profile_id"
//     LEFT JOIN
//         "wa_lessons_completed" l 
//         ON m."profile_id" = l."profile_id" and m."phoneNumber" = l."phoneNumber" AND l."completionStatus" = 'Completed'
//     LEFT JOIN
//         "Lesson" s 
//         ON s."LessonId" = l."lessonId" AND s."courseId" = l."courseId"
//     WHERE
//         ${target_grp} m."cohort" = '${cohort}' and m."rollout" = ${rollout}
// 		and p."profile_type" = '${botType}' and ${classLevel}
//         AND s."courseId" IN (${course_list}) 
//     GROUP BY
//         m."phoneNumber", m."profile_id", m."name", s."courseId", s."weekNumber", s."dayNumber"
// ),
// FinalProgress AS (
//     SELECT
//         ac."phoneNumber",
//         ac."profile_id",
//         ac."name",
//         ac."courseId",
//         ac."weekNumber",
//         ac."dayNumber",
//         COALESCE(sc."CompletedLessons", 0) AS "CompletedLessons"
//     FROM
//         AllCombinations ac
//     LEFT JOIN
//         StudentCompletions sc 
//         ON ac."profile_id" = sc."profile_id"
//         AND ac."courseId" = sc."courseId"
//         AND ac."weekNumber" = sc."weekNumber"
//         AND ac."dayNumber" = sc."dayNumber"
// ),
// DailyProgress AS (
//     SELECT
//         fp."phoneNumber",
//         fp."profile_id",
// 		    fp."name",
//         fp."courseId",
//         fp."weekNumber",
//         fp."dayNumber",
//         CASE
//             WHEN fp."CompletedLessons" = la."TotalLessons" THEN 1
//             ELSE 0
//         END AS "DayCompleted"
//     FROM
//         FinalProgress fp
//     JOIN
//         LessonAssignments la 
//         ON fp."courseId" = la."courseId"
//         AND fp."weekNumber" = la."weekNumber"
//         AND fp."dayNumber" = la."dayNumber"
// ),
// WeeklyProgress AS (
//     SELECT
//         dp."phoneNumber",
//         dp."profile_id",
// 		    dp."name",
//         dp."courseId",
//         dp."weekNumber",
//         SUM(dp."DayCompleted") AS "DaysCompletedInWeek"
//     FROM
//         DailyProgress dp
//     GROUP BY
//         dp."phoneNumber",dp."profile_id",dp."name", dp."courseId", dp."weekNumber"
// ),
// PivotedProgress AS (
//     SELECT
//         wp."phoneNumber",
//         wp."profile_id",
// 		    wp."name",
//         wp."courseId",
//         MAX(CASE WHEN wp."weekNumber" = 1 THEN NULLIF(wp."DaysCompletedInWeek", 0) END) AS "week1",
//         MAX(CASE WHEN wp."weekNumber" = 2 THEN NULLIF(wp."DaysCompletedInWeek", 0) END) AS "week2",
//         MAX(CASE WHEN wp."weekNumber" = 3 THEN NULLIF(wp."DaysCompletedInWeek", 0) END) AS "week3",
//         MAX(CASE WHEN wp."weekNumber" = 4 THEN NULLIF(wp."DaysCompletedInWeek", 0) END) AS "week4"
//     FROM
//         WeeklyProgress wp
//     GROUP BY
//         wp."phoneNumber", wp."profile_id", wp."name", wp."courseId"
// ),
// AggregatedProgress AS (
//     SELECT
//          ROW_NUMBER() OVER (ORDER BY pp."name") AS sr_no,
//         pp."phoneNumber",
//         pp."profile_id",
//         pp."name",
//         ${course_array}
//     FROM
//         PivotedProgress pp
//     GROUP BY
//         pp."phoneNumber", pp."profile_id", pp."name"
// )
// SELECT
//     *
// FROM
//     AggregatedProgress
// ORDER BY "name" asc;`;

// //         const qry = `WITH LessonAssignments AS (
// //     SELECT
// //         "courseId",
// //         "weekNumber",
// //         "dayNumber",
// //         COUNT("LessonId") AS "TotalLessons"
// //     FROM
// //         "Lesson"
// //     WHERE
// //         "courseId" IN (${course_list}) and "status" = 'Active'
// //     GROUP BY
// //         "courseId", "weekNumber", "dayNumber"
// // ),
// // Students AS (
// //     SELECT DISTINCT
// //         m."phoneNumber",
// // 		m."profile_id",
// // 		m."name"
// //     FROM
// //         "wa_users_metadata" m inner join "wa_profiles" p on
// // 		m."profile_id" = p."profile_id"
// //     WHERE
// //         ${target_grp} m."cohort" = '${cohort}' and m."rollout" = ${rollout}
// // 		and p."profile_type" = '${botType}' and ${classLevel}
// // ),
// // AllCombinations AS (
// //     SELECT
// //         s."phoneNumber",
// // 		s."profile_id",
// // 		s."name",
// //         la."courseId",
// //         la."weekNumber",
// //         la."dayNumber"
// //     FROM
// //         Students s
// //     CROSS JOIN
// //         LessonAssignments la
// // ),
// // StudentCompletions AS (
// //     SELECT
// //         m."phoneNumber",
// // 		m."profile_id",
// // 		m."name",
// //         s."courseId",
// //         s."weekNumber",
// //         s."dayNumber",
// //         COUNT(l."lessonId") AS "CompletedLessons"
// //     FROM
// //         "wa_users_metadata" m inner join "wa_profiles" p on m."profile_id" = p."profile_id"
// //     LEFT JOIN
// //         "wa_lessons_completed" l 
// //         ON m."phoneNumber" = l."phoneNumber" and m."profile_id" = l."profile_id" AND l."completionStatus" = 'Completed'
// //     LEFT JOIN
// //         "Lesson" s 
// //         ON s."LessonId" = l."lessonId" AND s."courseId" = l."courseId"
// //     WHERE
// //         ${target_grp} m."cohort" = '${cohort}' and m."rollout" = ${rollout}
// // 		and p."profile_type" = '${botType}' and ${classLevel}
// //         AND s."courseId" IN (${course_list}) 
// //     GROUP BY
// //         m."phoneNumber", m."profile_id", m."name", s."courseId", s."weekNumber", s."dayNumber"
// // ),
// // FinalProgress AS (
// //     SELECT
// //         ac."phoneNumber",
// // 		ac."profile_id",
// // 		ac."name",
// //         ac."courseId",
// //         ac."weekNumber",
// //         ac."dayNumber",
// //         COALESCE(sc."CompletedLessons", 0) AS "CompletedLessons"
// //     FROM
// //         AllCombinations ac
// //     LEFT JOIN
// //         StudentCompletions sc 
// //         ON ac."phoneNumber" = sc."phoneNumber"
// // 		and ac."profile_id" = sc."profile_id"
// //         AND ac."courseId" = sc."courseId"
// //         AND ac."weekNumber" = sc."weekNumber"
// //         AND ac."dayNumber" = sc."dayNumber"
// // ),
// // DailyProgress AS (
// //     SELECT
// //         fp."phoneNumber",
// // 		fp."profile_id",
// // 		fp."name",
// //         fp."courseId",
// //         fp."weekNumber",
// //         fp."dayNumber",
// //         CASE
// //             WHEN fp."CompletedLessons" = la."TotalLessons" THEN 1
// //             ELSE 0
// //         END AS "DayCompleted"
// //     FROM
// //         FinalProgress fp
// //     JOIN
// //         LessonAssignments la 
// //         ON fp."courseId" = la."courseId"
// //         AND fp."weekNumber" = la."weekNumber"
// //         AND fp."dayNumber" = la."dayNumber"
// // ),
// // WeeklyProgress AS (
// //     SELECT
// //         dp."phoneNumber",
// // 		dp."profile_id",
// // 		dp."name",
// //         dp."courseId",
// //         dp."weekNumber",
// //         SUM(dp."DayCompleted") AS "DaysCompletedInWeek"
// //     FROM
// //         DailyProgress dp
// //     GROUP BY
// //         dp."phoneNumber",dp."profile_id", dp."name", dp."courseId", dp."weekNumber"
// // ),
// // PivotedProgress AS (
// //     SELECT
// //         wp."phoneNumber",
// // 		wp."profile_id",
// // 		wp."name",
// //         wp."courseId",
// //         MAX(CASE WHEN wp."weekNumber" = 1 THEN NULLIF(wp."DaysCompletedInWeek", 0) END) AS "week1",
// //         MAX(CASE WHEN wp."weekNumber" = 2 THEN NULLIF(wp."DaysCompletedInWeek", 0) END) AS "week2",
// //         MAX(CASE WHEN wp."weekNumber" = 3 THEN NULLIF(wp."DaysCompletedInWeek", 0) END) AS "week3",
// //         MAX(CASE WHEN wp."weekNumber" = 4 THEN NULLIF(wp."DaysCompletedInWeek", 0) END) AS "week4"
// //     FROM
// //         WeeklyProgress wp
// //     GROUP BY
// //         wp."phoneNumber", wp."profile_id",wp."name", wp."courseId"
// // ),
// // AggregatedProgress AS (
// //     SELECT
// // 	    ROW_NUMBER() OVER (ORDER BY pp."name") AS sr_no,
// //         pp."profile_id",
// //         pp."phoneNumber",
// // 		pp."name",
// //         ${course_array}
// //     FROM
// //         PivotedProgress pp
// //     GROUP BY
// //         pp."phoneNumber",pp."profile_id",pp."name"
// // )
// // SELECT
// //     *
// // FROM
// //     AggregatedProgress
// // ORDER BY
// //         "name";`;


//         const res = await sequelize.query(qry);

//         return res[0];
//     } catch (error) {
//         error.fileName = "etlRepository.js";
//         throw error;
//     }
// };
const getLessonCompletions = async (botType, rollout, level, cohort, targetGroup, courseId1, courseId2, courseId3) => {
    try {
        let classLevel = '', course_list = '', course_array = '', target_grp = '';

        if (botType === 'teacher') {
            if (rollout == 1 || rollout == 0) {
                target_grp = ` m."targetGroup" = '${targetGroup}' AND `;
            }
            classLevel = `and m."classLevel" is null`;
            course_list = `${courseId1}, ${courseId2}, ${courseId3}`;
            course_array = `
                MAX(CASE WHEN lc."courseId" = ${courseId1} AND lc."weekNumber" = 1 THEN lc."days_completed" END) AS "course1_week1",
                MAX(CASE WHEN lc."courseId" = ${courseId1} AND lc."weekNumber" = 2 THEN lc."days_completed" END) AS "course1_week2",
                MAX(CASE WHEN lc."courseId" = ${courseId1} AND lc."weekNumber" = 3 THEN lc."days_completed" END) AS "course1_week3",
                MAX(CASE WHEN lc."courseId" = ${courseId1} AND lc."weekNumber" = 4 THEN lc."days_completed" END) AS "course1_week4",
                NULLIF(COALESCE(
                    MAX(CASE WHEN lc."courseId" = ${courseId1} AND lc."weekNumber" = 1 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId1} AND lc."weekNumber" = 2 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId1} AND lc."weekNumber" = 3 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId1} AND lc."weekNumber" = 4 THEN lc."days_completed" END), 0)
                , 0) AS "course1_total",
                MAX(CASE WHEN lc."courseId" = ${courseId2} AND lc."weekNumber" = 1 THEN lc."days_completed" END) AS "course2_week1",
                MAX(CASE WHEN lc."courseId" = ${courseId2} AND lc."weekNumber" = 2 THEN lc."days_completed" END) AS "course2_week2",
                MAX(CASE WHEN lc."courseId" = ${courseId2} AND lc."weekNumber" = 3 THEN lc."days_completed" END) AS "course2_week3",
                MAX(CASE WHEN lc."courseId" = ${courseId2} AND lc."weekNumber" = 4 THEN lc."days_completed" END) AS "course2_week4",
                NULLIF(COALESCE(
                    MAX(CASE WHEN lc."courseId" = ${courseId2} AND lc."weekNumber" = 1 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId2} AND lc."weekNumber" = 2 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId2} AND lc."weekNumber" = 3 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId2} AND lc."weekNumber" = 4 THEN lc."days_completed" END), 0)
                , 0) AS "course2_total",
                MAX(CASE WHEN lc."courseId" = ${courseId3} AND lc."weekNumber" = 1 THEN lc."days_completed" END) AS "course3_week1",
                MAX(CASE WHEN lc."courseId" = ${courseId3} AND lc."weekNumber" = 2 THEN lc."days_completed" END) AS "course3_week2",
                MAX(CASE WHEN lc."courseId" = ${courseId3} AND lc."weekNumber" = 3 THEN lc."days_completed" END) AS "course3_week3",
                MAX(CASE WHEN lc."courseId" = ${courseId3} AND lc."weekNumber" = 4 THEN lc."days_completed" END) AS "course3_week4",
                NULLIF(COALESCE(
                    MAX(CASE WHEN lc."courseId" = ${courseId3} AND lc."weekNumber" = 1 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId3} AND lc."weekNumber" = 2 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId3} AND lc."weekNumber" = 3 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId3} AND lc."weekNumber" = 4 THEN lc."days_completed" END), 0)
                , 0) AS "course3_total",
                NULLIF(COALESCE(
                    -- Course 1 total
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId1} AND lc."weekNumber" = 1 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId1} AND lc."weekNumber" = 2 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId1} AND lc."weekNumber" = 3 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId1} AND lc."weekNumber" = 4 THEN lc."days_completed" END), 0) +
                    -- Course 2 total
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId2} AND lc."weekNumber" = 1 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId2} AND lc."weekNumber" = 2 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId2} AND lc."weekNumber" = 3 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId2} AND lc."weekNumber" = 4 THEN lc."days_completed" END), 0) +
                    -- Course 3 total
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId3} AND lc."weekNumber" = 1 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId3} AND lc."weekNumber" = 2 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId3} AND lc."weekNumber" = 3 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId3} AND lc."weekNumber" = 4 THEN lc."days_completed" END), 0)
                , 0), 0) AS grand_total`;
        } else {
            classLevel = `and m."classLevel" = '${level}'`;
            course_list = `${courseId1}`;
            // botType = 'teacher';
            course_array = `
                MAX(CASE WHEN lc."courseId" = ${courseId1} AND lc."weekNumber" = 1 THEN lc."days_completed" END) AS "course1_week1",
                MAX(CASE WHEN lc."courseId" = ${courseId1} AND lc."weekNumber" = 2 THEN lc."days_completed" END) AS "course1_week2",
                MAX(CASE WHEN lc."courseId" = ${courseId1} AND lc."weekNumber" = 3 THEN lc."days_completed" END) AS "course1_week3",
                MAX(CASE WHEN lc."courseId" = ${courseId1} AND lc."weekNumber" = 4 THEN lc."days_completed" END) AS "course1_week4",
                NULLIF(COALESCE(
                    MAX(CASE WHEN lc."courseId" = ${courseId1} AND lc."weekNumber" = 1 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId1} AND lc."weekNumber" = 2 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId1} AND lc."weekNumber" = 3 THEN lc."days_completed" END), 0) +
                    COALESCE(MAX(CASE WHEN lc."courseId" = ${courseId1} AND lc."weekNumber" = 4 THEN lc."days_completed" END), 0)
                , 0) AS "course1_total"`;
        }

        // Optimized query with proper total calculations
        const qry = `
        WITH all_lessons_per_day AS (
            SELECT "courseId", "weekNumber", "dayNumber", COUNT(*) AS total_lessons
            FROM "Lesson"
            WHERE "status" = 'Active' AND "courseId" IN (${course_list})
            GROUP BY "courseId", "weekNumber", "dayNumber"
        ),
        completed_lessons AS (
            SELECT c."profile_id", c."phoneNumber", l."courseId", l."weekNumber", l."dayNumber", COUNT(*) AS completed
            FROM "wa_lessons_completed" c
            JOIN "Lesson" l ON l."LessonId" = c."lessonId"
            WHERE c."completionStatus" = 'Completed' AND l."status" = 'Active'
              AND l."courseId" IN (${course_list})
            GROUP BY c."profile_id", c."phoneNumber", l."courseId", l."weekNumber", l."dayNumber"
        ),
        completed_days AS (
            SELECT cl."profile_id", cl."phoneNumber", cl."courseId", cl."weekNumber", cl."dayNumber"
            FROM completed_lessons cl
            JOIN all_lessons_per_day al ON 
                al."courseId" = cl."courseId" AND 
                al."weekNumber" = cl."weekNumber" AND 
                al."dayNumber" = cl."dayNumber"
            WHERE cl.completed = al.total_lessons
        ),
        lesson_day_counts AS (
            SELECT "profile_id", "phoneNumber", "courseId", "weekNumber", COUNT(DISTINCT "dayNumber") AS days_completed
            FROM completed_days
            GROUP BY "profile_id", "phoneNumber", "courseId", "weekNumber"
        )

        SELECT 
            ROW_NUMBER() OVER (ORDER BY m."name") AS sr_no,
            m."profile_id",
            m."phoneNumber",
            m."name",
            ${course_array}
        FROM "wa_users_metadata" m
        JOIN "wa_profiles" p ON m."profile_id" = p."profile_id"
        LEFT JOIN lesson_day_counts lc ON m."profile_id" = lc."profile_id" AND m."phoneNumber" = lc."phoneNumber"
        WHERE ${target_grp} m."cohort" = '${cohort}'
          AND m."rollout" = ${rollout}
          AND p."profile_type" = '${botType}'
          ${classLevel}
        GROUP BY m."profile_id", m."phoneNumber", m."name"
        ORDER BY m."name";
        `;
        console.log(qry);
        const res = await sequelize.query(qry);
        return res[0];



    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};

const getLessonCompletion = async (course_id, grp, cohort) => {
    try {

        const qry = `WITH LessonAssignments AS (
      SELECT
          "weekNumber",
          "dayNumber",
          COUNT("LessonId") AS "TotalLessons"
      FROM
          "Lesson"
      WHERE
          "courseId" = ${course_id}
      GROUP BY
          "weekNumber", "dayNumber"
      ),
      Students AS (
          SELECT DISTINCT
              m."phoneNumber"
          FROM
              "wa_users_metadata" m
          WHERE
              m."targetGroup" = '${grp}' and m."cohort" = '${cohort}'
      ),
      AllCombinations AS (
          SELECT
              s."phoneNumber",
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
              s."weekNumber",
              s."dayNumber",
              s."courseId",
              COUNT(l."lessonId") AS "CompletedLessons"
          FROM
              "wa_users_metadata" m
          LEFT JOIN
              "wa_lessons_completed" l ON m."phoneNumber" = l."phoneNumber"
              AND l."completionStatus" = 'Completed'
          LEFT JOIN
              "Lesson" s ON s."LessonId" = l."lessonId"
              AND s."courseId" = l."courseId"
          WHERE
              m."targetGroup" = '${grp}' and m."cohort" = '${cohort}' AND s."courseId" = ${course_id}
          GROUP BY
              m."phoneNumber", s."weekNumber", s."dayNumber",s."courseId"
      ),
      FinalProgress AS (
          SELECT
              ac."phoneNumber",
              ac."weekNumber",
              ac."dayNumber",
              sc."courseId",
              COALESCE(sc."CompletedLessons", 0) AS "CompletedLessons"
          FROM
              AllCombinations ac
          LEFT JOIN
              StudentCompletions sc ON ac."phoneNumber" = sc."phoneNumber"
              AND ac."weekNumber" = sc."weekNumber"
              AND ac."dayNumber" = sc."dayNumber"
      ),
      DailyProgress AS (
          SELECT
              fp."phoneNumber",
              fp."weekNumber",
              fp."dayNumber",
              fp."courseId",
              CASE
                  WHEN fp."CompletedLessons" = la."TotalLessons" THEN 1
                  ELSE 0
              END AS "DayCompleted"
          FROM
              FinalProgress fp
          JOIN
              LessonAssignments la ON fp."weekNumber" = la."weekNumber"
              AND fp."dayNumber" = la."dayNumber"
      ),
      WeeklyProgress AS (
          SELECT
              dp."phoneNumber",
              dp."weekNumber",
              dp."courseId",
              SUM(dp."DayCompleted") AS "DaysCompletedInWeek"
          FROM
              DailyProgress dp
          GROUP BY
              dp."phoneNumber", dp."weekNumber",dp."courseId"
      ),
      PivotedProgress AS (
          SELECT
              wp."phoneNumber",
              MAX(CASE 
              WHEN wp."weekNumber" = 1 AND wp."courseId" = 104 AND wp."DaysCompletedInWeek" = 5 
              THEN NULLIF(wp."DaysCompletedInWeek", 0) + 1 
              WHEN wp."weekNumber" = 1 THEN NULLIF(wp."DaysCompletedInWeek", 0)
              ELSE CASE WHEN wp."weekNumber" = 1 THEN NULLIF(wp."DaysCompletedInWeek", 0) END
          END) AS "week111",
              MAX(CASE WHEN wp."weekNumber" = 1 THEN NULLIF(wp."DaysCompletedInWeek", 0) END) AS "week1",
              MAX(CASE WHEN wp."weekNumber" = 2 THEN NULLIF(wp."DaysCompletedInWeek", 0) END) AS "week2",
              MAX(CASE WHEN wp."weekNumber" = 3 THEN NULLIF(wp."DaysCompletedInWeek", 0) END) AS "week3",
              MAX(CASE WHEN wp."weekNumber" = 4 THEN NULLIF(wp."DaysCompletedInWeek", 0) END) AS "week4"
          FROM
              WeeklyProgress wp
          GROUP BY
              wp."phoneNumber"
      )
      SELECT
          pp."phoneNumber",
          pp."week1",
          pp."week2",
          pp."week3",
          pp."week4",
          COALESCE(pp."week1", 0) +
          COALESCE(pp."week2", 0) +
          COALESCE(pp."week3", 0) +
          COALESCE(pp."week4", 0) AS "total_completed_activities_in_all_weeks"
      FROM
          PivotedProgress pp
      ORDER BY
      pp."name";`;


        const res = await sequelize.query(qry);

        return res[0];
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};

const getLastActivityCompleted = async (course_id1, grp, cohort) => {
    try {
        let flag = cohort;
        let cohortCondition = '';
        let total_cnt = [];
        if (cohort == 'Pilots' || cohort == 'Rollout') {
            if (cohort == 'Pilots') { cohort = 'Pilot' } else { cohort = '' }
            total_cnt = await getCount_NotStartedActivity(course_id1, grp, cohort);
            if (cohort === 'Pilot') {
                cohortCondition = `m."cohort" = '${cohort}'`;
            }
            else {
                if ((grp == 'T1' || grp == 'T2') && cohort !== 'Pilot') {
                    cohortCondition = `m."cohort" != 'Pilot'`;
                }
            }
        }
        else {
            cohortCondition = `m."cohort" = '${cohort}'`;
        }

        const qry = `WITH TargetGroup AS (
    SELECT 
        m."phoneNumber"
    FROM 
        "wa_users_metadata" m
    WHERE 
        m."targetGroup" = '${grp}' and ${cohortCondition}
),
get_lessonIds AS (
    SELECT 
        "LessonId", 
        "weekNumber", 
		"dayNumber",
        "SequenceNumber" 
    FROM 
        "Lesson" 
    WHERE 
        "courseId" = ${course_id1} and "status" = 'Active'
),
LessonWithMaxTimestamp AS (
    SELECT 
        l."phoneNumber",
        l."lessonId",
        l."endTime",
        ROW_NUMBER() OVER (
            PARTITION BY l."phoneNumber" 
            ORDER BY l."endTime" DESC
        ) AS row_num
    FROM 
        "wa_lessons_completed" l
    INNER JOIN 
        TargetGroup tg 
    ON 
        l."phoneNumber" = tg."phoneNumber"
    WHERE 
        l."completionStatus" = 'Completed'
        AND l."courseId" = ${course_id1}
),
LessonCompletionCounts AS (
    SELECT 
        lw."lessonId",
        COUNT(lw."phoneNumber") AS "completionCount"
    FROM 
        LessonWithMaxTimestamp lw
    WHERE 
        lw.row_num = 1
    GROUP BY 
        lw."lessonId"
)
SELECT 
    g."LessonId",
    COALESCE(lcc."completionCount", null) AS "total_students_completed"
FROM 
    get_lessonIds g
LEFT JOIN 
    LessonCompletionCounts lcc 
ON 
    g."LessonId" = lcc."lessonId"
ORDER BY 
    g."weekNumber",g."dayNumber",g."SequenceNumber";`


        const res = await sequelize.query(qry);
        let finalOutput = [];
        if (flag == 'Pilots' || flag == 'Rollout') {
            finalOutput = [
                { LessonId: 'Total', total_students_completed: parseInt(total_cnt[0].total_count, 10) },
                { LessonId: 'Start', total_students_completed: parseInt(total_cnt[0].total_not_started, 10) },
                ...res[0].map(item => ({
                    LessonId: item.LessonId,
                    total_students_completed: item.total_students_completed !== null ? parseInt(item.total_students_completed, 10) : null
                }))
            ];
        }
        else {
            finalOutput = res[0];
        }
        return finalOutput;
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};
const getCount_NotStartedActivity = async (course_id, grp, cohort) => {
    try {
        let cohortCondition = '';
        if (cohort === 'Pilot') {
            cohortCondition = `m."cohort" = '${cohort}'`;
        }
        else {
            if ((grp == 'T1' || grp == 'T2') && cohort !== 'Pilot') {
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

const getWeeklyScore = async (botType, rollout, level, cohort, grp, course_id) => {
    try {
        let classLevel = '', target_grp = '';
        if (botType === 'teacher') {
            if (rollout == 1 || rollout == 0) {
                target_grp = ` m."targetGroup" = '${grp}' AND `;
            }
            classLevel = `m."classLevel" is null`;
        }

        const qry = `
WITH target_group_users AS (
    SELECT m."phoneNumber", m."profile_id"
     FROM
        "wa_users_metadata" m inner join "wa_profiles" p on
		m."profile_id" = p."profile_id"
    WHERE
        ${target_grp} m."cohort" = '${cohort}' and m."rollout" = ${rollout}
		and p."profile_type" = '${botType}' and ${classLevel}
),
course_activities AS (
    SELECT "LessonId", "activity", "courseId", "weekNumber"
    FROM "Lesson" 
    WHERE "courseId" = ${course_id} AND "weekNumber" IN (1,2,3,4) and "status" = 'Active'
),
listen_and_speak AS (
    SELECT 
        q."phoneNumber", 
        q."profile_id", 
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
        AND q."profile_id" IN (SELECT "profile_id" FROM target_group_users)
    GROUP BY 
        q."phoneNumber",q."profile_id" ORDER BY q."phoneNumber",q."profile_id"
),
mcqs AS (
    SELECT 
		q."phoneNumber",
        q."profile_id",
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
        AND q."profile_id" IN (SELECT "profile_id" FROM target_group_users)
    GROUP BY 
        q."phoneNumber",q."profile_id"
),
watch_and_speak AS (
    SELECT 
        q."phoneNumber",
        q."profile_id",
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
        AND q."profile_id" IN (SELECT "profile_id" FROM target_group_users)
    GROUP BY 
        q."phoneNumber",q."profile_id"
),
read_activity AS (
    SELECT 
        q."phoneNumber",
        q."profile_id",
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
        AND q."profile_id" IN (SELECT "profile_id" FROM target_group_users)
    GROUP BY 
        q."phoneNumber",q."profile_id"
),
conversational_monologue AS (
    SELECT 
        q."phoneNumber",
        q."profile_id",
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
        AND q."profile_id" IN (SELECT "profile_id" FROM target_group_users)
    GROUP BY 
        q."phoneNumber",q."profile_id"
),
Speaking_practice AS (
    SELECT 
        q."phoneNumber",
        q."profile_id",
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
        AND q."profile_id" IN (SELECT "profile_id" FROM target_group_users)
    GROUP BY 
        q."phoneNumber", q."profile_id"
),
wa_lessons_completed AS (
       select
        m."phoneNumber",
        m."profile_id",
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
        "wa_users_metadata" m inner join "wa_profiles" p on
		m."profile_id" = p."profile_id"
    LEFT JOIN 
        "wa_lessons_completed" l ON m."profile_id" = l."profile_id" 
        AND l."completionStatus" = 'Completed'
    LEFT JOIN 
        "Lesson" s ON s."LessonId" = l."lessonId"  and s."status" = 'Active'
        AND s."courseId" = l."courseId" 
        AND s."courseId" = ${course_id}
    WHERE 
       ${target_grp} m."cohort" = '${cohort}' and m."rollout" = ${rollout}
		and p."profile_type" = '${botType}' and ${classLevel}
    GROUP BY 
        m."phoneNumber",m."profile_id"
)
SELECT 
     ROW_NUMBER() OVER (ORDER BY m."name") AS sr_no,
     m."phoneNumber", 
     m."profile_id",
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
                    ROUND((ROUND(COALESCE(ls.listenAndSpeak_week4_correct_count, 0),2) + ROUND(COALESCE(mc.mcqs_week4_correct_count, 0),2) + ROUND(COALESCE(ws.watchAndSpeak_week4_score, 0),2) + 
                     ROUND(COALESCE(rd.read_week4_score, 0),2) + ROUND(COALESCE(cm.conversationalMonologue_week4_score, 0),2) + ROUND(COALESCE(sp.Speaking_practice_week4_score, 0),2)) /
                    (ROUND(COALESCE(ls.listenAndSpeak_week4_total, 0),2) + ROUND(COALESCE(mc.mcqs_week4_total, 0),2) + ROUND(COALESCE(ws.watchAndSpeak_week4_total, 0),2) + 
                     ROUND(COALESCE(rd.read_week4_total, 0),2) + ROUND(COALESCE(cm.conversationalMonologue_week4_total, 0),2) + ROUND(COALESCE(sp.Speaking_practice_week4_total, 0),2)) * 100, 0)
            END || '%'
        ELSE null
    END AS final_percentage_week4
FROM 
    "wa_users_metadata" m 
    inner join "wa_profiles" p on
		m."profile_id" = p."profile_id"
LEFT JOIN 
    listen_and_speak ls ON m."profile_id" = ls."profile_id"
LEFT JOIN 
    mcqs mc ON m."profile_id" = mc."profile_id"
LEFT JOIN 
    watch_and_speak ws ON m."profile_id" = ws."profile_id"
LEFT JOIN 
    read_activity rd ON m."profile_id" = rd."profile_id"
LEFT JOIN 
    conversational_monologue cm ON m."profile_id" = cm."profile_id"
LEFT JOIN 
    Speaking_practice sp ON m."profile_id" = sp."profile_id"
LEFT JOIN 
    wa_lessons_completed wc ON m."profile_id" = wc."profile_id"
WHERE 
     ${target_grp} m."cohort" = '${cohort}' and m."rollout" = ${rollout}
		and p."profile_type" = '${botType}' and ${classLevel} order by m."name" asc ;`;


        const res = await sequelize.query(qry);

        return res[0];
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};

const getWeeklyScore_pilot = async (course_id, grp, weekNo, cohort) => {
    try {

        const qry = `
  WITH target_group_users AS (
      SELECT "phoneNumber"
      FROM "wa_users_metadata" 
      WHERE "targetGroup" = '${grp}' and "cohort" = '${cohort}'
  ),
  course_activities AS (
      SELECT "LessonId", "activity", "courseId", "weekNumber"
      FROM "Lesson" 
      WHERE "courseId" = ${course_id} AND "weekNumber" IN (${weekNo})
  ),
  listen_and_speak AS (
      SELECT 
          q."phoneNumber",  
          COUNT(CASE 
                   WHEN q."correct" @> ARRAY[TRUE] THEN 1
                   ELSE NULL
               END)  AS listenAndSpeak_correct_count,
          COUNT(*) AS listenAndSpeak_total
      FROM 
          "wa_question_responses" q 
      LEFT JOIN 
          course_activities l ON q."lessonId" = l."LessonId"
      WHERE 
          l."activity" = 'listenAndSpeak' 
          AND q."phoneNumber" IN (SELECT "phoneNumber" FROM target_group_users)
      GROUP BY 
          q."phoneNumber"
  ),
  mcqs AS (
      SELECT 
          q."phoneNumber",  
          SUM(CASE WHEN element = TRUE THEN 1 ELSE 0 END) AS mcqs_correct_count,
          SUM(CASE WHEN element = FALSE THEN 1 ELSE 0 END) AS mcqs_false_count,
          COUNT(element) AS mcqs_total
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
          COALESCE(
              SUM(
                  COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                  COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                  COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
              ) / 300 * 2, 0
          ) AS watchAndSpeak_score,
          COUNT(*) * 2 AS watchAndSpeak_total
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
          COALESCE(
              SUM(
                  COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                  COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                  COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
              ) / 300 * 6, 0
          ) AS read_score,
          COUNT(*) * 6 AS read_total
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
                      WHEN l."courseId" = 98 OR l."courseId" = 99 THEN 
                          COALESCE(("submittedFeedbackJson"[1]->0->'NBest'->0->'PronunciationAssessment'->>'AccuracyScore')::DECIMAL, 0) +
                          COALESCE(("submittedFeedbackJson"[1]->0->'NBest'->0->'PronunciationAssessment'->>'FluencyScore')::DECIMAL, 0) +
                          COALESCE(("submittedFeedbackJson"[1]->0->'NBest'->0->'contentAssessment'->>'CompScore')::DECIMAL, 0)
                      ELSE
                          COALESCE(("submittedFeedbackJson"[1]->'pronunciationAssessment'->>'AccuracyScore')::DECIMAL, 0) +
                          COALESCE(("submittedFeedbackJson"[1]->'pronunciationAssessment'->>'FluencyScore')::DECIMAL, 0) +
                          COALESCE(("submittedFeedbackJson"[1]->'contentAssessment'->>'GrammarScore')::DECIMAL, 0)
                  END
              ) / 300 * 5, 0
          ) AS conversationalMonologueBot_score,
          COUNT(*) * 5 AS conversationalMonologueBot_total
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
      SELECT 
          m."phoneNumber",
          COALESCE(SUM(CASE WHEN s."weekNumber" = ${weekNo} THEN 1 ELSE 0 END), 0) AS completed_activities,
          (SELECT COALESCE(COUNT(s1."LessonId"), 0) 
           FROM "Lesson" s1 
           WHERE s1."weekNumber" = ${weekNo} AND s1."courseId" = ${course_id}) AS total_activities,
          
          CASE 
              WHEN COALESCE(SUM(CASE WHEN s."weekNumber" = ${weekNo} THEN 1 ELSE 0 END), 0) = 
                   (SELECT COALESCE(COUNT(s1."LessonId"), 0) 
                    FROM "Lesson" s1 
                    WHERE s1."weekNumber" = ${weekNo} AND s1."courseId" = ${course_id})
              THEN 1
              ELSE NULL
          end AS completion_activity
      FROM 
          "wa_users_metadata" m 
      LEFT JOIN 
          "wa_lessons_completed" l ON m."phoneNumber" = l."phoneNumber" 
          AND l."completionStatus" = 'Completed'
      LEFT JOIN 
          "Lesson" s ON s."LessonId" = l."lessonId" 
          AND s."courseId" = l."courseId" 
          AND s."courseId" = ${course_id}
          AND s."weekNumber" = ${weekNo}
      WHERE 
          m."targetGroup" = '${grp}' and m."cohort" = '${cohort}'
      GROUP BY 
          m."phoneNumber"
  )
  SELECT 
      m."phoneNumber", 
      -- COALESCE(ls.listenAndSpeak_correct_count, 0) AS listenAndSpeak_correct_count,
      -- COALESCE(ls.listenAndSpeak_total, 0) AS listenAndSpeak_total,
      -- COALESCE(mc.mcqs_correct_count, 0) AS mcqs_correct_count,
      -- COALESCE(mc.mcqs_total, 0) AS mcqs_total,
      -- COALESCE(ws.watchAndSpeak_score, 0) AS watchAndSpeak_score,
      -- COALESCE(ws.watchAndSpeak_total, 0) AS watchAndSpeak_total,
      -- COALESCE(rd.read_score, 0) AS read_score,
      -- COALESCE(rd.read_total, 0) AS read_total,
      -- COALESCE(cm.conversationalMonologueBot_score, 0) AS conversationalMonologueBot_score,
      -- COALESCE(cm.conversationalMonologueBot_total, 0) AS conversationalMonologueBot_total,
      -- COALESCE(wc.completion_activity, 0) AS wa_lessons_completed_percentage,
      
      case when wc.completion_activity = 1 then
      CASE 
          WHEN COALESCE(ls.listenAndSpeak_total, 0) + COALESCE(mc.mcqs_total, 0) + COALESCE(ws.watchAndSpeak_total, 0) + 
               COALESCE(rd.read_total, 0) + COALESCE(cm.conversationalMonologueBot_total, 0) = 0
          THEN 0
          ELSE 
               ROUND((COALESCE(ls.listenAndSpeak_correct_count, 0) + COALESCE(mc.mcqs_correct_count, 0) + COALESCE(ws.watchAndSpeak_score, 0) + 
               COALESCE(rd.read_score, 0) + COALESCE(cm.conversationalMonologueBot_score, 0)) /
              (COALESCE(ls.listenAndSpeak_total, 0) + COALESCE(mc.mcqs_total, 0) + COALESCE(ws.watchAndSpeak_total, 0) + 
               COALESCE(rd.read_total, 0) + COALESCE(cm.conversationalMonologueBot_total, 0)) * 100, 2)
      END || '%'
      else null
      END AS final_percentage
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
      m."targetGroup" = '${grp}' and m."cohort" = '${cohort}';`;


        const res = await sequelize.query(qry);

        return res[0];
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};

const getActivity_Completions = async (botType, rollout, level, cohort, grp, course1_id, course2_id, course3_id) => {
    try {
        let classLevel = '', course_list = '', course_array = '', target_grp = '';
        if (botType === 'teacher') {
            if (rollout == 1 || rollout == 0) {
                target_grp = ` m."targetGroup" = '${grp}' AND `;
            }
            classLevel = `and m."classLevel" is null`;
            course_list = `${course1_id}, ${course2_id}, ${course3_id}`;
            course_array = `SUM(CASE WHEN s."weekNumber" = 1 AND s."courseId" = ${course1_id} THEN 1 ELSE NULL END) AS "course1_week1_activities",
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
                , 0) AS grand_total`
        }
        else if (botType === 'student') {
            classLevel = `and m."classLevel" = '${level}'`;
            // botType = 'teacher'
            course_list = `${course1_id}`;
            course_array = `SUM(CASE WHEN s."weekNumber" = 1 AND s."courseId" = ${course1_id} THEN 1 ELSE NULL END) AS "course1_week1_activities",
                SUM(CASE WHEN s."weekNumber" = 2 AND s."courseId" = ${course1_id} THEN 1 ELSE NULL END) AS "course1_week2_activities",
                SUM(CASE WHEN s."weekNumber" = 3 AND s."courseId" = ${course1_id} THEN 1 ELSE NULL END) AS "course1_week3_activities",
                SUM(CASE WHEN s."weekNumber" = 4 AND s."courseId" = ${course1_id} THEN 1 ELSE NULL END) AS "course1_week4_activities",
                
                NULLIF(SUM(CASE WHEN s."courseId" = ${course1_id} THEN 1 ELSE 0 END), 0) AS course1_total`;
        }
        const qry = `
            SELECT 
                ROW_NUMBER() OVER (ORDER BY m."name") AS sr_no,
                m."profile_id",
                m."phoneNumber", 
                m."name",
                ${course_array}
            FROM 
                "wa_users_metadata" m 
                inner join "wa_profiles" p on
		m."profile_id" = p."profile_id"
            LEFT JOIN 
                "wa_lessons_completed" l 
                ON m."profile_id" = l."profile_id" 
                AND l."completionStatus" = 'Completed' 
            LEFT JOIN 
                "Lesson" s 
                ON s."LessonId" = l."lessonId" 
                AND s."courseId" = l."courseId" 
                AND s."courseId" IN (${course_list}) 
                AND s."weekNumber" IN (1, 2, 3, 4) and s."status" = 'Active'
            WHERE 
                ${target_grp} m."cohort" = '${cohort}' and m."rollout" = ${rollout}
		       and p."profile_type" = '${botType}' ${classLevel}
            GROUP BY 
                m."name", m."phoneNumber", m."profile_id"
            ORDER BY 
                m."name" ASC;
        `;

        const res = await sequelize.query(qry);
        return res[0];
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};

const getActivtyAssessmentScore = async (botType, rollout, level, cohort, targetGroup, courseId) => {
    try {
        let classLevel = '', targetGrpCondition = '', joinString = '';
        let speakingPracticeCTE = '';
        let endColumns = '';

        // Build the target group condition
        if (botType === 'teacher' && (rollout == 1 || rollout == 0)) {
            targetGrpCondition = `m."targetGroup" = '${targetGroup}' AND `;
        }

        // Build the class level condition
        if (botType === 'teacher') {
            classLevel = `AND m."classLevel" IS NULL AND m."cohort" = '${cohort}'`;
        } else if (botType === 'student') {
            classLevel = `AND m."classLevel" = '${level}' AND m."cohort" = '${cohort}'`;
        }

        // Common CTEs
        const commonCTEs = `
WITH target_group_users AS (
    SELECT 
        m."phoneNumber", 
        m."profile_id",
        m."name"
    FROM 
        "wa_users_metadata" m 
    INNER JOIN 
        "wa_profiles" p ON m."profile_id" = p."profile_id"
    WHERE 
        ${targetGrpCondition} 
        m."rollout" = ${rollout}
        AND p."profile_type" = '${botType}' 
        ${classLevel}
),
course_activities AS (
    SELECT 
        "LessonId", 
        "activity", 
        "courseId", 
        "weekNumber"
    FROM 
        "Lesson" 
    WHERE 
        "courseId" = ${courseId} 
        AND "weekNumber" IN (1,2,3,4) 
        AND "status" = 'Active'
),
mcqs AS (
    SELECT 
        q."phoneNumber",
        q."profile_id",
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
        l."activity" = 'assessmentMcqs' 
        AND q."profile_id" IN (SELECT "profile_id" FROM target_group_users)
    GROUP BY 
        q."phoneNumber", q."profile_id"
),
watch_and_speak AS (
    SELECT 
        q."phoneNumber",
        q."profile_id",
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
        l."activity" = 'assessmentWatchAndSpeak' 
        AND q."profile_id" IN (SELECT "profile_id" FROM target_group_users)
    GROUP BY 
        q."phoneNumber", q."profile_id"
)`;

        // Special handling for grade 7 students
        if (botType === 'student' && level === 'grade 7') {
            speakingPracticeCTE = `,
speaking_practice AS (
    SELECT 
        q."phoneNumber",
        q."profile_id",
        COALESCE(
            SUM(
                CASE WHEN l."weekNumber" = 1 THEN 
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                END
            ) / 300 * 5, 0
        ) AS speaking_practice_week1_correct_count,
        COUNT(CASE WHEN l."weekNumber" = 1 THEN 1 ELSE NULL END) * 5 AS speaking_practice_week1_total,
        COALESCE(
            SUM(
                CASE WHEN l."weekNumber" = 2 THEN 
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                END
            ) / 300 * 5, 0
        ) AS speaking_practice_week2_correct_count,
        COUNT(CASE WHEN l."weekNumber" = 2 THEN 1 ELSE NULL END) * 5 AS speaking_practice_week2_total,
        COALESCE(
            SUM(
                CASE WHEN l."weekNumber" = 3 THEN 
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                END
            ) / 300 * 5, 0
        ) AS speaking_practice_week3_correct_count,
        COUNT(CASE WHEN l."weekNumber" = 3 THEN 1 ELSE NULL END) * 5 AS speaking_practice_week3_total,
        COALESCE(
            SUM(
                CASE WHEN l."weekNumber" = 4 THEN 
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                END
            ) / 300 * 5, 0
        ) AS speaking_practice_week4_correct_count,
        COUNT(CASE WHEN l."weekNumber" = 4 THEN 1 ELSE NULL END) * 5 AS speaking_practice_week4_total
    FROM 
        "wa_question_responses" q 
    LEFT JOIN 
        course_activities l ON l."LessonId" = q."lessonId"
    WHERE 
        l."activity" = 'speakingPractice' 
        AND q."profile_id" IN (SELECT "profile_id" FROM target_group_users)
    GROUP BY 
        q."phoneNumber", q."profile_id"
)`;

            joinString = `LEFT JOIN speaking_practice sp ON m."profile_id" = sp."profile_id"`;

            endColumns = `
    CASE 
        WHEN round(COALESCE(mc.mcqs_week1_correct_count, 0), 2) + round(COALESCE(mc.mcqs_week2_correct_count, 0), 2) 
            + round(COALESCE(mc.mcqs_week3_correct_count, 0), 2) + round(COALESCE(mc.mcqs_week4_correct_count, 0), 2) = 0 THEN NULL
        ELSE round(COALESCE(mc.mcqs_week1_correct_count, 0), 2) + round(COALESCE(mc.mcqs_week2_correct_count, 0), 2) 
            + round(COALESCE(mc.mcqs_week3_correct_count, 0), 2) + round(COALESCE(mc.mcqs_week4_correct_count, 0), 2)
    END AS "mcqs",

    round(COALESCE(mc.mcqs_week1_total, 0), 2) + round(COALESCE(mc.mcqs_week2_total, 0), 2)
            + round(COALESCE(mc.mcqs_week3_total, 0), 2) + round(COALESCE(mc.mcqs_week4_total, 0), 2)
    AS "mcqs_total",

    CASE 
        WHEN round(COALESCE(sp.speaking_practice_week1_correct_count, 0), 2) + round(COALESCE(sp.speaking_practice_week2_correct_count, 0), 2) 
            + round(COALESCE(sp.speaking_practice_week3_correct_count, 0), 2) + round(COALESCE(sp.speaking_practice_week4_correct_count, 0), 2) = 0 THEN NULL
        ELSE round(COALESCE(sp.speaking_practice_week1_correct_count, 0), 2) + round(COALESCE(sp.speaking_practice_week2_correct_count, 0), 2) 
            + round(COALESCE(sp.speaking_practice_week3_correct_count, 0), 2) + round(COALESCE(sp.speaking_practice_week4_correct_count, 0), 2)
    END AS "speaking_practice",

    round(COALESCE(sp.speaking_practice_week1_total, 0), 2) + round(COALESCE(sp.speaking_practice_week2_total, 0), 2)
            + round(COALESCE(sp.speaking_practice_week3_total, 0), 2) + round(COALESCE(sp.speaking_practice_week4_total, 0), 2)
    AS "speaking_practice_total",

    NULLIF(round(
        COALESCE(
            CASE 
                WHEN round(COALESCE(mc.mcqs_week1_correct_count, 0), 2) + round(COALESCE(mc.mcqs_week2_correct_count, 0), 2) 
                    + round(COALESCE(mc.mcqs_week3_correct_count, 0), 2) + round(COALESCE(mc.mcqs_week4_correct_count, 0), 2) = 0 THEN NULL
                ELSE round(COALESCE(mc.mcqs_week1_correct_count, 0), 2) + round(COALESCE(mc.mcqs_week2_correct_count, 0), 2) 
                    + round(COALESCE(mc.mcqs_week3_correct_count, 0), 2) + round(COALESCE(mc.mcqs_week4_correct_count, 0), 2)
            END, 0
        ) +
        COALESCE(
            CASE 
                WHEN round(COALESCE(sp.speaking_practice_week1_correct_count, 0), 2) + round(COALESCE(sp.speaking_practice_week2_correct_count, 0), 2)
                    + round(COALESCE(sp.speaking_practice_week3_correct_count, 0), 2) + round(COALESCE(sp.speaking_practice_week4_correct_count, 0), 2) = 0 THEN NULL
                ELSE round(COALESCE(sp.speaking_practice_week1_correct_count, 0), 2) + round(COALESCE(sp.speaking_practice_week2_correct_count, 0), 2)
                    + round(COALESCE(sp.speaking_practice_week3_correct_count, 0), 2) + round(COALESCE(sp.speaking_practice_week4_correct_count, 0), 2)
            END, 0
        ), 2), 0) AS total_activity_score`;
        } else {
            // Default columns for non-grade 7 students
            endColumns = `
    CASE 
        WHEN round(COALESCE(mc.mcqs_week1_correct_count, 0), 2) + round(COALESCE(mc.mcqs_week2_correct_count, 0), 2) 
            + round(COALESCE(mc.mcqs_week3_correct_count, 0), 2) + round(COALESCE(mc.mcqs_week4_correct_count, 0), 2) = 0 THEN NULL
        ELSE round(COALESCE(mc.mcqs_week1_correct_count, 0), 2) + round(COALESCE(mc.mcqs_week2_correct_count, 0), 2) 
            + round(COALESCE(mc.mcqs_week3_correct_count, 0), 2) + round(COALESCE(mc.mcqs_week4_correct_count, 0), 2)
    END AS "mcqs",

    round(COALESCE(mc.mcqs_week1_total, 0), 2) + round(COALESCE(mc.mcqs_week2_total, 0), 2)
            + round(COALESCE(mc.mcqs_week3_total, 0), 2) + round(COALESCE(mc.mcqs_week4_total, 0), 2)
    AS "mcqs_total",

    CASE 
        WHEN round(COALESCE(ws.watchAndSpeak_week1_score, 0), 2) + round(COALESCE(ws.watchAndSpeak_week2_score, 0), 2)
            + round(COALESCE(ws.watchAndSpeak_week3_score, 0), 2) + round(COALESCE(ws.watchAndSpeak_week4_score, 0), 2) = 0 THEN NULL
        ELSE round(COALESCE(ws.watchAndSpeak_week1_score, 0), 2) + round(COALESCE(ws.watchAndSpeak_week2_score, 0), 2)
            + round(COALESCE(ws.watchAndSpeak_week3_score, 0), 2) + round(COALESCE(ws.watchAndSpeak_week4_score, 0), 2)
    END AS "watchAndSpeak",
    
    round(COALESCE(ws.watchAndSpeak_week1_total, 0), 2) + round(COALESCE(ws.watchAndSpeak_week2_total, 0), 2)
            + round(COALESCE(ws.watchAndSpeak_week3_total, 0), 2) + round(COALESCE(ws.watchAndSpeak_week4_total, 0), 2)
    AS "watchAndSpeak_total",

    NULLIF(round(
        COALESCE(
            CASE 
                WHEN round(COALESCE(mc.mcqs_week1_correct_count, 0), 2) + round(COALESCE(mc.mcqs_week2_correct_count, 0), 2) 
                    + round(COALESCE(mc.mcqs_week3_correct_count, 0), 2) + round(COALESCE(mc.mcqs_week4_correct_count, 0), 2) = 0 THEN NULL
                ELSE round(COALESCE(mc.mcqs_week1_correct_count, 0), 2) + round(COALESCE(mc.mcqs_week2_correct_count, 0), 2) 
                    + round(COALESCE(mc.mcqs_week3_correct_count, 0), 2) + round(COALESCE(mc.mcqs_week4_correct_count, 0), 2)
            END, 0) + 
        COALESCE(
            CASE 
                WHEN round(COALESCE(ws.watchAndSpeak_week1_score, 0), 2) + round(COALESCE(ws.watchAndSpeak_week2_score, 0), 2)
                    + round(COALESCE(ws.watchAndSpeak_week3_score, 0), 2) + round(COALESCE(ws.watchAndSpeak_week4_score, 0), 2) = 0 THEN NULL
                ELSE round(COALESCE(ws.watchAndSpeak_week1_score, 0), 2) + round(COALESCE(ws.watchAndSpeak_week2_score, 0), 2)
                    + round(COALESCE(ws.watchAndSpeak_week3_score, 0), 2) + round(COALESCE(ws.watchAndSpeak_week4_score, 0), 2)
            END, 0), 2), 0) AS total_activity_score`;

            joinString = `LEFT JOIN watch_and_speak ws ON m."profile_id" = ws."profile_id"`;
        }

        // Build the final query
        const query = `
${commonCTEs}
${speakingPracticeCTE}
SELECT 
    ROW_NUMBER() OVER (ORDER BY m."name") AS sr_no,
    m."phoneNumber", 
    m."profile_id",
    m."name",
    ${endColumns}
FROM 
    "wa_users_metadata" m 
INNER JOIN 
    "wa_profiles" p ON m."profile_id" = p."profile_id"
LEFT JOIN 
    mcqs mc ON m."profile_id" = mc."profile_id"
${joinString}
WHERE 
    ${targetGrpCondition} 
    m."rollout" = ${rollout}
    AND p."profile_type" = '${botType}' 
    ${classLevel}
ORDER BY 
    m."name" ASC;
`;
if(courseId == 139) {
            console.log("Executing query for courseId 139:", query);
        }


        // Execute the query
        const result = await sequelize.query(query);
        return result[0];
    } catch (error) {
        console.error("Error in getActivityAssessmentScore:", error);
        error.fileName = "etlRepository.js";
        throw error;
    }
};

const getActivityNameCount = async (course_id1, course_id2, course_id3, grp, cohort) => {
    try {
        const qry1 = `select "activity", count("activity") from "Lesson" where ("courseId" = ${course_id1} or "courseId" = ${course_id2} or "courseId" = ${course_id3})  group by "activity" order by "activity";`;
        const res1 = await sequelize.query(qry1);
        let cohort1 = cohort;
        let activities = res1[0].map(item => item.activity);

        const dynamicSumActivity = activities.map(activity => `COALESCE(sum(case when s."activity" = '${activity}' then 1 else null end), null) as "${activity}"`).join(",\n");
        let qry2;
        if (cohort != '') {
            cohort = `m."cohort" = '${cohort}'`;
            qry2 = `
      SELECT 
        ${dynamicSumActivity}
      FROM 
        "wa_users_metadata" m
      LEFT JOIN 
        "wa_lessons_completed" l 
      ON 
        m."phoneNumber" = l."phoneNumber" 
        AND (l."courseId" = ${course_id1} OR l."courseId" = ${course_id2} OR l."courseId" = ${course_id3})
        AND l."completionStatus" = 'Completed'
      LEFT JOIN 
        "Lesson" s 
      ON 
        l."lessonId" = s."LessonId" 
        AND l."courseId" = s."courseId"
      WHERE 
        m."targetGroup" = '${grp}' and ${cohort}
      GROUP BY 
        m."phoneNumber"
      ORDER BY 
        m."name" ASC;`;
        }
        else {
            cohort = `m."cohort" != 'Pilot'`;
            qry2 = `
      SELECT 
        ROW_NUMBER() OVER (ORDER BY MAX(m."cohort") ASC) AS row_number,
        m."phoneNumber",
        MAX(m."name") AS "name",
        ${dynamicSumActivity},
        max(m."cohort") as "cohort"
      FROM 
        "wa_users_metadata" m
      LEFT JOIN 
        "wa_lessons_completed" l 
      ON 
        m."phoneNumber" = l."phoneNumber" 
        AND (l."courseId" = ${course_id1} OR l."courseId" = ${course_id2} OR l."courseId" = ${course_id3})
        AND l."completionStatus" = 'Completed'
      LEFT JOIN 
        "Lesson" s 
      ON 
        l."lessonId" = s."LessonId" 
        AND l."courseId" = s."courseId"
      WHERE 
        m."targetGroup" = '${grp}' and ${cohort}
      GROUP BY 
        m."phoneNumber",  m."cohort"
      ORDER BY 
        m."cohort" ASC;`;
        }

        const res2 = await sequelize.query(qry2);
        let activityTotal = [];

        let counts = res1[0].map(item => parseInt(item.count, 10));
        if (cohort1 == '') {
            counts = [null, null, null, ...counts, null]; // Prepend 3 nulls and append 1 null to counts
            activities = [null, null, null, ...activities, null]; // Prepend 3 nulls and append 1 null to activities
        }
        activityTotal.push(counts);

        activityTotal.push(activities);

        let activityCompleted = res2[0].map(obj =>
            Object.values(obj).map(value => value)
        );

        activityTotal = activityTotal.concat(activityCompleted);

        return activityTotal;
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};

const getPhoneNumber_userNudges = async (course_id, grp, cohort, date) => {
    try {
        const qry = `
            SELECT distinct m."phoneNumber"
            FROM "wa_users_metadata" m 
            left JOIN "wa_lessons_completed" l
            ON m."phoneNumber" = l."phoneNumber" 
            AND l."completionStatus" = 'Completed'  
            AND l."endTime" >= '${date}' and l."courseId" = ${course_id}
            WHERE m."targetGroup" = '${grp}' 
            AND m."cohort" = '${cohort}'  AND l."phoneNumber" IS NOT NULL;
        `;

        const res = await sequelize.query(qry);
        return res[0];
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};


const getLastActivityCompleted_DropOff = async (course_id1) => {
    try {
        const qry = `WITH TargetGroup AS (
    SELECT 
        m."phoneNumber"
    FROM 
        "wa_users_metadata" m left join "wa_profiles" p on m."phoneNumber" = p."phone_number" and m."profile_id" = p."profile_id"
    WHERE 
        p."profile_type" = 'student'
        ),
        get_lessonIds AS (
            SELECT 
                "LessonId", 
                "weekNumber", 
                "dayNumber",
                "SequenceNumber" 
            FROM 
                "Lesson" 
            WHERE 
                "courseId" = ${course_id1} and "status" = 'Active'
        ),
        LessonWithMaxTimestamp AS (
            SELECT 
                l."phoneNumber",
                l."lessonId",
                l."endTime",
                ROW_NUMBER() OVER (
                    PARTITION BY l."phoneNumber" 
                    ORDER BY l."endTime" DESC
                ) AS row_num
            FROM 
                "wa_lessons_completed" l
            INNER JOIN 
                TargetGroup tg 
            ON 
                l."phoneNumber" = tg."phoneNumber"
            WHERE 
                l."completionStatus" = 'Completed'
                AND l."courseId" = ${course_id1}
        ),
        LessonCompletionCounts AS (
            SELECT 
                lw."lessonId",
                COUNT(lw."phoneNumber") AS "completionCount"
            FROM 
                LessonWithMaxTimestamp lw
            WHERE 
                lw.row_num = 1
            GROUP BY 
                lw."lessonId"
        )
        SELECT 
            g."LessonId",
            COALESCE(lcc."completionCount", null) AS "total_students_completed"
        FROM 
            get_lessonIds g
        LEFT JOIN 
            LessonCompletionCounts lcc 
        ON 
            g."LessonId" = lcc."lessonId"
        ORDER BY 
            g."weekNumber",g."dayNumber",g."SequenceNumber";`;
        const res = await sequelize.query(qry);
        return res[0];
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};

const getCumulativeLessonCompletions = async () => {
    try {
        const qry = `
        WITH student_courses AS (
    -- Get each student's actual assigned courses (one per grade)
    SELECT DISTINCT
        m."profile_id",
        m."phoneNumber",
        m."name",
        m."classLevel" AS grade,
        m."cohort",
        m."rollout",
        -- Map grade to course (adjust these mappings as needed)
        CASE m."classLevel"
            WHEN 'grade 1' THEN 119
            WHEN 'grade 2' THEN 120
            WHEN 'grade 3' THEN 121
            WHEN 'grade 4' THEN 122
            WHEN 'grade 5' THEN 123
            WHEN 'grade 6' THEN 124
            WHEN 'grade 7' THEN 143
        END AS "courseId"
    FROM "wa_users_metadata" m
    INNER JOIN "wa_profiles" p ON m."profile_id" = p."profile_id"
    WHERE
        m."rollout" = 2
        AND p."profile_type" = 'student'
        AND m."classLevel" IN ('grade 1', 'grade 2', 'grade 3', 'grade 4', 'grade 5', 'grade 6', 'grade 7')
        AND m."cohort" IS NOT NULL and m."cohort" != 'Cohort 0'
),

lesson_completions AS (
    -- Get completion data for all relevant courses
    SELECT 
        wlc."profile_id",
        wlc."phoneNumber",
        l."courseId",
        l."weekNumber",
        COUNT(DISTINCT l."dayNumber") AS days_completed
    FROM "wa_lessons_completed" wlc
    INNER JOIN "Lesson" l ON l."LessonId" = wlc."lessonId"
        AND l."courseId" = wlc."courseId"
        AND l."status" = 'Active'
    WHERE wlc."completionStatus" = 'Completed'
        AND l."courseId" IN (119,120,121,122,123,124,143)
    GROUP BY wlc."profile_id", wlc."phoneNumber", l."courseId", l."weekNumber"
),

user_weekly_progress AS (
    -- Pivot weekly completion data
    SELECT
        lc."profile_id",
        lc."phoneNumber",
        lc."courseId",
        MAX(CASE WHEN lc."weekNumber" = 1 THEN lc."days_completed" END) AS week1,
        MAX(CASE WHEN lc."weekNumber" = 2 THEN lc."days_completed" END) AS week2,
        MAX(CASE WHEN lc."weekNumber" = 3 THEN lc."days_completed" END) AS week3,
        MAX(CASE WHEN lc."weekNumber" = 4 THEN lc."days_completed" END) AS week4
    FROM lesson_completions lc
    GROUP BY lc."profile_id", lc."phoneNumber", lc."courseId"
)

-- Final result with all students and their completion data
SELECT
    ROW_NUMBER() OVER (ORDER BY sc.grade, sc."cohort", sc."name") AS sr_no,
    sc."profile_id",
    sc."phoneNumber",
    sc."name",
    COALESCE(up.week1, null) AS week1,
    COALESCE(up.week2, null) AS week2,
    COALESCE(up.week3, null) AS week3,
    COALESCE(up.week4, null) AS week4,
    nullif(COALESCE(up.week1, 0) + COALESCE(up.week2, 0) + 
    COALESCE(up.week3, 0) + COALESCE(up.week4, 0),0) AS total,
    sc."courseId",
    sc.grade,
    sc."cohort",
    sc."rollout"
FROM student_courses sc
LEFT JOIN user_weekly_progress up ON sc."profile_id" = up."profile_id"
    AND sc."phoneNumber" = up."phoneNumber"
    AND sc."courseId" = up."courseId"
ORDER BY sc.grade, sc."cohort", sc."name";
        `;

        // console.log("Cumulative Weekly Completion Query (All Users):", qry);
        const res = await sequelize.query(qry);
        return res[0];
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};


const getCumulativeActivityCompletions = async () => {
  try {
    const qry = `
      WITH student_courses AS (
        SELECT DISTINCT
            m."profile_id",
            m."phoneNumber",
            m."name",
            m."classLevel" AS grade,
            m."cohort",
            m."rollout",
            CASE m."classLevel"
                WHEN 'grade 1' THEN 119
                WHEN 'grade 2' THEN 120
                WHEN 'grade 3' THEN 121
                WHEN 'grade 4' THEN 122
                WHEN 'grade 5' THEN 123
                WHEN 'grade 6' THEN 124
                WHEN 'grade 7' THEN 143
            END AS "courseId"
        FROM "wa_users_metadata" m
        INNER JOIN "wa_profiles" p ON m."profile_id" = p."profile_id"
        WHERE 
            m."rollout" = 2
            AND p."profile_type" = 'student'
            AND m."classLevel" IN ('grade 1', 'grade 2', 'grade 3', 'grade 4', 'grade 5', 'grade 6', 'grade 7')
            AND m."cohort" IS NOT NULL and m."cohort" != 'Cohort 0'
      ),
      activity_completions AS (
        SELECT 
            wlc."profile_id",
            wlc."phoneNumber",
            l."courseId",
            l."weekNumber",
            COUNT(*) AS activities_completed
        FROM "wa_lessons_completed" wlc
        INNER JOIN "Lesson" l ON l."LessonId" = wlc."lessonId"
            AND l."courseId" = wlc."courseId"
            AND l."status" = 'Active'
        WHERE wlc."completionStatus" = 'Completed'
            AND l."courseId" IN (119,120,121,122,123,124,143)
        GROUP BY wlc."profile_id", wlc."phoneNumber", l."courseId", l."weekNumber"
      ),
      user_weekly_activities AS (
        SELECT
            ac."profile_id",
            ac."phoneNumber",
            ac."courseId",
            MAX(CASE WHEN ac."weekNumber" = 1 THEN ac."activities_completed" END) AS week1,
            MAX(CASE WHEN ac."weekNumber" = 2 THEN ac."activities_completed" END) AS week2,
            MAX(CASE WHEN ac."weekNumber" = 3 THEN ac."activities_completed" END) AS week3,
            MAX(CASE WHEN ac."weekNumber" = 4 THEN ac."activities_completed" END) AS week4
        FROM activity_completions ac
        GROUP BY ac."profile_id", ac."phoneNumber", ac."courseId"
      )
      SELECT
          ROW_NUMBER() OVER (ORDER BY sc.grade, sc."cohort", sc."name") AS sr_no,
          sc."profile_id",
          sc."phoneNumber",
          sc."name",
          COALESCE(uwa.week1, null) AS week1,
          COALESCE(uwa.week2, null) AS week2,
          COALESCE(uwa.week3, null) AS week3,
          COALESCE(uwa.week4, null) AS week4,
          NULLIF(
            COALESCE(uwa.week1, 0) + 
            COALESCE(uwa.week2, 0) + 
            COALESCE(uwa.week3, 0) + 
            COALESCE(uwa.week4, 0), 0
          ) AS total,
           sc."courseId",
          sc."grade",
          sc."cohort",
          sc."rollout"
      FROM student_courses sc
      LEFT JOIN user_weekly_activities uwa 
        ON sc."profile_id" = uwa."profile_id" 
        AND sc."phoneNumber" = uwa."phoneNumber"
        AND sc."courseId" = uwa."courseId"
      ORDER BY sc.grade, sc."cohort", sc."name";
    `;

    const res = await sequelize.query(qry);
    return res[0];
  } catch (error) {
    error.fileName = "etlRepository.js";
    throw error;
  }
};


const getUserProgressStats = async (botType, grade, cohort, rollout, courseId1, courseId2) => {
    try {
       let level =  ``;
        if (botType === 'teacher'){
          level =  ``;
        }
        else{
            level =  ` AND m."classLevel" = '${grade}' `;
        }
        const qry = `WITH target_group AS (
                SELECT m.profile_id
                FROM wa_users_metadata m
                INNER JOIN wa_profiles p ON m.profile_id = p.profile_id
                WHERE p.profile_type = '${botType}'
                AND m.rollout = ${rollout}
                ${level}
                AND m.cohort = '${cohort}'
            ),

            -- First and Last lessons
            actual_course_start_lesson AS (
                SELECT "LessonId","courseId"
                FROM "Lesson"
                WHERE "courseId" = ${courseId1} AND "weekNumber" = 1 AND "dayNumber" = 1 AND "SequenceNumber" = 1 and "status" = 'Active'
                LIMIT 1
            ),

            actual_course_last_lesson AS (
                SELECT "LessonId" ,"courseId"
                FROM "Lesson"
                WHERE "courseId" = ${courseId1}  and "status" = 'Active'
                ORDER BY "weekNumber" DESC, "dayNumber" DESC, "SequenceNumber" DESC
                LIMIT 1
            ),

            assessment_course_start_lesson AS (
                SELECT "LessonId","courseId"
                FROM "Lesson"
                WHERE "courseId" = ${courseId2} AND "weekNumber" = 1 AND "dayNumber" = 1 AND "SequenceNumber" = 1 and "status" = 'Active'
                LIMIT 1
            ),

            assessment_course_last_lesson AS (
                SELECT "LessonId","courseId"
                FROM "Lesson"
                WHERE "courseId" = ${courseId2}  and "status" = 'Active'
                ORDER BY "weekNumber" DESC, "dayNumber" DESC, "SequenceNumber" DESC
                LIMIT 1
            ),

            started_main AS (
                SELECT DISTINCT c.profile_id
                FROM wa_lessons_completed c
                JOIN "Lesson" l ON l."LessonId" = c."lessonId" and l."courseId" = c."courseId"
                JOIN target_group tg ON tg.profile_id = c.profile_id
                WHERE l."courseId" = ${courseId1}
            ),

            completed_main AS (
                SELECT DISTINCT c.profile_id
                FROM wa_lessons_completed c
                JOIN actual_course_last_lesson last_lesson ON last_lesson."LessonId" = c."lessonId" and last_lesson."courseId" = c."courseId"
                JOIN target_group tg ON tg.profile_id = c.profile_id
                WHERE c."completionStatus" = 'Completed'
            ),

            started_assessment AS (
                SELECT DISTINCT c.profile_id
                FROM wa_lessons_completed c
                JOIN "Lesson" l ON l."LessonId" = c."lessonId" and l."courseId" = c."courseId"
                JOIN target_group tg ON tg.profile_id = c.profile_id
                WHERE l."courseId" = ${courseId2}
            ),

            completed_assessment AS (
                SELECT DISTINCT c.profile_id
                FROM wa_lessons_completed c
                JOIN assessment_course_last_lesson last_lesson ON last_lesson."LessonId" = c."lessonId" and last_lesson."courseId" = c."courseId"
                JOIN target_group tg ON tg.profile_id = c.profile_id
                WHERE c."completionStatus" = 'Completed'
            ),

            not_started_assessment AS (
                SELECT tg.profile_id
                FROM target_group tg
                LEFT JOIN wa_lessons_completed c
                    ON tg.profile_id = c.profile_id
                    AND c."lessonId" = (SELECT "LessonId" FROM assessment_course_start_lesson)
                WHERE c.profile_id IS NULL
            ),

            completed_assessment_not_started_main AS (
                SELECT ca.profile_id
                FROM completed_assessment ca
                LEFT JOIN started_main sm ON ca.profile_id = sm.profile_id
                WHERE sm.profile_id IS NULL
            )

            SELECT
                (SELECT COUNT(*) FROM target_group) AS totalUsers,
                (SELECT COUNT(*) FROM started_main) AS startedMainCourse,
                (SELECT COUNT(*) FROM completed_main) AS completedMainCourse,
                (SELECT COUNT(*) FROM started_assessment) AS startedPreAssessment,
                (SELECT COUNT(*) FROM completed_assessment) AS completedPreAssessment,
                (SELECT COUNT(*) FROM completed_assessment_not_started_main) AS completedAssessmentButNotStartedMain,
                (SELECT COUNT(*) FROM not_started_assessment) AS notStartedPreAssessment;
            `;
        const res = await sequelize.query(qry);
        return res[0];
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};


const getUserProgressBarStats = async (botType, grade, cohort, rollout, courseId1, courseId2, condition_name) => {
    try {
        let level = ``;
        if (botType !== 'teacher') {
            level = `AND m."classLevel" = '${grade}'`;
        }

        const query = `
        WITH target_group AS (
            SELECT m.profile_id, m."phoneNumber", m."name", m."schoolName", m."city",
                    m."customerChannel", m."customerSource",
                   m."amountPaid", m."rollout"
            FROM wa_users_metadata m
            INNER JOIN wa_profiles p ON m.profile_id = p.profile_id
            WHERE p.profile_type = '${botType}'
              AND m.rollout = ${rollout}
              ${level}
              AND m.cohort = '${cohort}'
        ),

        actual_course_start_lesson AS (
            SELECT "LessonId", "courseId"
            FROM "Lesson"
            WHERE "courseId" = ${courseId1} AND "weekNumber" = 1 AND "dayNumber" = 1 AND "SequenceNumber" = 1 AND "status" = 'Active'
            LIMIT 1
        ),

        actual_course_last_lesson AS (
            SELECT "LessonId", "courseId"
            FROM "Lesson"
            WHERE "courseId" = ${courseId1} AND "status" = 'Active'
            ORDER BY "weekNumber" DESC, "dayNumber" DESC, "SequenceNumber" DESC
            LIMIT 1
        ),

        assessment_course_start_lesson AS (
            SELECT "LessonId", "courseId"
            FROM "Lesson"
            WHERE "courseId" = ${courseId2} AND "weekNumber" = 1 AND "dayNumber" = 1 AND "SequenceNumber" = 1 AND "status" = 'Active'
            LIMIT 1
        ),

        assessment_course_last_lesson AS (
            SELECT "LessonId", "courseId"
            FROM "Lesson"
            WHERE "courseId" = ${courseId2} AND "status" = 'Active'
            ORDER BY "weekNumber" DESC, "dayNumber" DESC, "SequenceNumber" DESC
            LIMIT 1
        ),

        started_main AS (
            SELECT DISTINCT c.profile_id
            FROM wa_lessons_completed c
            JOIN "Lesson" l ON l."LessonId" = c."lessonId" AND l."courseId" = c."courseId"
            JOIN target_group tg ON tg.profile_id = c.profile_id
            WHERE l."courseId" = ${courseId1}
        ),

        completed_main AS (
            SELECT DISTINCT c.profile_id
            FROM wa_lessons_completed c
            JOIN actual_course_last_lesson l ON l."LessonId" = c."lessonId" AND l."courseId" = c."courseId"
            JOIN target_group tg ON tg.profile_id = c.profile_id
            WHERE c."completionStatus" = 'Completed'
        ),

        started_assessment AS (
            SELECT DISTINCT c.profile_id
            FROM wa_lessons_completed c
            JOIN "Lesson" l ON l."LessonId" = c."lessonId" AND l."courseId" = c."courseId"
            JOIN target_group tg ON tg.profile_id = c.profile_id
            WHERE l."courseId" = ${courseId2}
        ),

        completed_assessment AS (
            SELECT DISTINCT c.profile_id
            FROM wa_lessons_completed c
            JOIN assessment_course_last_lesson l ON l."LessonId" = c."lessonId" AND l."courseId" = c."courseId"
            JOIN target_group tg ON tg.profile_id = c.profile_id
            WHERE c."completionStatus" = 'Completed'
        ),

        not_started_assessment AS (
            SELECT tg.profile_id
            FROM target_group tg
            LEFT JOIN wa_lessons_completed c ON tg.profile_id = c.profile_id
              AND c."lessonId" = (SELECT "LessonId" FROM assessment_course_start_lesson)
            WHERE c.profile_id IS NULL
        ),

        completed_assessment_not_started_main AS (
            SELECT ca.profile_id
            FROM completed_assessment ca
            LEFT JOIN started_main sm ON ca.profile_id = sm.profile_id
            WHERE sm.profile_id IS NULL
        )

        SELECT tg.*
        FROM target_group tg
        WHERE tg.profile_id IN (
            ${
                condition_name === 'total_users'
                    ? `SELECT profile_id FROM target_group`
                    : condition_name === 'started_main_course'
                    ? `SELECT profile_id FROM started_main`
                    : condition_name === 'completed_main_course'
                    ? `SELECT profile_id FROM completed_main`
                    : condition_name === 'started_pre_assessment'
                    ? `SELECT profile_id FROM started_assessment`
                    : condition_name === 'completed_pre_assessment'
                    ? `SELECT profile_id FROM completed_assessment`
                    : condition_name === 'completed_assessment_but_not_started_main'
                    ? `SELECT profile_id FROM completed_assessment_not_started_main`
                    : condition_name === 'not_started_pre_assessment'
                    ? `SELECT profile_id FROM not_started_assessment`
                    : `NULL`
            }
        )
        ORDER BY tg."name" ASC
        `;

        const res = await sequelize.query(query);
        return res[0];
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};


// const getActivityAssessmentScoreDay = async (botType, rollout, level, cohort, targetGroup, courseId) => {
//   try {
//     let classLevel = '', targetGrpCondition = '', joinString = '';
//     let speakingPracticeCTE = '', endColumns = '';

//     if (botType === 'teacher' && (rollout == 1 || rollout == 0)) {
//       targetGrpCondition = `m."targetGroup" = '${targetGroup}' AND`;
//     }

//     if (botType === 'teacher') {
//       classLevel = `AND m."classLevel" IS NULL AND m."cohort" = '${cohort}'`;
//     } else if (botType === 'student') {
//       classLevel = `AND m."classLevel" = '${level}' AND m."cohort" = '${cohort}'`;
//     }

//     const commonCTEs = `
// WITH target_group_users AS (
//   SELECT m."phoneNumber", m."profile_id", m."name"
//   FROM "wa_users_metadata" m
//   INNER JOIN "wa_profiles" p ON m."profile_id" = p."profile_id"
//   WHERE ${targetGrpCondition}
//         m."rollout" = ${rollout}
//         AND p."profile_type" = '${botType}'
//         ${classLevel}
// ),
// course_activities AS (
//   SELECT "LessonId", "activity", "courseId", "weekNumber", "dayNumber"
//   FROM "Lesson"
//   WHERE "courseId" = ${courseId}
//     AND "weekNumber" IN (1)
//     AND "status" = 'Active'
// ),
// mcqs AS (
//   SELECT q."phoneNumber", q."profile_id",
//     COUNT(CASE WHEN l."weekNumber" = 1 AND l."dayNumber" = 1 AND element = TRUE THEN 1 ELSE NULL END) AS mcqs_week1_correct_count,
//     COUNT(CASE WHEN l."weekNumber" = 1 AND l."dayNumber" = 1 THEN 1 ELSE NULL END) AS mcqs_week1_total,
//     COUNT(CASE WHEN l."weekNumber" = 1 AND l."dayNumber" = 2 AND element = TRUE THEN 1 ELSE NULL END) AS mcqs_week2_correct_count,
//     COUNT(CASE WHEN l."weekNumber" = 1 AND l."dayNumber" = 2 THEN 1 ELSE NULL END) AS mcqs_week2_total,
//     COUNT(CASE WHEN l."weekNumber" = 1 AND l."dayNumber" = 3 AND element = TRUE THEN 1 ELSE NULL END) AS mcqs_week3_correct_count,
//     COUNT(CASE WHEN l."weekNumber" = 1 AND l."dayNumber" = 3 THEN 1 ELSE NULL END) AS mcqs_week3_total
//   FROM "wa_question_responses" q
//   LEFT JOIN course_activities l ON q."lessonId" = l."LessonId",
//   UNNEST(q."correct") AS element
//   WHERE l."activity" = 'assessmentMcqs'
//     AND q."profile_id" IN (SELECT "profile_id" FROM target_group_users)
//   GROUP BY q."phoneNumber", q."profile_id"
// ),
// watch_and_speak AS (
//   SELECT q."phoneNumber", q."profile_id",
//     COUNT(CASE WHEN l."weekNumber" = 1 AND l."dayNumber" = 1 THEN 1 ELSE NULL END) * 2 AS watchAndSpeak_week1_total,
//     COALESCE(SUM(
//       CASE WHEN l."weekNumber" = 1 AND l."dayNumber" = 1 THEN
//         COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
//         COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
//         COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
//       END
//     ) / 300 * 2, 0) AS watchAndSpeak_week1_score
//   FROM "wa_question_responses" q
//   LEFT JOIN course_activities l ON l."LessonId" = q."lessonId"
//   WHERE l."activity" = 'assessmentWatchAndSpeak'
//     AND q."profile_id" IN (SELECT "profile_id" FROM target_group_users)
//   GROUP BY q."phoneNumber", q."profile_id"
// )`;

//     if (botType === 'student' && level === 'grade 7') {
//       speakingPracticeCTE = `,
// speaking_practice AS (
//   SELECT q."phoneNumber", q."profile_id",
//     COALESCE(SUM(
//       CASE WHEN l."weekNumber" = 1 AND l."dayNumber" = 1 THEN
//         COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
//         COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
//         COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
//       END
//     ) / 300 * 5, 0) AS speaking_practice_week1_correct_count
//   FROM "wa_question_responses" q
//   LEFT JOIN course_activities l ON l."LessonId" = q."lessonId"
//   WHERE l."activity" = 'speakingPractice'
//     AND q."profile_id" IN (SELECT "profile_id" FROM target_group_users)
//   GROUP BY q."phoneNumber", q."profile_id"
// )`;

//       joinString = `LEFT JOIN speaking_practice sp ON m."profile_id" = sp."profile_id"`;

//       endColumns = `
//   ROUND(COALESCE(mc.mcqs_week1_correct_count, 0), 2) AS day1_mcqs,
//   ROUND(COALESCE(mc.mcqs_week2_correct_count, 0), 2) AS day2_mcqs,
//   ROUND(COALESCE(mc.mcqs_week3_correct_count, 0), 2) AS day3_mcqs,
//   ROUND(COALESCE(sp.speaking_practice_week1_correct_count, 0), 2) AS day1_sp,
//   CASE 
//     WHEN (mc.mcqs_week1_correct_count + mc.mcqs_week2_correct_count + mc.mcqs_week3_correct_count) = 0 THEN NULL
//     ELSE ROUND(COALESCE(mc.mcqs_week1_correct_count, 0) + COALESCE(mc.mcqs_week2_correct_count, 0) + COALESCE(mc.mcqs_week3_correct_count, 0), 2)
//   END AS mcqs,
//   ROUND(COALESCE(mc.mcqs_week1_total, 0) + COALESCE(mc.mcqs_week2_total, 0) + COALESCE(mc.mcqs_week3_total, 0), 2) AS mcqs_total,
//   CASE
//     WHEN sp.speaking_practice_week1_correct_count = 0 THEN NULL
//     ELSE ROUND(sp.speaking_practice_week1_correct_count, 2)
//   END AS speaking_practice,
//   ROUND(COALESCE(sp.speaking_practice_week1_correct_count, 0), 2) AS speaking_practice_total,
//   NULLIF(ROUND(COALESCE(
//     mc.mcqs_week1_correct_count + mc.mcqs_week2_correct_count + mc.mcqs_week3_correct_count, 0
//   ) + COALESCE(sp.speaking_practice_week1_correct_count, 0), 2), 0) AS total_activity_score`;
//     } else {
//       joinString = `LEFT JOIN watch_and_speak ws ON m."profile_id" = ws."profile_id"`;

//       endColumns = `
//   ROUND(COALESCE(mc.mcqs_week1_correct_count, 0), 2) AS day1_mcqs,
//   ROUND(COALESCE(mc.mcqs_week2_correct_count, 0), 2) AS day2_mcqs,
//   ROUND(COALESCE(mc.mcqs_week3_correct_count, 0), 2) AS day3_mcqs,
//   ROUND(COALESCE(ws.watchAndSpeak_week1_score, 0), 2) AS day1_ws,
//   ROUND(COALESCE(ws.watchAndSpeak_week1_total, 0), 2) AS watchAndSpeak_total,
//   CASE 
//     WHEN (mc.mcqs_week1_correct_count + mc.mcqs_week2_correct_count + mc.mcqs_week3_correct_count) = 0 THEN NULL
//     ELSE ROUND(COALESCE(mc.mcqs_week1_correct_count, 0) + COALESCE(mc.mcqs_week2_correct_count, 0) + COALESCE(mc.mcqs_week3_correct_count, 0), 2)
//   END AS mcqs,
//   ROUND(COALESCE(mc.mcqs_week1_total, 0) + COALESCE(mc.mcqs_week2_total, 0) + COALESCE(mc.mcqs_week3_total, 0), 2) AS mcqs_total,
//   NULLIF(ROUND(
//     COALESCE(
//       mc.mcqs_week1_correct_count + mc.mcqs_week2_correct_count + mc.mcqs_week3_correct_count, 0
//     ) + COALESCE(ws.watchAndSpeak_week1_score, 0), 2
//   ), 0) AS total_activity_score`;
//     }

//     const query = `
// ${commonCTEs}
// ${speakingPracticeCTE}
// SELECT 
//   ROW_NUMBER() OVER (ORDER BY m."name") AS sr_no,
//   m."phoneNumber", 
//   m."profile_id",
//   m."name",
//   ${endColumns}
// FROM 
//   "wa_users_metadata" m 
// INNER JOIN 
//   "wa_profiles" p ON m."profile_id" = p."profile_id"
// LEFT JOIN 
//   mcqs mc ON m."profile_id" = mc."profile_id"
// ${joinString}
// WHERE 
//   ${targetGrpCondition}
//   m."rollout" = ${rollout}
//   AND p."profile_type" = '${botType}' 
//   ${classLevel}
// ORDER BY m."name" ASC;
// `;

//     if (courseId == 142) {
//       console.log("Executing query for courseId 139:", query);
//     }

//     const result = await sequelize.query(query);
//     // console.log(result[0]);
//     return result[0];
//   } catch (error) {
//     console.error("Error in getActivityAssessmentScoreDay:", error);
//     error.fileName = "etlRepository.js";
//     throw error;
//   }
// };

const getActivityAssessmentScoreDay = async (botType, rollout, level, cohort, targetGroup, courseId, module) => {
  try {
    let classLevel = '', targetGrpCondition = '', joinString = '';
    let speakingPracticeCTE = '', endColumns = '';

    if (botType === 'teacher' && (rollout == 1 || rollout == 0)) {
      targetGrpCondition = `m."targetGroup" = '${targetGroup}' AND`;
    }

    if (botType === 'teacher') {
      classLevel = `AND m."classLevel" IS NULL AND m."cohort" = '${cohort}'`;
    } else if (botType === 'student') {
      classLevel = `AND m."classLevel" = '${level}' AND m."cohort" = '${cohort}'`;
    }

    const commonCTEs = `
        WITH target_group_users AS (
        SELECT m."phoneNumber", m."profile_id", m."name"
        FROM "wa_users_metadata" m
        INNER JOIN "wa_profiles" p ON m."profile_id" = p."profile_id"
        WHERE ${targetGrpCondition}
                m."rollout" = ${rollout}
                AND p."profile_type" = '${botType}'
                ${classLevel}
        ),
        course_activities AS (
        SELECT "LessonId", "activity", "courseId", "weekNumber", "dayNumber"
        FROM "Lesson"
        WHERE "courseId" = ${courseId}
            AND "weekNumber" IN (1)
            AND "status" = 'Active'
        ),
        mcqs AS (
        SELECT q."phoneNumber", q."profile_id",
            COUNT(CASE WHEN l."weekNumber" = 1 AND l."dayNumber" = 1 AND element = TRUE THEN 1 ELSE NULL END) AS mcqs_week1_correct_count,
            COUNT(CASE WHEN l."weekNumber" = 1 AND l."dayNumber" = 1 THEN 1 ELSE NULL END) AS mcqs_week1_total,
            COUNT(CASE WHEN l."weekNumber" = 1 AND l."dayNumber" = 2 AND element = TRUE THEN 1 ELSE NULL END) AS mcqs_week2_correct_count,
            COUNT(CASE WHEN l."weekNumber" = 1 AND l."dayNumber" = 2 THEN 1 ELSE NULL END) AS mcqs_week2_total,
            COUNT(CASE WHEN l."weekNumber" = 1 AND l."dayNumber" = 3 AND element = TRUE THEN 1 ELSE NULL END) AS mcqs_week3_correct_count,
            COUNT(CASE WHEN l."weekNumber" = 1 AND l."dayNumber" = 3 THEN 1 ELSE NULL END) AS mcqs_week3_total
        FROM "wa_question_responses" q
        LEFT JOIN course_activities l ON q."lessonId" = l."LessonId",
        UNNEST(q."correct") AS element
        WHERE l."activity" = 'assessmentMcqs'
            AND q."profile_id" IN (SELECT "profile_id" FROM target_group_users)
        GROUP BY q."phoneNumber", q."profile_id"
        ),
        watch_and_speak AS (
        SELECT q."phoneNumber", q."profile_id",
            COUNT(CASE WHEN l."weekNumber" = 1 AND l."dayNumber" = 1 THEN 1 ELSE NULL END) * 2 AS watchAndSpeak_week1_total,
            COALESCE(SUM(
            CASE WHEN l."weekNumber" = 1 AND l."dayNumber" = 1 THEN
                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
            END
            ) / 300 * 2, 0) AS watchAndSpeak_week1_score
        FROM "wa_question_responses" q
        LEFT JOIN course_activities l ON l."LessonId" = q."lessonId"
        WHERE l."activity" = 'assessmentWatchAndSpeak'
            AND q."profile_id" IN (SELECT "profile_id" FROM target_group_users)
        GROUP BY q."phoneNumber", q."profile_id"
        )`;

            if (botType === 'student' && level === 'grade 7' || botType === 'teacher') {
            speakingPracticeCTE = `,
        speaking_practice AS (
        SELECT q."phoneNumber", q."profile_id",
            COUNT(CASE WHEN l."weekNumber" = 1 AND l."dayNumber" = 1 THEN 1 ELSE NULL END) * 5 AS speaking_practice_week1_total,
            COALESCE(SUM(
            CASE WHEN l."weekNumber" = 1 AND l."dayNumber" = 1 THEN
                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
            END
            ) / 300 * 5, 0) AS speaking_practice_week1_correct_count
        FROM "wa_question_responses" q
        LEFT JOIN course_activities l ON l."LessonId" = q."lessonId"
        WHERE l."activity" = 'speakingPractice'
            AND q."profile_id" IN (SELECT "profile_id" FROM target_group_users)
        GROUP BY q."phoneNumber", q."profile_id"
        )`;

            joinString = `LEFT JOIN speaking_practice sp ON m."profile_id" = sp."profile_id"`;

            if (module === 'day') {
                endColumns = `
        NULLIF(ROUND(COALESCE(mc.mcqs_week1_correct_count, 0), 2),0) AS day1_mcqs,
        NULLIF(ROUND(COALESCE(mc.mcqs_week2_correct_count, 0), 2),0) AS day2_mcqs,
        NULLIF(ROUND(COALESCE(mc.mcqs_week3_correct_count, 0), 2),0) AS day3_mcqs,
        NULLIF(ROUND(COALESCE(mc.mcqs_week1_total, 0), 2),0) AS day1_mcqs_total,
        NULLIF(ROUND(COALESCE(mc.mcqs_week2_total, 0), 2),0) AS day2_mcqs_total,
        NULLIF(ROUND(COALESCE(mc.mcqs_week3_total, 0), 2),0) AS day3_mcqs_total,
        NULLIF(ROUND(COALESCE(mc.mcqs_week1_correct_count + mc.mcqs_week2_correct_count + mc.mcqs_week3_correct_count, 0), 2),0) AS total_mcqs_score,
        ROUND(COALESCE(mc.mcqs_week1_total + mc.mcqs_week2_total + mc.mcqs_week3_total, 0), 2) AS total_mcqs,
         NULLIF(ROUND(COALESCE(sp.speaking_practice_week1_correct_count, 0), 2),0) AS day1_sp,
        ROUND(COALESCE(sp.speaking_practice_week1_total, 0), 2) AS total_speaking_practice,
        NULLIF(ROUND(
            COALESCE(mc.mcqs_week1_correct_count + mc.mcqs_week2_correct_count + mc.mcqs_week3_correct_count, 0)
            + COALESCE(sp.speaking_practice_week1_correct_count, 0), 2), 0) AS total_score,
        NULLIF(ROUND(
            COALESCE(mc.mcqs_week1_total + mc.mcqs_week2_total + mc.mcqs_week3_total, 0)
            + COALESCE(sp.speaking_practice_week1_total, 0), 2), 0) AS total_total
                `;
            } else {
                endColumns = `
        NULLIF(ROUND(COALESCE(mc.mcqs_week1_correct_count + mc.mcqs_week2_correct_count + mc.mcqs_week3_correct_count, 0), 2),0) AS total_mcqs_score,
        ROUND(COALESCE(mc.mcqs_week1_total + mc.mcqs_week2_total + mc.mcqs_week3_total, 0), 2) AS total_mcqs,
        NULLIF(ROUND(COALESCE(sp.speaking_practice_week1_correct_count, 0), 2),0) AS day1_sp,
        ROUND(COALESCE(sp.speaking_practice_week1_total, 0), 2) AS total_speaking_practice,
        NULLIF(ROUND(
            COALESCE(mc.mcqs_week1_correct_count + mc.mcqs_week2_correct_count + mc.mcqs_week3_correct_count, 0)
            + COALESCE(sp.speaking_practice_week1_correct_count, 0), 2), 0) AS total_score,
        NULLIF(ROUND(
            COALESCE(mc.mcqs_week1_total + mc.mcqs_week2_total + mc.mcqs_week3_total, 0)
            + COALESCE(sp.speaking_practice_week1_total, 0), 2), 0) AS total_total
                `;
            }
            } else {
            joinString = `LEFT JOIN watch_and_speak ws ON m."profile_id" = ws."profile_id"`;

            if (module === 'day') {
                endColumns = `
        NULLIF(ROUND(COALESCE(mc.mcqs_week1_correct_count, 0), 2),0) AS day1_mcqs,
        NULLIF(ROUND(COALESCE(mc.mcqs_week2_correct_count, 0), 2),0) AS day2_mcqs,
        NULLIF(ROUND(COALESCE(mc.mcqs_week3_correct_count, 0), 2),0) AS day3_mcqs,
        NULLIF(ROUND(COALESCE(mc.mcqs_week1_total, 0), 2),0) AS day1_mcqs_total,
        NULLIF(ROUND(COALESCE(mc.mcqs_week2_total, 0), 2),0) AS day2_mcqs_total,
        NULLIF(ROUND(COALESCE(mc.mcqs_week3_total, 0), 2),0) AS day3_mcqs_total,
        NULLIF(ROUND(COALESCE(mc.mcqs_week1_correct_count + mc.mcqs_week2_correct_count + mc.mcqs_week3_correct_count, 0), 2),0) AS total_mcqs_score,
        ROUND(COALESCE(mc.mcqs_week1_total + mc.mcqs_week2_total + mc.mcqs_week3_total, 0), 2) AS total_mcqs,
        NULLIF(ROUND(COALESCE(ws.watchAndSpeak_week1_score, 0), 2),0) AS day1_ws,
        ROUND(COALESCE(ws.watchAndSpeak_week1_total, 0), 2) AS total_watchAndSpeak,
        NULLIF(ROUND(
            COALESCE(mc.mcqs_week1_correct_count + mc.mcqs_week2_correct_count + mc.mcqs_week3_correct_count, 0)
            + COALESCE(ws.watchAndSpeak_week1_score, 0), 2), 0) AS total_score,
        NULLIF(ROUND(
            COALESCE(mc.mcqs_week1_total + mc.mcqs_week2_total + mc.mcqs_week3_total, 0)
            + COALESCE(ws.watchAndSpeak_week1_total, 0), 2), 0) AS total_total
                `;
            } else {
                endColumns = `
        NULLIF(ROUND(COALESCE(mc.mcqs_week1_correct_count + mc.mcqs_week2_correct_count + mc.mcqs_week3_correct_count, 0), 2),0) AS total_mcqs_score,
        ROUND(COALESCE(mc.mcqs_week1_total + mc.mcqs_week2_total + mc.mcqs_week3_total, 0), 2) AS total_mcqs,
        NULLIF(ROUND(COALESCE(ws.watchAndSpeak_week1_score, 0), 2),0) AS day1_ws,
        ROUND(COALESCE(ws.watchAndSpeak_week1_total, 0), 2) AS total_watchAndSpeak,
        NULLIF(ROUND(
            COALESCE(mc.mcqs_week1_correct_count + mc.mcqs_week2_correct_count + mc.mcqs_week3_correct_count, 0)
            + COALESCE(ws.watchAndSpeak_week1_score, 0), 2), 0) AS total_score,
        NULLIF(ROUND(
            COALESCE(mc.mcqs_week1_total + mc.mcqs_week2_total + mc.mcqs_week3_total, 0)
            + COALESCE(ws.watchAndSpeak_week1_total, 0), 2), 0) AS total_total
        `;
      }
    }

    const query = `
        ${commonCTEs}
        ${speakingPracticeCTE}
        SELECT 
        ROW_NUMBER() OVER (ORDER BY m."name") AS sr_no,
        m."profile_id",
        m."phoneNumber", 
        m."name",
        ${endColumns}
        FROM 
        "wa_users_metadata" m 
        INNER JOIN 
        "wa_profiles" p ON m."profile_id" = p."profile_id"
        LEFT JOIN 
        mcqs mc ON m."profile_id" = mc."profile_id"
        ${joinString}
        WHERE 
        ${targetGrpCondition}
        m."rollout" = ${rollout}
        AND p."profile_type" = '${botType}' 
        ${classLevel}
        ORDER BY m."name" ASC;
        `;

    const result = await sequelize.query(query);
   
    return result[0];
  } catch (error) {
    console.error("Error in getActivityAssessmentScoreDay:", error);
    error.fileName = "etlRepository.js";
    throw error;
  }
};


const getActivityAssessmentCumulative = async () => {
  try {

    const query = `
            WITH target_group_users AS (
            SELECT m."phoneNumber", m."profile_id", m."name"
            FROM "wa_users_metadata" m
            INNER JOIN "wa_profiles" p ON m."profile_id" = p."profile_id"
            WHERE m."rollout" = 2
                AND p."profile_type" = 'student'
                AND m."classLevel" IN ('grade 1', 'grade 2', 'grade 3', 'grade 4', 'grade 5', 'grade 6', 'grade 7')
                AND m."cohort" != 'Cohort 0'
            ),
            course_activities AS (
            SELECT "LessonId", "activity", "courseId", "weekNumber", "dayNumber"
            FROM "Lesson"
            WHERE "courseId" IN (139,140,141,142)
                AND "weekNumber" = 1
                AND "status" = 'Active'
            ),
            mcqs AS (
            SELECT q."phoneNumber", q."profile_id",
                COUNT(CASE WHEN l."dayNumber" = 1 AND element = TRUE THEN 1 END) AS mcqs_week1_correct_count,
                COUNT(CASE WHEN l."dayNumber" = 1 THEN 1 END) AS mcqs_week1_total,
                COUNT(CASE WHEN l."dayNumber" = 2 AND element = TRUE THEN 1 END) AS mcqs_week2_correct_count,
                COUNT(CASE WHEN l."dayNumber" = 2 THEN 1 END) AS mcqs_week2_total,
                COUNT(CASE WHEN l."dayNumber" = 3 AND element = TRUE THEN 1 END) AS mcqs_week3_correct_count,
                COUNT(CASE WHEN l."dayNumber" = 3 THEN 1 END) AS mcqs_week3_total
            FROM "wa_question_responses" q
            LEFT JOIN course_activities l ON q."lessonId" = l."LessonId",
            UNNEST(q."correct") AS element
            WHERE l."activity" = 'assessmentMcqs'
                AND q."profile_id" IN (SELECT "profile_id" FROM target_group_users)
            GROUP BY q."phoneNumber", q."profile_id"
            ),
            watch_and_speak AS (
            SELECT q."phoneNumber", q."profile_id",
                COUNT(CASE WHEN l."dayNumber" = 1 THEN 1 END) * 2 AS watchAndSpeak_week1_total,
                COALESCE(SUM(
                CASE WHEN l."dayNumber" = 1 THEN
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                END
                ) / 300 * 2, 0) AS watchAndSpeak_week1_score
            FROM "wa_question_responses" q
            LEFT JOIN course_activities l ON l."LessonId" = q."lessonId"
            WHERE l."activity" = 'assessmentWatchAndSpeak'
                AND q."profile_id" IN (SELECT "profile_id" FROM target_group_users)
            GROUP BY q."phoneNumber", q."profile_id"
            ),
            speaking_practice AS (
            SELECT q."phoneNumber", q."profile_id",
                COUNT(CASE WHEN l."dayNumber" = 1 THEN 1 END) * 5 AS speaking_practice_week1_total,
                COALESCE(SUM(
                CASE WHEN l."dayNumber" = 1 THEN
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'accuracyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'fluencyScore')::DECIMAL, 0) +
                    COALESCE(("submittedFeedbackJson"[1]->'scoreNumber'->>'compScore')::DECIMAL, 0)
                END
                ) / 300 * 5, 0) AS speaking_practice_week1_correct_count
            FROM "wa_question_responses" q
            LEFT JOIN course_activities l ON l."LessonId" = q."lessonId"
            WHERE l."activity" = 'speakingPractice'
                AND q."profile_id" IN (SELECT "profile_id" FROM target_group_users)
            GROUP BY q."phoneNumber", q."profile_id"
            )
            SELECT
            ROW_NUMBER() OVER (ORDER BY m."classLevel", m."cohort") AS sr_no, m."profile_id",
            m."phoneNumber", m."name",

            -- MCQs Day-wise
            CASE WHEN mc.mcqs_week1_correct_count = 0 THEN NULL ELSE ROUND(mc.mcqs_week1_correct_count, 2) END AS day1_mcqs,
            CASE WHEN mc.mcqs_week2_correct_count = 0 THEN NULL ELSE ROUND(mc.mcqs_week2_correct_count, 2) END AS day2_mcqs,
            CASE WHEN mc.mcqs_week3_correct_count = 0 THEN NULL ELSE ROUND(mc.mcqs_week3_correct_count, 2) END AS day3_mcqs,

            -- MCQs Total
            CASE WHEN (mc.mcqs_week1_correct_count + mc.mcqs_week2_correct_count + mc.mcqs_week3_correct_count) = 0 THEN NULL
                ELSE ROUND(mc.mcqs_week1_correct_count + mc.mcqs_week2_correct_count + mc.mcqs_week3_correct_count, 2)
            END AS mcqs,

           -- CASE WHEN (mc.mcqs_week1_total + mc.mcqs_week2_total + mc.mcqs_week3_total) = 0 THEN NULL
            --    ELSE ROUND(mc.mcqs_week1_total + mc.mcqs_week2_total + mc.mcqs_week3_total, 2)
          --  END AS mcqs_total,

            -- Watch and Speak
            CASE WHEN ws.watchAndSpeak_week1_score = 0 THEN NULL ELSE ROUND(ws.watchAndSpeak_week1_score, 2) END AS day1_ws,
          --  CASE WHEN ws.watchAndSpeak_week1_total = 0 THEN NULL ELSE ROUND(ws.watchAndSpeak_week1_total, 2) END AS watchAndSpeak_total,

            -- Speaking Practice
            CASE WHEN sp.speaking_practice_week1_correct_count = 0 THEN NULL ELSE ROUND(sp.speaking_practice_week1_correct_count, 2) END AS speaking_practice,
          --  CASE WHEN sp.speaking_practice_week1_total = 0 THEN NULL ELSE ROUND(sp.speaking_practice_week1_total, 2) END AS speaking_practice_total,

            -- Final Score and Total
            NULLIF(ROUND(
                COALESCE(mc.mcqs_week1_correct_count, 0) + COALESCE(mc.mcqs_week2_correct_count, 0) + COALESCE(mc.mcqs_week3_correct_count, 0) +
                COALESCE(ws.watchAndSpeak_week1_score, 0) + COALESCE(sp.speaking_practice_week1_correct_count, 0), 2), 0) AS total_activity_score,

          --  NULLIF(ROUND(
            --    COALESCE(mc.mcqs_week1_total, 0) + COALESCE(mc.mcqs_week2_total, 0) + COALESCE(mc.mcqs_week3_total, 0) +
            --    COALESCE(ws.watchAndSpeak_week1_total, 0) + COALESCE(sp.speaking_practice_week1_total, 0), 2), 0) AS total_activity_total,
            m."classLevel", m."cohort", m."rollout"
            FROM "wa_users_metadata" m
            INNER JOIN "wa_profiles" p ON m."profile_id" = p."profile_id"
            LEFT JOIN mcqs mc ON m."profile_id" = mc."profile_id"
            LEFT JOIN watch_and_speak ws ON m."profile_id" = ws."profile_id"
            LEFT JOIN speaking_practice sp ON m."profile_id" = sp."profile_id"
            WHERE m."rollout" = 2
            AND p."profile_type" = 'student'
            AND m."classLevel" IN ('grade 1', 'grade 2', 'grade 3', 'grade 4', 'grade 5', 'grade 6', 'grade 7')
            AND m."cohort" != 'Cohort 0'
            ORDER BY m."classLevel", m."cohort" ASC;
            `;

    const result = await sequelize.query(query);

    return result[0];
  } catch (error) {
    console.error("Error in getActivityAssessmentCumulative:", error);
    error.fileName = "etlRepository.js";
    throw error;
  }
};

export default {
    getcohortList, getDataFromPostgres, getSuccessRate, getActivityTotalCount, getCompletedActivity, getLessonCompletion, getLastActivityCompleted, getWeeklyScore, getPhoneNumber_userNudges, getWeeklyScore_pilot, getCount_NotStartedActivity, getLessonCompletions, getActivity_Completions, getActivityNameCount,
    getLastActivityCompleted_DropOff, getActivtyAssessmentScore,getCumulativeLessonCompletions,getCumulativeActivityCompletions, getActivityAssessmentScoreDay, getActivityAssessmentCumulative, getUserProgressStats, getUserProgressBarStats
};