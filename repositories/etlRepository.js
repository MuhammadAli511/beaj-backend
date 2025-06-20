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
        
        if(botType === 'teacher'){
            if(rollout == 1 || rollout == 0){
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
        WITH lesson_completions AS (
            SELECT 
                wlc."profile_id",
                wlc."phoneNumber",
                l."courseId",
                l."weekNumber",
                COUNT(DISTINCT CASE 
                    WHEN l."weekNumber" = 1 THEN l."dayNumber" 
                END) as week1_days,
                COUNT(DISTINCT CASE 
                    WHEN l."weekNumber" = 2 THEN l."dayNumber" 
                END) as week2_days,
                COUNT(DISTINCT CASE 
                    WHEN l."weekNumber" = 3 THEN l."dayNumber" 
                END) as week3_days,
                COUNT(DISTINCT CASE 
                    WHEN l."weekNumber" = 4 THEN l."dayNumber" 
                END) as week4_days
            FROM "wa_lessons_completed" wlc
            INNER JOIN "Lesson" l ON l."LessonId" = wlc."lessonId" 
                AND l."courseId" = wlc."courseId"
                AND l."status" = 'Active'
            WHERE wlc."completionStatus" = 'Completed'
                AND l."courseId" IN (${course_list})
            GROUP BY wlc."profile_id", wlc."phoneNumber", l."courseId", l."weekNumber"
        ),
        user_progress AS (
            SELECT 
                lc."profile_id",
                lc."phoneNumber", 
                lc."courseId",
                1 as "weekNumber",
                NULLIF(lc.week1_days, 0) as days_completed
            FROM lesson_completions lc
            WHERE lc.week1_days > 0
            
            UNION ALL
            
            SELECT 
                lc."profile_id",
                lc."phoneNumber", 
                lc."courseId",
                2 as "weekNumber",
                NULLIF(lc.week2_days, 0) as days_completed
            FROM lesson_completions lc
            WHERE lc.week2_days > 0
            
            UNION ALL
            
            SELECT 
                lc."profile_id",
                lc."phoneNumber", 
                lc."courseId",
                3 as "weekNumber",
                NULLIF(lc.week3_days, 0) as days_completed
            FROM lesson_completions lc
            WHERE lc.week3_days > 0
            
            UNION ALL
            
            SELECT 
                lc."profile_id",
                lc."phoneNumber", 
                lc."courseId",
                4 as "weekNumber",
                NULLIF(lc.week4_days, 0) as days_completed
            FROM lesson_completions lc
            WHERE lc.week4_days > 0
        )
        SELECT 
            ROW_NUMBER() OVER (ORDER BY m."name") AS sr_no,
            m."profile_id",
            m."phoneNumber",
            m."name",
            ${course_array}
        FROM "wa_users_metadata" m
        INNER JOIN "wa_profiles" p ON m."profile_id" = p."profile_id"
        LEFT JOIN user_progress lc ON m."profile_id" = lc."profile_id" 
            AND m."phoneNumber" = lc."phoneNumber"
        WHERE ${target_grp} m."cohort" = '${cohort}' 
            AND m."rollout" = ${rollout}
            AND p."profile_type" = '${botType}' 
             ${classLevel}
        GROUP BY m."profile_id", m."phoneNumber", m."name"
        ORDER BY m."name" ASC;`;
// console.log(qry);
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
        if(botType === 'teacher'){
            if(rollout == 1 || rollout == 0){
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
        if(botType === 'teacher'){
            if(rollout == 1 || rollout == 0){
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
        else if(botType === 'student'){
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

const getActivtyAssessmentScore = async (botType, rollout, level, cohort, grp, course_id) => {
    try {
        let classLevel = '', target_grp = '';
        if(botType === 'teacher'){
            if(rollout == 1 || rollout == 0){
                target_grp = ` m."targetGroup" = '${grp}' AND `;
            }
            // rollout = 1;
            classLevel = `and m."classLevel" is null and m."cohort" = '${cohort}'`;
        }
        else if(botType === 'student'){
            // rollout = 1;
            // botType = 'teacher';
            classLevel = `and m."classLevel" = '${level}' and m."cohort" = '${cohort}'`;
        }
        const qry = `
           WITH target_group_users AS (
    SELECT m."phoneNumber", m."profile_id"
    FROM "wa_users_metadata" m inner join "wa_profiles" p on
		m."profile_id" = p."profile_id"
    WHERE ${target_grp} m."rollout" = ${rollout}
		       and p."profile_type" = '${botType}' ${classLevel}
),
course_activities AS (
    SELECT "LessonId", "activity", "courseId", "weekNumber"
    FROM "Lesson" 
    WHERE "courseId" = ${course_id} AND "weekNumber" IN (1,2,3,4) and "status" = 'Active'
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
        q."phoneNumber",  q."profile_id"
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
        q."phoneNumber", q."profile_id"
)
SELECT 
     ROW_NUMBER() OVER (ORDER BY m."name") AS sr_no,
     m."phoneNumber", 
     m."profile_id",
     m."name",
     
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
      as "watchAndSpeak_total"
FROM 
    "wa_users_metadata" m 
    inner join "wa_profiles" p on
		m."profile_id" = p."profile_id"
LEFT JOIN 
    mcqs mc ON m."profile_id" = mc."profile_id"
LEFT JOIN 
    watch_and_speak ws ON m."profile_id" = ws."profile_id"
WHERE 
    ${target_grp} m."rollout" = ${rollout}
		       and p."profile_type" = '${botType}' ${classLevel}
ORDER BY  m."name" ASC;
        `;

        const res = await sequelize.query(qry);
        return res[0];
    } catch (error) {
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
    g."weekNumber",g."dayNumber",g."SequenceNumber";`
        const res = await sequelize.query(qry);
        console.log(res[0]);
        return res[0];
    } catch (error) {
        error.fileName = "etlRepository.js";
        throw error;
    }
};

export default {
    getDataFromPostgres, getSuccessRate, getActivityTotalCount, getCompletedActivity, getLessonCompletion, getLastActivityCompleted, getWeeklyScore, getPhoneNumber_userNudges, getWeeklyScore_pilot, getCount_NotStartedActivity, getLessonCompletions, getActivity_Completions, getActivityNameCount,
    getLastActivityCompleted_DropOff, getActivtyAssessmentScore,
};