import courseRepository from '../repositories/courseRepository.js';
import courseCategoryRepository from '../repositories/courseCategoryRepository.js';
import lessonRepository from '../repositories/lessonRepository.js';
import waUsersMetadataRepository from '../repositories/waUsersMetadataRepository.js';
import waUserActivityLogsRepository from '../repositories/waUserActivityLogsRepository.js';
import waPurchasedCoursesRepository from '../repositories/waPurchasedCoursesRepository.js';
import sequelize from '../config/sequelize.js';

const totalContentStatsService = async () => {
    try {
        const totalCourses = await courseRepository.totalCoursesRepository();
        const totalCourseCategories = await courseCategoryRepository.totalCourseCategoriesRepository();
        const totalLessons = await lessonRepository.totalLessonsRepository();

        return {
            "totalCourses": totalCourses,
            "totalCourseCategories": totalCourseCategories,
            "totalLessons": totalLessons
        };
    } catch (error) {
        error.fileName = 'statsService.js';
        throw error;
    }
};

const dashboardCardsFunnelService = async () => {
    try {
        const linkClickedCount = await waUsersMetadataRepository.getTotalUsersCount();
        const freeDemoStartedCount = await waUsersMetadataRepository.getFreeDemoStartedUsersCount();
        const freeDemoEndedCount = await waUsersMetadataRepository.getFreeDemoEndedUsersCount();
        const registeredUsersCount = await waUsersMetadataRepository.getRegisteredUsersCount();
        const selectedUsersCount = await waUsersMetadataRepository.getSelectedUsersCount();
        const purchasedUsersCount = await waPurchasedCoursesRepository.getPurchasedCount();

        // The above is a 6 step funnel. Calculate +/- % for each step
        const linkClickedPercentage = 0;
        const freeDemoStartedPercentage = ((freeDemoStartedCount / linkClickedCount) * 100).toFixed(2);
        const freeDemoEndedPercentage = ((freeDemoEndedCount / freeDemoStartedCount) * 100).toFixed(2);
        const registeredUsersPercentage = ((registeredUsersCount / freeDemoEndedCount) * 100).toFixed(2);
        const selectedUsersPercentage = ((selectedUsersCount / registeredUsersCount) * 100).toFixed(2);
        const purchasedUsersPercentage = ((purchasedUsersCount / selectedUsersCount) * 100).toFixed(2);
        const freeDemoStartedDropPercentage = (100 - freeDemoStartedPercentage).toFixed(2);
        const freeDemoEndedDropPercentage = (100 - freeDemoEndedPercentage).toFixed(2);
        const registeredUsersDropPercentage = (100 - registeredUsersPercentage).toFixed(2);
        const selectedUsersDropPercentage = (100 - selectedUsersPercentage).toFixed(2);
        const purchasedUsersDropPercentage = (100 - purchasedUsersPercentage).toFixed(2);

        return {
            "linkClicked": {
                "count": linkClickedCount,
                "percentage": linkClickedPercentage
            },
            "freeDemoStarted": {
                "count": freeDemoStartedCount,
                "percentage": freeDemoStartedDropPercentage,
            },
            "freeDemoEnded": {
                "count": freeDemoEndedCount,
                "percentage": freeDemoEndedDropPercentage
            },
            "registeredUsers": {
                "count": registeredUsersCount,
                "percentage": registeredUsersDropPercentage
            },
            "selectedUsers": {
                "count": selectedUsersCount,
                "percentage": selectedUsersDropPercentage
            },
            "purchasedUsers": {
                "count": purchasedUsersCount,
                "percentage": purchasedUsersDropPercentage
            }
        };

    } catch (error) {
        error.fileName = 'statsService.js';
        throw error;
    }
};

const lastActiveUsersService = async (days, cohorts) => {
    try {
        let filteredUsers = await waUsersMetadataRepository.getFilteredUsersWithControlGroupAndCohort(cohorts);
        const lastActiveUsers = await waUserActivityLogsRepository.getLastActiveUsers(days, filteredUsers);
        filteredUsers = filteredUsers
            .map(user => {
                const lastMessageTimestamp = lastActiveUsers.find(log => log.dataValues.phoneNumber === user.dataValues.phoneNumber)?.dataValues.timestamp;
                if (!lastMessageTimestamp) return null;
                const timeDiff = new Date() - lastMessageTimestamp;
                const inactiveDays = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
                if (inactiveDays > days) return null;
                return {
                    ...user.dataValues,
                    lastMessageTimestamp,
                    inactiveDays
                };
            })
            .filter(user => user !== null);
        return filteredUsers;
    } catch (error) {
        error.fileName = 'statsService.js';
        throw error;
    }
};

const studentTrialUserJourneyStatsService = async (date) => {
    try {
        // Set default date if not provided
        const filterDate = date || '2025-04-26 12:00:00';

        const qry1 = `SELECT
                      CASE
                        WHEN LOWER("messageContent"[1]) = LOWER('Start Free Trial now!') THEN 'Community'
                        WHEN LOWER("messageContent"[1]) = LOWER('Start my Free Trial now!') THEN 'Social Media ads'
                        WHEN LOWER("messageContent"[1]) = LOWER('Send this message to START!') THEN 'Social Media ads'
                        WHEN LOWER("messageContent"[1]) = LOWER('Start my FREE Demo! (Click send)') THEN 'Flyer'
                        WHEN LOWER("messageContent"[1]) = LOWER('Click send to start Free Demo!') THEN 'Standee'
                        WHEN LOWER("messageContent"[1]) = LOWER('سٹارٹ فری ٹرائل') THEN 'Urdu Flyer'
                        ELSE 'Unknown'
                      END AS source,
                      COUNT(*) AS user_count
                    FROM (
                      SELECT DISTINCT ON (profile_id)
                        profile_id,
                        "messageContent"
                      FROM wa_user_activity_logs
                      WHERE profile_id IN (
                        SELECT p.profile_id
                        FROM wa_users_metadata m
                        INNER JOIN wa_profiles p ON m."profile_id" = p.profile_id
                        WHERE m."userClickedLink" > TIMESTAMP '${filterDate}'
                        AND p.profile_type = 'student'
                      )
                      ORDER BY profile_id, timestamp ASC, id ASC
                    ) first_messages
                    GROUP BY source
                    ORDER BY user_count DESC;`;


        const qry2 = `WITH students AS (
                SELECT 
                    m."phoneNumber",
                    m."profile_id"
                FROM 
                    "wa_users_metadata" m
                INNER JOIN 
                    "wa_profiles" p 
                    ON m."phoneNumber" = p."phone_number" AND m."profile_id" = p."profile_id"
                WHERE 
                    p."profile_type" = 'student'
            ),
            course_lessons AS (
                SELECT 
                    "LessonId", 
                    "activity",
                    "activityAlias",
                    "weekNumber", 
                    "dayNumber", 
                    "SequenceNumber"
                FROM 
                    "Lesson"
                WHERE 
                    "courseId" = 117
                    AND "status" = 'Active'
            ),
            student_progress AS (
                SELECT 
                    up."phoneNumber",
                    up."currentLessonId"
                FROM 
                    "wa_user_progress" up
                INNER JOIN 
                    students s 
                    ON up."phoneNumber" = s."phoneNumber"
            ),
            progress_counts AS (
                SELECT 
                    sp."currentLessonId" AS "LessonId",
                    COUNT(*) AS "student_count"
                FROM 
                    student_progress sp
                GROUP BY 
                    sp."currentLessonId"
            )
            SELECT 
                cl."LessonId",
                cl."activity",
                cl."activityAlias",
                CONCAT(cl."LessonId", ' (', cl."activity", ')') AS "lesson",
                COALESCE(pc."student_count", 0) AS "count"
            FROM 
                course_lessons cl
            LEFT JOIN 
                progress_counts pc 
                ON cl."LessonId" = pc."LessonId"
            ORDER BY 
                cl."weekNumber", cl."dayNumber", cl."SequenceNumber";`

        const qry3 = `WITH students AS (
                SELECT 
                    m."phoneNumber",
                    m."profile_id"
                FROM 
                    "wa_users_metadata" m
                INNER JOIN 
                    "wa_profiles" p 
                    ON m."phoneNumber" = p."phone_number" AND m."profile_id" = p."profile_id"
                WHERE 
                    p."profile_type" = 'student'
            ),
            course_lessons AS (
                SELECT 
                    "LessonId", 
                    "activity",
                    "activityAlias",
                    "weekNumber", 
                    "dayNumber", 
                    "SequenceNumber"
                FROM 
                    "Lesson"
                WHERE 
                    "courseId" = 113
                    AND "status" = 'Active'
            ),
            student_progress AS (
                SELECT 
                    up."phoneNumber",
                    up."currentLessonId"
                FROM 
                    "wa_user_progress" up
                INNER JOIN 
                    students s 
                    ON up."phoneNumber" = s."phoneNumber"
            ),
            progress_counts AS (
                SELECT 
                    sp."currentLessonId" AS "LessonId",
                    COUNT(*) AS "student_count"
                FROM 
                    student_progress sp
                GROUP BY 
                    sp."currentLessonId"
            )
            SELECT 
                cl."LessonId",
                cl."activity",
                cl."activityAlias",
                CONCAT(cl."LessonId", ' (', cl."activity", ')') AS "lesson",
                COALESCE(pc."student_count", 0) AS "count"
            FROM 
                course_lessons cl
            LEFT JOIN 
                progress_counts pc 
                ON cl."LessonId" = pc."LessonId"
            ORDER BY 
                cl."weekNumber", cl."dayNumber", cl."SequenceNumber";`

        const qry4 = `WITH lesson_data AS (
                    SELECT 
                        p."profile_id",
                        CASE WHEN l."courseId" = 117 THEN 1 ELSE 0 END AS attempted_117,
                        CASE WHEN l."courseId" = 113 THEN 1 ELSE 0 END AS attempted_113
                    FROM "wa_profiles" p
                    inner JOIN "wa_lessons_completed" l ON p."profile_id" = l."profile_id"
                   -- inner join "wa_users_metadata" m on p."profile_id" = m."profile_id"
                    WHERE 
                        (l."courseId" = 117 OR l."courseId" = 113)
                        AND p."profile_type" = 'student'
                        -- AND m."userRegistrationComplete" IS NOT NULL
                ),
                aggregated AS (
                    SELECT 
                        "profile_id",
                        MAX(attempted_117) AS attempted_117,
                        MAX(attempted_113) AS attempted_113
                    FROM lesson_data
                    GROUP BY "profile_id"
                )
                SELECT
                    COUNT(*) FILTER (WHERE attempted_117 = 1 AND attempted_113 = 0) AS course_117,
                    COUNT(*) FILTER (WHERE attempted_117 = 0 AND attempted_113 = 1) AS course_113,
                    COUNT(*) FILTER (WHERE attempted_117 = 1 AND attempted_113 = 1) AS both_courses
                FROM aggregated;
                `;

        const qry5 = `select "persona", count(*) from "wa_user_progress" u left join "wa_profiles" p 
                          on u."profile_id" = p."profile_id" where p."profile_type" = 'student' and 
                          (u."currentCourseId" = 117 or u."currentCourseId" = 113)
                          group by "persona";
                `;

        const qry6 = `
                select m."classLevel", count(*) from "wa_users_metadata" m inner join
                "wa_profiles" p on m."profile_id" = p."profile_id" where p."profile_type" = 'student'
                AND m."userRegistrationComplete" IS NOT NULL group by m."classLevel" ORDER BY 
                    CASE 
                        WHEN m."classLevel" IS NULL THEN 999
                        WHEN m."classLevel" ~ 'class [0-9]+' THEN CAST(SUBSTRING(m."classLevel" FROM '[0-9]+') AS INT)
                        ELSE 998 
                    END;
                `;

        // Execute all queries concurrently
        const [userGroup, lastActivityLevel1, lastActivityLevel3, trialOpt, RegistrationType, CumulativeReg] = await Promise.all([
            sequelize.query(qry1),
            sequelize.query(qry2),
            sequelize.query(qry3),
            sequelize.query(qry4),
            sequelize.query(qry5),
            sequelize.query(qry6),
        ]).then(results => results.map(result => result[0]));

        return {
            userGroup,
            lastActivityLevel1,
            lastActivityLevel3,
            trialOpt,
            RegistrationType,
            CumulativeReg,
        };
    } catch (error) {
        error.fileName = 'statsService.js';
        throw error;
    }
};

const studentCourseStatsService = async () => {
    try {
        // Automated Progress Report SQL Script
        // Generates merged metrics for Main Course, Pre-Assessment, and Post-Assessment
        // Filters results to show only counts >= 10 users
        const courseStatsQuery = `
            WITH
                -- 0. Define the filtered user group
                filtered_users AS (
                    SELECT
                        u.profile_id
                    FROM wa_users_metadata u
                    WHERE u.rollout = 2
                      AND u."classLevel" IN ('grade 1', 'grade 2', 'grade 3', 'grade 4', 'grade 5', 'grade 6', 'grade 7')
                      AND u.cohort IS NOT NULL
                      AND u.cohort NOT IN ('Cohort 0')
                ),

                -- 1. Define course groupings
                course_groups AS (
                SELECT course_id, 'Main Course' AS group_name
                    FROM (VALUES (119),(120),(121),(122),(123),(124),(143)) AS t(course_id)
                UNION ALL
                SELECT course_id, 'Pre-Assessment' AS group_name
                    FROM (VALUES (139),(140),(141),(142)) AS t(course_id)
                UNION ALL
                SELECT course_id, 'Post-Assessment' AS group_name
                    FROM (VALUES (144),(145),(146),(147)) AS t(course_id)
                ),

                -- 2. Find the first and last sequence for each course/week/day
                start_lessons AS (
                SELECT
                    l."courseId",
                    l."weekNumber",
                    l."dayNumber",
                    MIN(l."SequenceNumber") AS min_sequence
                FROM "Lesson" l
                JOIN course_groups cg ON l."courseId" = cg.course_id
                WHERE l."weekNumber" IS NOT NULL AND l."dayNumber" IS NOT NULL
                GROUP BY l."courseId", l."weekNumber", l."dayNumber"
                ),
                end_lessons AS (
                SELECT
                    l."courseId",
                    l."weekNumber",
                    l."dayNumber",
                    MAX(l."SequenceNumber") AS max_sequence
                FROM "Lesson" l
                JOIN course_groups cg ON l."courseId" = cg.course_id
                WHERE l."weekNumber" IS NOT NULL AND l."dayNumber" IS NOT NULL
                GROUP BY l."courseId", l."weekNumber", l."dayNumber"
                ),

                -- 3. Map those sequences back to lesson IDs
                start_lesson_ids AS (
                SELECT
                    sl."courseId",
                    sl."weekNumber",
                    sl."dayNumber",
                    l."LessonId" AS start_lesson_id
                FROM start_lessons sl
                JOIN "Lesson" l ON l."courseId" = sl."courseId"
                                AND l."weekNumber" = sl."weekNumber"
                                AND l."dayNumber" = sl."dayNumber"
                                AND l."SequenceNumber" = sl.min_sequence
                ),
                end_lesson_ids AS (
                SELECT
                    el."courseId",
                    el."weekNumber",
                    el."dayNumber",
                    l."LessonId" AS end_lesson_id
                FROM end_lessons el
                JOIN "Lesson" l ON l."courseId" = el."courseId"
                                AND l."weekNumber" = el."weekNumber"
                                AND l."dayNumber" = el."dayNumber"
                                AND l."SequenceNumber" = el.max_sequence
                ),

                -- 4. Combine into one mapping of start/end per group/week/day
                lesson_mapping AS (
                SELECT
                    cg.group_name,
                    sl."courseId",
                    sl."weekNumber",
                    sl."dayNumber",
                    sl.start_lesson_id,
                    el.end_lesson_id
                FROM start_lesson_ids sl
                JOIN end_lesson_ids el ON sl."courseId" = el."courseId"
                                        AND sl."weekNumber" = el."weekNumber"
                                        AND sl."dayNumber" = el."dayNumber"
                JOIN course_groups cg ON sl."courseId" = cg.course_id
                ),

                -- 5. Add Level 4 Day 2 to Day 3 for assessments
                adjusted_lesson_mapping AS (
                SELECT * FROM lesson_mapping
                UNION ALL
                SELECT
                    group_name,
                    "courseId",
                    "weekNumber",
                    3 AS dayNumber,
                    start_lesson_id,
                    end_lesson_id
                FROM lesson_mapping
                WHERE group_name IN ('Pre-Assessment','Post-Assessment')
                    AND "dayNumber" = 2
                    AND "courseId" IN (142,147)
                ),

                -- 6. Collect all lesson IDs for each group/week/day, including adjustments
                day_lessons AS (
                -- a) standard lessons
                SELECT
                    cg.group_name,
                    l."weekNumber",
                    l."dayNumber",
                    ARRAY_AGG(l."LessonId") AS all_lesson_ids
                FROM "Lesson" l
                JOIN course_groups cg ON l."courseId" = cg.course_id
                WHERE l."weekNumber" IS NOT NULL AND l."dayNumber" IS NOT NULL
                GROUP BY cg.group_name, l."weekNumber", l."dayNumber"

                UNION ALL

                -- b) Pre-Assessment Level 4 Day 2 treated as Day 3
                SELECT
                    cg.group_name,
                    l."weekNumber",
                    3 AS dayNumber,
                    ARRAY_AGG(l."LessonId") AS all_lesson_ids
                FROM "Lesson" l
                JOIN course_groups cg ON l."courseId" = cg.course_id
                WHERE cg.group_name = 'Pre-Assessment' AND l."courseId" = 142 AND l."dayNumber" = 2
                GROUP BY cg.group_name, l."weekNumber"

                UNION ALL

                -- c) Post-Assessment Level 4 Day 2 treated as Day 3
                SELECT
                    cg.group_name,
                    l."weekNumber",
                    3 AS dayNumber,
                    ARRAY_AGG(l."LessonId") AS all_lesson_ids
                FROM "Lesson" l
                JOIN course_groups cg ON l."courseId" = cg.course_id
                WHERE cg.group_name = 'Post-Assessment' AND l."courseId" = 147 AND l."dayNumber" = 2
                GROUP BY cg.group_name, l."weekNumber"
                ),

                -- 7. Aggregate all lesson data
                aggregated_metrics AS (
                SELECT
                    alm.group_name,
                    alm."weekNumber",
                    alm."dayNumber",
                    ARRAY_AGG(DISTINCT alm.start_lesson_id) AS start_lesson_ids,
                    ARRAY_AGG(DISTINCT alm.end_lesson_id) AS end_lesson_ids,
                    dl.all_lesson_ids
                FROM adjusted_lesson_mapping alm
                JOIN day_lessons dl ON dl.group_name = alm.group_name
                                    AND dl."weekNumber" = alm."weekNumber"
                                    AND dl."dayNumber" = alm."dayNumber"
                GROUP BY alm.group_name, alm."weekNumber", alm."dayNumber", dl.all_lesson_ids
                ),

                -- 8. Get all relevant lesson completions for our filtered users
                user_completions AS (
                    SELECT
                        lc.profile_id,
                        lc."lessonId",
                        lc."completionStatus"
                    FROM wa_lessons_completed lc
                    JOIN filtered_users fu ON lc.profile_id = fu.profile_id
                ),

                -- 9. A calendar of all possible days for each group
                day_calendar AS (
                    SELECT DISTINCT
                        group_name,
                        "weekNumber",
                        "dayNumber"
                    FROM aggregated_metrics
                ),

                -- 10. Cross join users with the calendar to create a full grid
                user_day_grid AS (
                    SELECT
                        fu.profile_id,
                        dc.group_name,
                        dc."weekNumber",
                        dc."dayNumber"
                    FROM filtered_users fu
                    CROSS JOIN day_calendar dc
                ),

                -- 11. Join the grid with actual completions to get raw status
                user_daily_status AS (
                    SELECT
                        udg.profile_id,
                        udg.group_name,
                        udg."weekNumber",
                        udg."dayNumber",
                        MAX(CASE WHEN uc."lessonId" = ANY(am.start_lesson_ids) THEN 1 ELSE 0 END) AS has_started_day,
                        MAX(CASE WHEN uc."lessonId" = ANY(am.end_lesson_ids) AND uc."completionStatus" = 'Completed' THEN 1 ELSE 0 END) AS has_completed_day
                    FROM user_day_grid udg
                    JOIN aggregated_metrics am
                        ON udg.group_name = am.group_name
                        AND udg."weekNumber" = am."weekNumber"
                        AND udg."dayNumber" = am."dayNumber"
                    LEFT JOIN user_completions uc
                        ON udg.profile_id = uc.profile_id
                        AND uc."lessonId" = ANY(am.all_lesson_ids)
                    GROUP BY
                        udg.profile_id,
                        udg.group_name,
                        udg."weekNumber",
                        udg."dayNumber"
                ),

                -- 12. Apply the funnel logic using LAG to enforce sequential progress
                sequential_progress AS (
                    SELECT
                        profile_id,
                        group_name,
                        "weekNumber",
                        "dayNumber",
                        has_started_day,
                        (has_started_day * has_completed_day) as is_truly_completed
                    FROM user_daily_status
                ),

                funnel AS (
                    SELECT
                        profile_id,
                        group_name,
                        "weekNumber",
                        "dayNumber",
                        has_started_day,
                        is_truly_completed,
                        COALESCE(MIN(is_truly_completed) OVER (
                            PARTITION BY profile_id, group_name
                            ORDER BY "weekNumber", "dayNumber"
                            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                        ), 1) as prerequisite_met
                    FROM sequential_progress
                ),

                -- 13. Aggregate the final counts based on valid sequential progress
                final_counts AS (
                    SELECT
                        group_name,
                        "weekNumber",
                        "dayNumber",
                        COUNT(profile_id) FILTER (WHERE has_started_day = 1 AND prerequisite_met = 1) AS started_count,
                        COUNT(profile_id) FILTER (WHERE is_truly_completed = 1 AND prerequisite_met = 1) AS completed_count
                    FROM funnel
                    GROUP BY group_name, "weekNumber", "dayNumber"
                )

                -- 14. Final report
                SELECT description, count
                FROM (
                -- Total Users
                SELECT 'Total Users' AS description, COUNT(*) AS count, 1 AS sort_order
                FROM filtered_users

                UNION ALL

                -- Users with one message
                SELECT 'Started Users (One Message)' AS description, COUNT(*) AS count, 2 AS sort_order
                FROM filtered_users fu
                JOIN wa_user_progress p ON fu.profile_id = p.profile_id
                WHERE (p."acceptableMessages" IS NULL OR p."acceptableMessages" <> ARRAY['start now!'])

                UNION ALL

                -- Pre-Assessment: Started
                SELECT
                    'Pre-Assessment Started Week ' || fc."weekNumber" || ' Day ' || fc."dayNumber" AS description,
                    fc.started_count AS count,
                    (3 + (fc."weekNumber" - 1)*10 + (fc."dayNumber" - 1)*2) AS sort_order
                FROM final_counts fc
                WHERE fc.group_name = 'Pre-Assessment'


                UNION ALL

                -- Pre-Assessment: Completed
                SELECT
                    'Pre-Assessment Completed Week ' || fc."weekNumber" || ' Day ' || fc."dayNumber" AS description,
                    fc.completed_count AS count,
                    (4 + (fc."weekNumber" - 1)*10 + (fc."dayNumber" - 1)*2) AS sort_order
                FROM final_counts fc
                WHERE fc.group_name = 'Pre-Assessment'

                UNION ALL

                -- Main Course: Started
                SELECT
                    'Main Course Started Week ' || fc."weekNumber" || ' Day ' || fc."dayNumber" AS description,
                    fc.started_count AS count,
                    (100 + (fc."weekNumber" - 1)*10 + (fc."dayNumber" - 1)*2) AS sort_order
                FROM final_counts fc
                WHERE fc.group_name = 'Main Course'

                UNION ALL

                -- Main Course: Completed
                SELECT
                    'Main Course Completed Week ' || fc."weekNumber" || ' Day ' || fc."dayNumber" AS description,
                    fc.completed_count AS count,
                    (101 + (fc."weekNumber" - 1)*10 + (fc."dayNumber" - 1)*2) AS sort_order
                FROM final_counts fc
                WHERE fc.group_name = 'Main Course'
                ) final_results
                ORDER BY sort_order;
        `;

        const [courseStats] = await sequelize.query(courseStatsQuery);

        return courseStats;
    } catch (error) {
        error.fileName = 'statsService.js';
        throw error;
    }
};

const studentUserJourneyStatsService = async (date) => {
    try {
        // Set default date if not provided
        const filterDate = date || '2025-04-26 12:00:00';

        // Final optimized Query 1: Further micro-optimizations
        const userDataQuery = `
            WITH base_filtered_users AS (
              SELECT 
                m."phoneNumber",
                m.name,
                m.city,
                m."userClickedLink",
                m."freeDemoStarted",
                m."freeDemoEnded",
                m."userRegistrationComplete",
                m."schoolName",
                m."targetGroup", 
                m.cohort,
                m."profile_id",
                p.phone_number, 
                p.profile_type, 
                p.created_at
              FROM wa_users_metadata m
              INNER JOIN wa_profiles p ON m."profile_id" = p.profile_id
              WHERE m."userClickedLink" > TIMESTAMP '${filterDate}'
              AND p.profile_type = 'student'
            ),
            
            activity_aggregated AS (
              SELECT 
                wal.profile_id,
                wal.timestamp,
                wal.id,
                wal."messageDirection",
                wal."messageContent",
                wal."courseId",
                -- Calculate next course for trial detection
                LEAD(wal."courseId") OVER (
                  PARTITION BY wal.profile_id 
                  ORDER BY wal.timestamp, wal.id
                ) AS next_course_id,
                -- Get first and last messages efficiently
                FIRST_VALUE(wal."messageContent"[1]) OVER (
                  PARTITION BY wal.profile_id 
                  ORDER BY wal.timestamp ASC, wal.id ASC 
                  ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
                ) AS first_message_content,
                FIRST_VALUE(wal."messageContent") OVER (
                  PARTITION BY wal.profile_id 
                  ORDER BY wal.timestamp DESC, wal.id DESC 
                  ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
                ) AS last_message_content,
                FIRST_VALUE(wal.timestamp) OVER (
                  PARTITION BY wal.profile_id 
                  ORDER BY wal.timestamp DESC, wal.id DESC 
                  ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
                ) AS last_message_timestamp
              FROM base_filtered_users bfu
              INNER JOIN wa_user_activity_logs wal ON bfu.profile_id = wal.profile_id
            ),
            
            trial_counts AS (
              SELECT 
                profile_id,
                SUM(CASE 
                  WHEN "messageDirection" = 'inbound' 
                  AND "messageContent"[1] = 'start free trial'
                  AND next_course_id = 113 
                  THEN 1 ELSE 0 
                END) AS level3_trial_starts,
                SUM(CASE 
                  WHEN "messageDirection" = 'inbound' 
                  AND "messageContent"[1] = 'start free trial'
                  AND next_course_id = 117 
                  THEN 1 ELSE 0 
                END) AS level1_trial_starts,
                MIN(first_message_content) AS first_message_content,
                MAX(last_message_content) AS last_message_content,
                MAX(last_message_timestamp) AS last_message_timestamp
              FROM activity_aggregated
              GROUP BY profile_id
            )
            
            SELECT
              bfu."phoneNumber",
              bfu.name,
              bfu.city,
              bfu."userClickedLink",
              bfu."freeDemoStarted",
              bfu."freeDemoEnded",
              bfu."userRegistrationComplete",
              bfu."schoolName",
              bfu."targetGroup", 
              bfu.cohort,
              bfu.profile_id, 
              bfu.phone_number, 
              bfu.profile_type, 
              bfu.created_at,
              wup.persona,
              wup.engagement_type, 
              wup."currentCourseId", 
              wup."currentWeek", 
              wup."currentDay", 
              wup."currentLessonId", 
              wup."currentLesson_sequence", 
              wup."activityType",
              wup."questionNumber",
              wup."acceptableMessages",
              COALESCE(tc.level3_trial_starts, 0) AS level3_trial_starts,
              COALESCE(tc.level1_trial_starts, 0) AS level1_trial_starts,
              CASE
                WHEN LOWER(tc.first_message_content) = LOWER('Start Free Trial now!') THEN 'Community'
                WHEN LOWER(tc.first_message_content) = LOWER('Start my Free Trial now!') THEN 'Social Media ads'
                WHEN LOWER(tc.first_message_content) = LOWER('Send this message to START!') THEN 'Social Media ads'
                WHEN LOWER(tc.first_message_content) = LOWER('Start my FREE Demo! (Click send)') THEN 'Flyer'
                WHEN LOWER(tc.first_message_content) = LOWER('Click send to start Free Demo!') THEN 'Standee'
                WHEN LOWER(tc.first_message_content) = LOWER('سٹارٹ فری ٹرائل') THEN 'Urdu Flyer'
                ELSE 'Unknown'
              END AS source,
              tc.last_message_content,
              tc.last_message_timestamp
            FROM base_filtered_users bfu
            INNER JOIN wa_user_progress wup ON bfu.profile_id = wup.profile_id
            LEFT JOIN trial_counts tc ON bfu.profile_id = tc.profile_id
            ORDER BY bfu."phoneNumber"
        `;

        // Further optimized Query 2: Use EXISTS for better performance
        const statsQuery = `
            SELECT 'Clicked Link' AS stage, 
                   COUNT(*) as count
            FROM wa_users_metadata m
            WHERE m."userClickedLink" > TIMESTAMP '${filterDate}'
            AND m."userClickedLink" IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM wa_profiles p 
              WHERE p.profile_id = m.profile_id 
              AND p.profile_type = 'student'
            )
            AND EXISTS (
              SELECT 1 FROM wa_user_progress wup 
              WHERE wup.profile_id = m.profile_id
            )

            UNION ALL

            SELECT 'Demo Started' AS stage, 
                   COUNT(*) as count
            FROM wa_users_metadata m
            WHERE m."userClickedLink" > TIMESTAMP '${filterDate}'
            AND m."freeDemoStarted" IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM wa_profiles p 
              WHERE p.profile_id = m.profile_id 
              AND p.profile_type = 'student'
            )
            AND EXISTS (
              SELECT 1 FROM wa_user_progress wup 
              WHERE wup.profile_id = m.profile_id
            )

            UNION ALL

            SELECT 'Demo Ended' AS stage, 
                   COUNT(*) as count
            FROM wa_users_metadata m
            WHERE m."userClickedLink" > TIMESTAMP '${filterDate}'
            AND m."freeDemoEnded" IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM wa_profiles p 
              WHERE p.profile_id = m.profile_id 
              AND p.profile_type = 'student'
            )
            AND EXISTS (
              SELECT 1 FROM wa_user_progress wup 
              WHERE wup.profile_id = m.profile_id
            )

            UNION ALL

            SELECT 'Registration Completed' AS stage, 
                   COUNT(*) as count
            FROM wa_users_metadata m
            WHERE m."userClickedLink" > TIMESTAMP '${filterDate}'
            AND m."userRegistrationComplete" IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM wa_profiles p 
              WHERE p.profile_id = m.profile_id 
              AND p.profile_type = 'student'
            )
            AND EXISTS (
              SELECT 1 FROM wa_user_progress wup 
              WHERE wup.profile_id = m.profile_id
            )
        `;

        // Optimized Query 3: Use EXISTS for graph query  
        const graphQuery = `
            SELECT 
                DATE(m."userClickedLink") AS date,
                COUNT(DISTINCT m."phoneNumber") AS clicked_count,
                COUNT(DISTINCT CASE WHEN m."userRegistrationComplete" IS NOT NULL THEN m."phoneNumber" END) AS registered_count,
                CASE 
                    WHEN COUNT(DISTINCT m."phoneNumber") > 0 
                    THEN ROUND((COUNT(DISTINCT CASE WHEN m."userRegistrationComplete" IS NOT NULL THEN m."phoneNumber" END)::numeric / COUNT(DISTINCT m."phoneNumber")) * 100, 2)
                    ELSE 0
                END AS conversion_percentage
            FROM wa_users_metadata m
            WHERE m."userClickedLink" >= TIMESTAMP '${filterDate}'
            AND EXISTS (
              SELECT 1 FROM wa_profiles p 
              WHERE p.profile_id = m.profile_id 
              AND p.profile_type = 'student'
            )
            GROUP BY DATE(m."userClickedLink")
            ORDER BY date
        `;

        // Execute all queries concurrently
        const [userData, stageStats, graphData] = await Promise.all([
            sequelize.query(userDataQuery),
            sequelize.query(statsQuery),
            sequelize.query(graphQuery)
        ]).then(results => results.map(result => result[0]));

        // Calculate conversion rates between stages
        const stats = {};
        let previousCount = null;

        stageStats.forEach(stage => {
            stats[stage.stage] = {
                count: parseInt(stage.count),
                percentage: previousCount ? parseFloat(((stage.count / previousCount) * 100).toFixed(2)) : 100,
                dropPercentage: previousCount ? parseFloat((100 - ((stage.count / previousCount) * 100)).toFixed(2)) : 0
            };
            previousCount = parseInt(stage.count);
        });

        return {
            userData,
            stats,
            graphData
        };
    } catch (error) {
        error.fileName = 'statsService.js';
        throw error;
    }
};

const clearingCacheService = async () => {
    try {
        const queries = [
            `UPDATE "MultipleChoiceQuestionAnswers"
             SET
                 "AnswerImageMediaId" = NULL,
                 "AnswerAudioMediaId" = NULL,
                 "CustomAnswerFeedbackImageMediaId" = NULL,
                 "CustomAnswerFeedbackAudioMediaId" = NULL;`,

            `UPDATE "speakActivityQuestions"
             SET
                 "mediaFileMediaId" = NULL,
                 "mediaFileSecondMediaId" = NULL,
                 "customFeedbackImageMediaId" = NULL,
                 "customFeedbackAudioMediaId" = NULL;`,

            `UPDATE "MultipleChoiceQuesions"
             SET
                 "QuestionImageMediaId" = NULL,
                 "QuestionAudioMediaId" = NULL,
                 "QuestionVideoMediaId" = NULL;`,

            `UPDATE "DocumentFiles"
             SET
                 "videoMediaId" = NULL,
                 "audioMediaId" = NULL,
                 "imageMediaId" = NULL;`
        ];

        const results = [];

        // Execute queries sequentially to ensure proper execution
        for (const query of queries) {
            const [result] = await sequelize.query(query);
            results.push(result);
        }

        return {
            success: true,
            message: 'Cache cleared successfully',
            affectedRows: {
                multipleChoiceQuestionAnswers: results[0],
                speakActivityQuestions: results[1],
                multipleChoiceQuestions: results[2],
                documentFiles: results[3]
            }
        };
    } catch (error) {
        error.fileName = 'statsService.js';
        throw error;
    }
};

const studentAnalyticsService = async (courseIds, grades, cohorts, graphType, userType) => {
    try {
        let grade = grades, courseId = courseIds, qry1 = ``, qry2 = ``, cohort = ``, cohortCond = ``, courseCond= ``, cohortCond1=``, dayno = 0, maxDay = 0;
        if(userType === 'teacher'){
            grade = ` and m."classLevel" is null `;
            maxDay = 6;
        }
        else{
            grade = ` and m."classLevel" = '${grade}' `;
            maxDay = 5;
        }
        if (cohorts) {
            cohort = ` and m."cohort" = '${cohorts}' `;
        }
        else {
            cohort = ` AND m."cohort" IS NOT NULL AND m."cohort" != 'Cohort 0' AND m."cohort" != 'Cohort 35' `;
        }
        if(graphType === 'graph6'){
            grade = grades;
        }
        console.log('courseIds', courseId, 'grades', grade, 'cohorts', cohort, 'graphType', graphType, 'userType' , userType);
        if (graphType === 'graph1') {
            qry1 = `WITH "TargetGroup" AS (
                            SELECT m.profile_id
                            FROM wa_users_metadata m
                            JOIN wa_profiles p ON m.profile_id = p.profile_id
                            WHERE p."profile_type" = '${userType}' and
                            m."rollout" = 2 
                            ${grade}
                            ${cohort}
                        ),

                        "LessonList" AS (
                            SELECT 
                                l."LessonId",
                                l."courseId",
                                l."weekNumber",
                                l."dayNumber",
                                l."SequenceNumber",
                                ROW_NUMBER() OVER (
                                    ORDER BY l."weekNumber", l."dayNumber", l."SequenceNumber"
                                ) AS order_num,
                                ((l."weekNumber" - 1) * ${maxDay} + l."dayNumber") AS day
                            FROM "Lesson" l
                            WHERE l."courseId" = ${courseId}
                        ),

                        "LessonCompleted" AS (
                            SELECT 
                                c."profile_id",
                                c."lessonId",
                                c."completionStatus",
                                c."endTime"
                            FROM wa_lessons_completed c
                            JOIN "TargetGroup" t ON t.profile_id = c.profile_id
                            JOIN "LessonList" l ON l."LessonId" = c."lessonId"
                            WHERE c."courseId" = ${courseId}
                        ),

                        "UserLessonStatus" AS (
                            SELECT 
                                c."profile_id",
                                c."lessonId",
                                c."completionStatus",
                                l."order_num",
                                l."day"
                            FROM "LessonCompleted" c
                            JOIN "LessonList" l ON c."lessonId" = l."LessonId"
                        ),

                        "LastUserLesson" AS (
                            SELECT DISTINCT ON (profile_id)
                                profile_id,
                                "lessonId",
                                "completionStatus",
                                order_num,
                                day
                            FROM "UserLessonStatus"
                            ORDER BY profile_id, order_num DESC
                        ),

                        "AdjustedDay" AS (
                            SELECT 
                                l.profile_id,
                                CASE 
                                    WHEN l."completionStatus" = 'Completed' THEN l.day
                                    WHEN l."completionStatus" = 'Started' THEN COALESCE(prev.day, 0)
                                    ELSE 0
                                END AS adjusted_day
                            FROM "LastUserLesson" l
                            LEFT JOIN "LessonList" prev ON prev.order_num = l.order_num - 1
                        ),

                        "DaySeries" AS (
                            SELECT generate_series(0, 24) AS day
                        ),

                        "DayCounts" AS (
                            SELECT adjusted_day AS day, COUNT(*) AS count
                            FROM "AdjustedDay"
                            GROUP BY adjusted_day
                        )

                        SELECT 
                            CONCAT('day ', d.day) AS day,
                            nullif(COALESCE(dc.count, 0),0) AS count
                        FROM "DaySeries" d
                        LEFT JOIN "DayCounts" dc ON d.day = dc.day
                        ORDER BY d.day;
                        `;
            // qry1 = `WITH "TargetGroup" AS (
            //     SELECT 
            //         "m"."profile_id"
            //     FROM 
            //         "wa_users_metadata" AS "m"
            //     inner join "wa_profiles" p on m."profile_id" = p."profile_id"
            //     WHERE 
            //         p."profile_type" = '${userType}' and
            //                 m."rollout" = 2 
            //                 ${grade}
            //                 ${cohort}
            // ),
            // "user_progress" AS (
            //     SELECT 
            //         "p"."profile_id",
            //         "p"."currentWeek",
            //         "p"."currentDay",
            //         "p"."acceptableMessages",
            //         CASE 
            //             WHEN 'start next lesson' = ANY("p"."acceptableMessages") THEN 1 
            //             ELSE 0 
            //         END AS "lesson_completed_count"
            //     FROM 
            //         "wa_user_progress" AS "p"
            //     INNER JOIN 
            //         "TargetGroup" AS "t" 
            //     ON 
            //         "p"."profile_id" = "t"."profile_id" 
            //         AND "p"."currentCourseId" = ${courseId}
            // ),
            // get_dayCount as (
            // SELECT 
            //     "currentWeek",
            //     "currentDay",
            //     "lesson_completed_count",
            //    -- (("currentWeek" - 1) * 6 + "currentDay") as day
            //    CASE 
            //         WHEN ("lesson_completed_count" = 1 OR ("currentWeek" = 4 AND "currentDay" = ${maxDay})) 
            //        THEN (("currentWeek" - 1) * ${maxDay} + "currentDay") 
            //         ELSE (("currentWeek" - 1) * ${maxDay} + "currentDay" ) - 1
            //      END AS "day"
            // FROM 
            //     "user_progress"
            //     WHERE 
            //     "currentWeek" IS NOT NULL 
            //     AND "currentDay" IS NOT NULL
            // ORDER BY 
            //     "currentWeek", "currentDay"
            //     ),
            // dayseries as (SELECT generate_series(0, 24) AS "day"),
            // getvalues as (select "day",count(*) from get_dayCount g group by g."day")
            // select CONCAT('day ', d."day") as "day",v."count" from dayseries d left join getvalues v 
            // on d."day" = v."day" ORDER BY 
            //     d."day";`;

                // console.log(qry1);
        
            qry2 = `WITH TargetGroup AS (
                    SELECT 
                        m."profile_id"
                    FROM 
                        "wa_users_metadata" m
                    inner join "wa_profiles" p on m."profile_id" = p."profile_id"
                    WHERE 
                        p."profile_type" = '${userType}' and
                                m."rollout" = 2 
                                ${grade} 
                                ${cohort}
                ),
                UnattemptedPhoneNumbers AS (
                    SELECT 
                        tg."profile_id"
                    FROM 
                        TargetGroup tg
                    LEFT JOIN 
                        "wa_lessons_completed" l 
                    ON 
                        tg."profile_id" = l."profile_id" 
                        AND l."courseId" = ${courseId}
                    WHERE 
                        l."lessonId" IS NULL
                )
                SELECT 
                    (SELECT COUNT(*) FROM TargetGroup) AS "total_count",
                    (SELECT COUNT(*) FROM UnattemptedPhoneNumbers) AS "total_not_started";`;
        }

        if (graphType === 'graph2') {

            qry1 =  `WITH "TargetGroup" AS (
                        SELECT
                            m.profile_id
                        FROM wa_users_metadata m
                        JOIN wa_profiles p ON p.profile_id = m.profile_id
                        WHERE
                             p."profile_type" = '${userType}' and
                                m."rollout" = 2 
                                ${grade} 
                                ${cohort}
                        ),
                        "LessonList" AS (
                        SELECT
                            l."LessonId",
                            l.activity,
                            l."activityAlias",
                            l."weekNumber",
                            l."dayNumber",
                            l."SequenceNumber",
                            ROW_NUMBER() OVER (
                            ORDER BY l."weekNumber", l."dayNumber", l."SequenceNumber"
                            ) AS order_num
                        FROM "Lesson" l
                        WHERE
                            l."courseId" = ${courseId}
                            AND l.status = 'Active'
                        ),
                        "UserCompletions" AS (
                        SELECT
                            c.profile_id,
                            c."lessonId",
                            c."completionStatus",
                            c."endTime",
                            ll.order_num
                        FROM wa_lessons_completed c
                        JOIN "TargetGroup" tg ON c.profile_id = tg.profile_id
                        JOIN "LessonList" ll ON ll."LessonId" = c."lessonId"
                        WHERE c."courseId" = ${courseId}
                        ),
                        "LatestPerUser" AS (
                        SELECT DISTINCT ON (profile_id)
                            profile_id,
                            "lessonId",
                            "completionStatus",
                            order_num
                        FROM "UserCompletions"
                        ORDER BY profile_id, order_num DESC
                        ),
                        "AdjustedLesson" AS (
                        SELECT
                            lpu.profile_id,
                            CASE
                            WHEN lpu."completionStatus" = 'Completed' THEN lpu.order_num
                            WHEN lpu."completionStatus" = 'Started' AND lpu.order_num > 1 THEN lpu.order_num - 1
                            ELSE 1
                            END AS assigned_order
                        FROM "LatestPerUser" lpu
                        ),
                        Counts AS (
                        SELECT
                            al.assigned_order,
                            COUNT(*) AS user_count
                        FROM "AdjustedLesson" al
                        GROUP BY al.assigned_order
                        )
                        SELECT
                        ll."LessonId",
                        nullif(COALESCE(c.user_count, 0),0) AS total_students_completed
                        FROM "LessonList" ll
                        LEFT JOIN Counts c
                        ON ll.order_num = c.assigned_order
                        ORDER BY ll."weekNumber", ll."dayNumber", ll."SequenceNumber";
                        `;
            // qry1 = `WITH TargetGroup AS (
            //     SELECT 
            //         m."profile_id"
            //     FROM 
            //         "wa_users_metadata" m
            //         inner join "wa_profiles" p on m."profile_id" = p."profile_id"
            //     WHERE 
            //         p."profile_type" = '${userType}' and
            //                 m."rollout" = 2 
            //                 ${grade}
            //                ${cohort}
            // ),
            // get_lessonIds AS (
            //     SELECT 
            //         "LessonId", 
            //         "activity",
            //         "activityAlias",
            //         "weekNumber", 
            //         "dayNumber",
            //         "SequenceNumber" 
            //     FROM 
            //         "Lesson" 
            //     WHERE 
            //         "courseId" = ${courseId} and "status" = 'Active'
            // ),
            // LessonWithMaxTimestamp AS (
            //     SELECT 
            //         l."profile_id",
            //         l."lessonId",
            //         l."endTime",
            //         ROW_NUMBER() OVER (
            //             PARTITION BY l."profile_id" 
            //             ORDER BY l."endTime" DESC
            //         ) AS row_num
            //     FROM 
            //         "wa_lessons_completed" l
            //     INNER JOIN 
            //         TargetGroup tg 
            //     ON 
            //         l."profile_id" = tg."profile_id"
            //     WHERE 
            //         l."completionStatus" = 'Completed'
            //         AND l."courseId" = ${courseId}
            // ),
            // LessonCompletionCounts AS (
            //     SELECT 
            //         lw."lessonId",
            //         COUNT(lw."profile_id") AS "completionCount"
            //     FROM 
            //         LessonWithMaxTimestamp lw
            //     WHERE 
            //         lw.row_num = 1
            //     GROUP BY 
            //         lw."lessonId"
            // )
            // SELECT 
            //     g."LessonId",
            //    -- CONCAT(g."LessonId", ' (', g."activity", ')') AS "LessonId",
            //     COALESCE(lcc."completionCount", null) AS "total_students_completed"
            // FROM 
            //     get_lessonIds g
            // LEFT JOIN 
            //     LessonCompletionCounts lcc 
            // ON 
            //     g."LessonId" = lcc."lessonId"
            // ORDER BY 
            //     g."weekNumber",g."dayNumber",g."SequenceNumber";`
          console.log(qry1);

            qry2 = `WITH TargetGroup AS (
                    SELECT 
                        m."profile_id"
                    FROM 
                        "wa_users_metadata" m
                    inner join "wa_profiles" p on m."profile_id" = p."profile_id"
                    WHERE 
                        p."profile_type" = '${userType}' and
                                m."rollout" = 2 
                                ${grade}
                                ${cohort}
                ),
                UnattemptedPhoneNumbers AS (
                    SELECT 
                        tg."profile_id"
                    FROM 
                        TargetGroup tg
                    LEFT JOIN 
                        "wa_lessons_completed" l 
                    ON 
                        tg."profile_id" = l."profile_id" 
                        AND l."courseId" = ${courseId}
                    WHERE 
                        l."lessonId" IS NULL
                )
                SELECT 
                    (SELECT COUNT(*) FROM TargetGroup) AS "total_count",
                    (SELECT COUNT(*) FROM UnattemptedPhoneNumbers) AS "total_not_started";`;
        }

        if (graphType === 'graph3') {
                let days = 20;
                let gradeCond = '';
                let courseCond = '';
                let cohortCond = '';
                let cohortCond1 = '';

                 if(userType === "student"){
                    days = 20;
                    if(!grades && !cohorts && !courseIds){
                        gradeCond = ` AND m."classLevel" IN ('grade 1', 'grade 2', 'grade 3', 'grade 4', 'grade 5', 'grade 6', 'grade 7') `;
                        courseCond = ` l."courseId" IN (119, 120, 121, 122, 123, 124, 143) `;
                        cohortCond1 = ` c."courseId" IN (119, 120, 121, 122, 123, 124, 143) `;
                    }
                    if(!cohorts){
                       cohortCond = ` AND m.cohort IS NOT NULL AND m.cohort != 'Cohort 0' AND m.cohort != 'Cohort 35' `;
                    }
                    if(grades){
                        gradeCond = ` AND m."classLevel" = '${grades}' `;
                    }
                    if(courseIds){
                        gradeCond = ` AND m."classLevel" = '${grades}' `;
                        courseCond = ` l."courseId" IN (${courseIds}) `;
                        cohortCond1 = ` c."courseId" IN (${courseIds}) `;
                    }
                 }
                 if(userType === "teacher"){
                    days = 24;
                    if(!grades && !cohorts && !courseIds){
                        days = 72;
                        gradeCond = ` AND m."classLevel" IS NULL `;
                        courseCond = ` l."courseId" IN (134, 135, 136) `;
                        cohortCond1 = ` c."courseId" IN (134, 135, 136) `;
                    }
                    if(!cohorts){
                       cohortCond = ` AND m.cohort IS NOT NULL AND m.cohort != 'Cohort 0' AND m.cohort != 'Cohort 35' `;
                    }
                    if(courseIds){
                        days = 24;
                        gradeCond = ` AND m."classLevel" is null `;
                        courseCond = ` l."courseId" IN (${courseIds}) `;
                        cohortCond1 = ` c."courseId" IN (${courseIds}) `;
                    }
                    
                 }

                qry1 = `
                    WITH "TargetGroup" AS (
                        SELECT m.profile_id
                        FROM wa_users_metadata m
                        INNER JOIN wa_profiles p ON m.profile_id = p.profile_id
                        WHERE p.profile_type = '${userType}'
                        AND m.rollout = 2
                        ${gradeCond} 
                        ${cohortCond}
                    ),
                    "LatestLessonsPerDay" AS (
                        SELECT DISTINCT ON (l."courseId", l."weekNumber", l."dayNumber")
                            l."courseId", l."weekNumber", l."dayNumber", l."LessonId"
                        FROM "Lesson" l
                        WHERE l.status = 'Active' and
                        ${courseCond}
                        ORDER BY l."courseId", l."weekNumber", l."dayNumber", l."SequenceNumber" DESC
                    ),
                    "FilteredCompletions" AS (
                        SELECT 
                            c.profile_id,
                            c."lessonId",
                            l."courseId",
                            l."weekNumber",
                            l."dayNumber",
                            c."endTime"
                        FROM wa_lessons_completed c
                        INNER JOIN "TargetGroup" t ON t.profile_id = c.profile_id
                        INNER JOIN "Lesson" l ON l."LessonId" = c."lessonId"
                        INNER JOIN "LatestLessonsPerDay" latest 
                        ON latest."LessonId" = l."LessonId"
                        AND latest."courseId" = l."courseId"
                        AND latest."weekNumber" = l."weekNumber"
                        AND latest."dayNumber" = l."dayNumber"
                        WHERE c."endTime" IS NOT NULL
                    ),
                    "LessonCountsByDate" AS (
                        SELECT 
                            DATE(c."endTime") AS completion_date,
                            COUNT(DISTINCT c.profile_id || '-' || c."courseId" || '-' || c."lessonId") AS lesson_completion_count
                        FROM "FilteredCompletions" c
                        GROUP BY DATE(c."endTime")
                    ),
                    "WeekdayLessonDates" AS (
                        SELECT completion_date
                        FROM "LessonCountsByDate"
                        WHERE EXTRACT(DOW FROM completion_date) NOT IN (0, 6)
                    ),
                    "StartedUsers" AS (
                        SELECT COUNT(DISTINCT c.profile_id) AS started_user_count
                        FROM wa_lessons_completed c
                        INNER JOIN "TargetGroup" t ON t.profile_id = c.profile_id
                        WHERE ${cohortCond1}
                    )
                    SELECT 
                        lc.*,
                        su.started_user_count,
                        su.started_user_count * ${days} AS expected_total_lessons,
                        (SELECT SUM(lesson_completion_count) FROM "LessonCountsByDate") AS actual_total_lessons,
                        ROUND(
                        (lc.lesson_completion_count::decimal / NULLIF(su.started_user_count::decimal * ${days}, 0)) * 100, 2) AS daily_completion_rate
                    FROM "LessonCountsByDate" lc
                    CROSS JOIN "StartedUsers" su
                    ORDER BY lc.completion_date;
                `;

        }
        if (graphType === 'graph4') {

            if (grade !== null) {
                qry1 = `WITH TotalUsers AS (
                SELECT 
                    m."cohort", 
                    m."profile_id"
                FROM wa_users_metadata m
                INNER JOIN wa_profiles p ON m.profile_id = p.profile_id
                WHERE 
                    p.profile_type = '${userType}'
                    AND m.rollout = 2
                    ${grade}
                    AND m.cohort IS NOT NULL AND m.cohort != 'Cohort 0' AND m.cohort != 'Cohort 35'
                ),
                LessonCheck AS (
                SELECT DISTINCT profile_id
                FROM wa_lessons_completed
                WHERE "courseId" = ${courseId}
                )
                SELECT 
                tu."cohort",
                COUNT(*) AS total_users_in_cohort,
                COUNT(*) - COUNT(CASE WHEN lc.profile_id IS NULL THEN 1 END) as started_user_count,
                COUNT(CASE WHEN lc.profile_id IS NULL THEN 1 END) AS not_started_user_count
                FROM TotalUsers tu
                LEFT JOIN LessonCheck lc ON tu.profile_id = lc.profile_id
                GROUP BY tu."cohort"
                ORDER BY CAST(SPLIT_PART(tu."cohort", ' ', 2) AS INTEGER);`;
            }

        }

        if (graphType === 'graph5') {
            qry1 = `WITH CourseInfo AS (
                    SELECT 
                        "CourseId",
                        "courseStartDate",
                        CURRENT_DATE - "courseStartDate" AS days_since_start,
                        CEIL((CURRENT_DATE - date("courseStartDate")) / 7.0) AS current_week,
                        CASE 
                            WHEN EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN 7 
                            ELSE EXTRACT(DOW FROM CURRENT_DATE) 
                        END AS current_day
                    FROM "Courses"
                    WHERE "CourseId" = ${courseId}
                ),

                ExpectedLessons AS (
                    SELECT 
                        c."CourseId",
                        COUNT(l."LessonId") AS total_expected_lessons
                    FROM CourseInfo c
                    JOIN "Lesson" l ON c."CourseId" = l."courseId"
                    WHERE l."status" = 'Active'
                    AND (
                        l."weekNumber" < c.current_week
                        OR 
                        (l."weekNumber" = c.current_week AND l."dayNumber" <= c.current_day)
                    )
                    GROUP BY c."CourseId"
                ),

                StudentCompletions AS (
                    SELECT 
                        m."profile_id",
                        m."phoneNumber",
                        l."courseId",
                        COUNT(DISTINCT l."lessonId") AS completed_lessons
                    FROM "wa_users_metadata" m
                    JOIN "wa_profiles" p ON m."profile_id" = p."profile_id"
                    LEFT JOIN "wa_lessons_completed" l ON 
                        m."profile_id" = l."profile_id" 
                        AND l."completionStatus" = 'Completed'
                    WHERE 
                        p."profile_type" = '${userType}'
                        AND m."rollout" = 2
                        ${grade}
                        AND l."courseId" = ${courseId}
                        ${cohort}
                    GROUP BY m."profile_id", m."phoneNumber", l."courseId"
                ),

                StudentProgress AS (
                    SELECT 
                        sc."profile_id",
                        sc."phoneNumber",
                        sc."courseId",
                        sc."completed_lessons",
                        el."total_expected_lessons",
                        CASE 
                            WHEN sc."completed_lessons" IS NULL THEN 'Not Started'
                            WHEN sc."completed_lessons" < el."total_expected_lessons" THEN 'Lagging Behind'
                            WHEN sc."completed_lessons" >= el."total_expected_lessons" THEN 'Up to Date'
                           -- WHEN sc."completed_lessons" >= el."total_expected_lessons" THEN 'ahead'
                        END AS progress_status
                    FROM StudentCompletions sc
                    JOIN ExpectedLessons el ON sc."courseId" = el."CourseId"
                ),

                AllStudents AS (
                    SELECT 
                        m."profile_id",
                        m."phoneNumber",
                        c."CourseId"
                    FROM "wa_users_metadata" m
                    JOIN "wa_profiles" p ON m."profile_id" = p."profile_id"
                    CROSS JOIN (SELECT DISTINCT "CourseId" FROM CourseInfo) c
                    WHERE 
                        p."profile_type" = '${userType}'
                        AND m."rollout" = 2
                        ${grade}
                        ${cohort}
                ),

                FinalResults AS (
                    SELECT 
                        a."profile_id",
                        a."phoneNumber",
                        a."CourseId" AS "courseId",
                        COALESCE(sp."progress_status", 'Not Started') AS "progress_status"
                    FROM AllStudents a
                    LEFT JOIN StudentProgress sp ON 
                        a."profile_id" = sp."profile_id" 
                        AND a."CourseId" = sp."courseId"
                )
                SELECT 
                    -- "courseId",
                    -- COUNT(*) AS total_students,
                   SUM(CASE WHEN "progress_status" = 'Not Started' THEN 1 ELSE 0 END) AS not_started_count,
                     SUM(CASE WHEN "progress_status" = 'Lagging Behind' THEN 1 ELSE 0 END) AS lagging_behind_count,
                   SUM(CASE WHEN "progress_status" = 'Up to Date' THEN 1 ELSE 0 END) AS up_to_date_count
                    -- ROUND(100.0 * SUM(CASE WHEN "progress_status" = 'Not Started' THEN 1 ELSE 0 END) / COUNT(*), 2) AS not_started_percent,
                    -- ROUND(100.0 * SUM(CASE WHEN "progress_status" = 'Lagging Behind' THEN 1 ELSE 0 END) / COUNT(*), 2) AS lagging_behind_percent,
                    -- ROUND(100.0 * SUM(CASE WHEN "progress_status" = 'Up to Date' THEN 1 ELSE 0 END) / COUNT(*), 2) AS up_to_date_percent
                    -- ROUND(100.0 * SUM(CASE WHEN "progress_status" = 'ahead' THEN 1 ELSE 0 END) / COUNT(*), 2) AS ahead_percent
                FROM FinalResults
                GROUP BY "courseId"
                ORDER BY "courseId";`;
        }

        if(graphType === 'graph6'){
            let a = null;
            dayno = grades;
            if (userType === 'student') {
                grade = ` AND m."classLevel" IN ('grade 1', 'grade 2', 'grade 3', 'grade 4', 'grade 5', 'grade 6', 'grade 7') `;
                cohortCond =  ` AND m.cohort IS NOT NULL AND m.cohort != 'Cohort 0' AND m.cohort != 'Cohort 35' `;
                courseCond = ` "courseId" IN (119, 120, 121, 122, 123, 124, 143) `;
                a = '2025-07-01';
            }
            else{
                grade = ` AND m."classLevel" is null `;
                cohortCond =  ` AND m.cohort IS NOT NULL AND m.cohort != 'Cohort 0' AND m.cohort != 'Cohort 35' `;
                courseCond = ` "courseId" IN (134,135,136) `;
                a = '2025-07-14'
            }
            qry1 = `WITH base_users AS (
            SELECT 
                m.profile_id,
                m."classLevel",
                m.rollout
            FROM wa_users_metadata m
            INNER JOIN wa_profiles p ON m.profile_id = p.profile_id
            WHERE 
                p.profile_type = '${userType}'
                AND m.rollout = 2
                ${grade}
                ${cohortCond}
            ),

            activity_log AS (
            SELECT 
                profile_id,
                "courseId",
                timestamp::date AS activity_date
            FROM wa_user_activity_logs
            WHERE ${courseCond}
            ),

            -- Generate date series from 2025-07-01 to today
            date_series AS (
            SELECT generate_series(
                DATE '${a}',
                CURRENT_DATE,
                '1 day'
            ) AS report_date
            )

            SELECT 
            date(d.report_date) as date,
            
            -- Active users in last 1 day
            (
                SELECT COUNT(DISTINCT a1.profile_id)
                FROM activity_log a1
                INNER JOIN base_users u1 ON a1.profile_id = u1.profile_id
                WHERE a1.activity_date BETWEEN d.report_date - INTERVAL '${dayno}' AND d.report_date
            ) AS count

           

            FROM date_series d
            ORDER BY d.report_date;`
        }

        let [lastLesson1, lastLesson2] = await Promise.all([
            sequelize.query(qry1),
            sequelize.query(qry2)
        ]).then(results => results.map(result => result[0]));

        if (lastLesson2) {
            lastLesson2 = lastLesson2.map(obj => Object.values(obj).map(value => parseInt(value, 10)));
        }

        return {
            lastLesson: lastLesson1,
            lastLesssonTotal: lastLesson2,
        };

    } catch (error) {
        error.fileName = 'statsService.js';
        throw error;
    }
};

const studentBarAnalyticsService = async (courseIds, grades, cohorts, graphType, parameterId, userType) => {
    try {
        // Set default date if not provided
        let grade = grades, courseId = courseIds, qry1 = ``, qry2 = ``, cohort = ``, cohortCond = ``;
        if (cohorts) {
                cohort = ` and m.cohort = '${cohorts}' `;
        }
        else{
            cohort = ` AND m."cohort" IS NOT NULL AND m."cohort" != 'Cohort 0' AND m."cohort" != 'Cohort 35' `;
        }
        let a = 5;
            if(userType === 'student'){
                a = 5;
                grade = ` and m."classLevel" = '${grades}' `;
            }
            else{
                a = 6;
                grade = ` and m."classLevel" is null `;
            }

        console.log('courseIds', courseIds, 'grades', grades, 'cohorts', cohorts, 'graphType', graphType,"parameterId", parameterId, "userType", userType);

        if (graphType === 'graph1') {
                                qry1 = `WITH "TargetGroup" AS (
                        SELECT m.profile_id
                        FROM wa_users_metadata m
                        JOIN wa_profiles p ON m.profile_id = p.profile_id
                        WHERE p."profile_type" = '${userType}' 
                        AND m."rollout" = 2 
                        ${grade}
                        ${cohort}
                    ),

                    "LessonList" AS (
                        SELECT 
                            l."LessonId",
                            l."courseId",
                            l."weekNumber",
                            l."dayNumber",
                            l."SequenceNumber",
                            ROW_NUMBER() OVER (
                                ORDER BY l."weekNumber", l."dayNumber", l."SequenceNumber"
                            ) AS order_num,
                            ((l."weekNumber" - 1) * ${a} + l."dayNumber") AS day
                        FROM "Lesson" l
                        WHERE l."courseId" = ${courseId}
                    ),

                    "LessonCompleted" AS (
                        SELECT 
                            c."profile_id",
                            c."lessonId",
                            c."completionStatus",
                            c."endTime"
                        FROM wa_lessons_completed c
                        JOIN "TargetGroup" t ON t.profile_id = c.profile_id
                        JOIN "LessonList" l ON l."LessonId" = c."lessonId"
                        WHERE c."courseId" = ${courseId}
                    ),

                    "UserLessonStatus" AS (
                        SELECT 
                            c."profile_id",
                            c."lessonId",
                            c."completionStatus",
                            l."order_num",
                            l."day"
                        FROM "LessonCompleted" c
                        JOIN "LessonList" l ON c."lessonId" = l."LessonId"
                    ),
                    activity_status AS (
                    SELECT 
                        profile_id,
                        MAX(timestamp) AS last_message_timestamp
                    FROM 
                        wa_user_activity_logs where "courseId" = ${courseId}
                    GROUP BY profile_id
                    ),
                    "LastUserLesson" AS (
                        SELECT DISTINCT ON (profile_id)
                            profile_id,
                            "lessonId",
                            "completionStatus",
                            order_num,
                            day
                        FROM "UserLessonStatus"
                        ORDER BY profile_id, order_num DESC
                    ),

                    "AdjustedDay" AS (
                        SELECT 
                            l.profile_id,
                            CASE 
                                WHEN l."completionStatus" = 'Completed' THEN l.day
                                WHEN l."completionStatus" = 'Started' THEN COALESCE(prev.day, 0)
                                ELSE 0
                            END AS adjusted_day
                        FROM "LastUserLesson" l
                        LEFT JOIN "LessonList" prev ON prev.order_num = l.order_num - 1
                    )

                    SELECT 
                        m."profile_id",
                        m."phoneNumber",
                        m."name",
                        m."cohort",
                        m."classLevel",
                        m."city",
                        m."amountPaid",
                        m."schoolName",
                        m."customerSource",
                        m."customerChannel",
                        m."rollout",
                        CASE 
                        WHEN b.last_message_timestamp IS NOT NULL 
                            AND DATE_PART('day', CURRENT_DATE - b.last_message_timestamp) >= 3 
                        THEN 'Inactive'
                        ELSE 'Active'
                    END AS status
                    FROM "AdjustedDay" a
                    JOIN wa_users_metadata m ON a.profile_id = m.profile_id
                    LEFT JOIN 
                    activity_status b ON a."profile_id" = b."profile_id"
                    WHERE a.adjusted_day = ${parameterId};
                    `;
                    
            // qry1 = `WITH "TargetGroup" AS (
            //         SELECT 
            //             m."profile_id",
            //             m."phoneNumber",
            //             m."name",
            //             m."cohort",
            //             m."classLevel",
            //             m."city",
            //             m."schoolName",
            //             m."customerSource",
            //             m."customerChannel",
            //             m."rollout"
            //         FROM 
            //             "wa_users_metadata" AS m 
            //         INNER JOIN 
            //             "wa_profiles" p ON m."profile_id" = p."profile_id" 
            //         WHERE 
            //             p."profile_type" = '${userType}' AND 
            //             m."rollout" = 2  
            //             ${grade}
            //             ${cohort}
            //     ),
            //     "user_progress" AS (
            //         SELECT 
            //             p."profile_id",
            //             tg."phoneNumber",
            //             tg."name",
            //             tg."cohort",
            //             tg."classLevel",
            //             tg."city",
            //             tg."schoolName",
            //             tg."customerSource",
            //             tg."customerChannel",
            //             tg."rollout",
            //             p."currentWeek",
            //             p."currentDay",
            //             p."acceptableMessages",
            //             CASE 
            //                 WHEN 'start next lesson' = ANY(p."acceptableMessages") THEN 1 
            //                 ELSE 0 
            //             END AS "lesson_completed_count"
            //         FROM 
            //             "wa_user_progress" AS p
            //         INNER JOIN 
            //             "TargetGroup" AS tg 
            //             ON p."profile_id" = tg."profile_id"
            //         WHERE 
            //             p."currentCourseId" = ${courseId}
            //     ),
            //     "get_dayCount" AS (
            //         SELECT 
            //             "profile_id",
            //             "phoneNumber",
            //             "name",
            //             "cohort",
            //             "classLevel",
            //             "city",
            //             "schoolName",
            //             "customerSource",
            //             "customerChannel",
            //             "rollout",
            //             "currentWeek",
            //             "currentDay",
            //             CASE 
            //                 WHEN ("lesson_completed_count" = 1 OR ("currentWeek" = 4 AND "currentDay" = ${a})) 
            //                     THEN (("currentWeek" - 1) * ${a} + "currentDay") 
            //                 ELSE (("currentWeek" - 1) * ${a} + "currentDay") - 1
            //             END AS "day"
            //         FROM 
            //             "user_progress"
            //         WHERE 
            //             "currentWeek" IS NOT NULL 
            //             AND "currentDay" IS NOT NULL
            //     ),
            //     "activity_status" AS (
            //         SELECT 
            //             profile_id,
            //             MAX(timestamp) AS last_message_timestamp
            //         FROM 
            //             wa_user_activity_logs
            //         GROUP BY profile_id
            //     )
            //     SELECT 
            //         gdc."profile_id",
            //         gdc."phoneNumber",
            //         gdc."name",
            //         gdc."cohort",
            //         gdc."classLevel",
            //         gdc."city",
            //         gdc."schoolName",
            //         gdc."customerSource",
            //         gdc."customerChannel",
            //         gdc."rollout",
            //         -- Use current_date - last activity to calculate diff
            //         CASE 
            //             WHEN a.last_message_timestamp IS NOT NULL 
            //                 AND DATE_PART('day', CURRENT_DATE - a.last_message_timestamp) <= 3 
            //             THEN 'Active'
            //             ELSE 'Inactive'
            //         END AS "status"
            //     FROM 
            //         "get_dayCount" gdc
            //     LEFT JOIN 
            //         "activity_status" a ON gdc.profile_id = a.profile_id
            //     WHERE 
            //         gdc."day" = ${parameterId};
            //     `;
            }

        if (graphType === 'graph2') {

            qry1 = `WITH "TargetGroup" AS (
                    SELECT
                        m.profile_id
                    FROM wa_users_metadata m
                    JOIN wa_profiles p ON p.profile_id = m.profile_id
                    WHERE
                        p."profile_type" = '${userType}'
                        AND m."rollout" = 2 
                        ${grade} 
                        ${cohort}
                ),
                "LessonList" AS (
                    SELECT
                        l."LessonId",
                        l.activity,
                        l."activityAlias",
                        l."weekNumber",
                        l."dayNumber",
                        l."SequenceNumber",
                        ROW_NUMBER() OVER (
                            ORDER BY l."weekNumber", l."dayNumber", l."SequenceNumber"
                        ) AS order_num
                    FROM "Lesson" l
                    WHERE
                        l."courseId" = ${courseId}
                        AND l.status = 'Active'
                ),
                "UserCompletions" AS (
                    SELECT
                        c.profile_id,
                        c."lessonId",
                        c."completionStatus",
                        c."endTime",
                        ll.order_num
                    FROM wa_lessons_completed c
                    JOIN "TargetGroup" tg ON c.profile_id = tg.profile_id
                    JOIN "LessonList" ll ON ll."LessonId" = c."lessonId"
                    WHERE c."courseId" = ${courseId}
                ),
                "LatestPerUser" AS (
                    SELECT DISTINCT ON (profile_id)
                        profile_id,
                        "lessonId",
                        "completionStatus",
                        order_num
                    FROM "UserCompletions"
                    ORDER BY profile_id, order_num DESC
                ),
                activity_status AS (
                    SELECT 
                        profile_id,
                        MAX(timestamp) AS last_message_timestamp
                    FROM 
                        wa_user_activity_logs WHERE "courseId" = ${courseId}
                    GROUP BY profile_id
                ),
                "AdjustedLesson" AS (
                    SELECT
                        lpu.profile_id,
                        CASE
                            WHEN lpu."completionStatus" = 'Completed' THEN lpu.order_num
                            WHEN lpu."completionStatus" = 'Started' AND lpu.order_num > 1 THEN lpu.order_num - 1
                            ELSE 1
                        END AS assigned_order
                    FROM "LatestPerUser" lpu
                )
                SELECT
                    m."profile_id",
                    m."phoneNumber",
                    m."name",
                    m."cohort",
                    m."classLevel",
                    m."city",
                    m."amountPaid",
                    m."schoolName",
                    m."customerSource",
                    m."customerChannel",
                    m."rollout",
                     CASE 
                        WHEN b.last_message_timestamp IS NOT NULL 
                            AND DATE_PART('day', CURRENT_DATE - b.last_message_timestamp) >= 3 
                        THEN 'Inactive'
                        ELSE 'Active'
                    END AS status
                FROM "AdjustedLesson" al
                JOIN "LessonList" ll ON al.assigned_order = ll.order_num
                JOIN wa_users_metadata m ON m.profile_id = al.profile_id
                LEFT JOIN 
                    activity_status b ON al."profile_id" = b."profile_id"
                WHERE ll."LessonId" = ${parameterId}  
                ORDER BY ll."weekNumber", ll."dayNumber", ll."SequenceNumber";
                `;
            // qry1 = `WITH 
            //     TargetGroup AS (
            //         SELECT 
            //             m."profile_id",
            //             m."phoneNumber",
            //             m."name",
            //             m."cohort",
            //             m."classLevel",
            //             m."city",
            //             m."schoolName",
            //             m."customerSource",
            //             m."customerChannel",
            //             m."rollout"
            //         FROM 
            //             "wa_users_metadata" m
            //         INNER JOIN 
            //             "wa_profiles" p ON m."profile_id" = p."profile_id"
            //         WHERE 
            //             p."profile_type" = '${userType}' AND 
            //             m."rollout" = 2 
            //            ${grade}
            //            ${cohort}
            //     ),
                
            //     activity_status AS (
            //         SELECT 
            //             profile_id,
            //             MAX(timestamp) AS last_message_timestamp
            //         FROM 
            //             wa_user_activity_logs
            //         GROUP BY profile_id
            //     ),

            //     LessonWithMaxTimestamp AS (
            //         SELECT 
            //             l."profile_id",
            //             tg."phoneNumber",
            //             tg."name",
            //             tg."cohort",
            //             tg."classLevel",
            //             tg."city",
            //             tg."schoolName",
            //             tg."customerSource",
            //             tg."customerChannel",
            //             tg."rollout",
            //             l."lessonId",
            //             l."endTime",
            //             ROW_NUMBER() OVER (
            //                 PARTITION BY l."profile_id" 
            //                 ORDER BY l."endTime" DESC
            //             ) AS row_num
            //         FROM 
            //             "wa_lessons_completed" l
            //         INNER JOIN 
            //             TargetGroup tg ON l."profile_id" = tg."profile_id"
            //         WHERE 
            //             l."completionStatus" = 'Completed' AND 
            //             l."courseId" = ${courseId}
            //     )

            //     SELECT 
            //         l."profile_id",
            //         l."phoneNumber",
            //         l."name",
            //         l."cohort",
            //         l."classLevel",
            //         l."city",
            //         l."schoolName",
            //         l."customerSource",
            //         l."customerChannel",
            //         l."rollout",
            //         l."lessonId",
            //         CASE 
            //             WHEN a.last_message_timestamp IS NOT NULL 
            //                 AND DATE_PART('day', CURRENT_DATE - a.last_message_timestamp) <= 3 
            //             THEN 'Active'
            //             ELSE 'Inactive'
            //         END AS status
            //     FROM 
            //         LessonWithMaxTimestamp l
            //     LEFT JOIN 
            //         activity_status a ON l."profile_id" = a."profile_id"
            //     WHERE 
            //         l."lessonId" = ${parameterId} AND 
            //         l.row_num = 1;`;
            console.log(qry1);
        }

        // Execute all queries concurrently
        let [lastLesson1] = await Promise.all([
            sequelize.query(qry1),
        ]).then(results => results.map(result => result[0]));


        return {
            users: lastLesson1,
        };
    } catch (error) {
        error.fileName = 'statsService.js';
        throw error;
    }
};

const userAnalyticsStatsService = async (botType) => {
    try {
        let qry0 = ``, classLevel = `` , cohort = ``, courseId = ``, qry1 = `` ;
        cohort = ` AND m."cohort" IS NOT NULL AND m.cohort != 'Cohort 0' and  m.cohort != 'Cohort 35' `;
        if (botType === 'teacher') {
            classLevel = ` AND m."classLevel" is null `;
            courseId = ` "courseId" IN (134, 135, 136) `;
        }
        else {
            classLevel = ` AND m."classLevel" IN ('grade 1', 'grade 2', 'grade 3', 'grade 4', 'grade 5', 'grade 6', 'grade 7') `;
            courseId = ` "courseId" IN (119, 120, 121, 122, 123, 124, 143) `;
        }
        console.log("New Data");
        qry0 = `WITH base_users AS (
            SELECT 
                m.*, 
                p."profile_type"
            FROM "wa_users_metadata" m
            INNER JOIN "wa_profiles" p ON m."profile_id" = p."profile_id"
            WHERE 
                p."profile_type" = '${botType}'
                AND m."rollout" = 2
                ${classLevel}
                ${cohort}
            ),
            total_users AS (
            SELECT COUNT(*) AS total FROM base_users
            ),
            one_message_users AS (
            SELECT COUNT(DISTINCT m."profile_id") AS one_message_users
            FROM base_users m
            INNER JOIN "wa_user_progress" u ON m."profile_id" = u."profile_id"
            WHERE u."acceptableMessages" IS NULL OR u."acceptableMessages" <> ARRAY['start now!']
            ),
            target_lessons AS (
            SELECT "LessonId"
            FROM "Lesson"
            WHERE 
                ${courseId}
                AND "weekNumber" = 1
                AND "dayNumber" = 1
                AND "SequenceNumber" = 1
                AND "status" = 'Active'
            ),
            started_users AS (
            SELECT count(DISTINCT lc."profile_id") AS started_users
            FROM "wa_lessons_completed" lc
            JOIN target_lessons l ON lc."lessonId" = l."LessonId"
            JOIN base_users u ON u."profile_id" = lc."profile_id"
            WHERE lc."completionStatus" = 'Completed'
            ),
            start_rate_of_one_msg_users AS (
            SELECT 
                ROUND((s.started_users::decimal / NULLIF(o.one_message_users, 0)) * 100, 2) AS one_msg_start_rate
            FROM started_users s
            CROSS JOIN one_message_users o
            ),
            revenue AS (
            SELECT 
                SUM(CASE 
                        WHEN "amountPaid" ~ '^[0-9]+(\.[0-9]+)?$' THEN "amountPaid"::numeric 
                        ELSE 0 
                    END)  AS total_revenue
            FROM base_users m
            ),
            b2b_avg_revenue AS (
            SELECT 
                ROUND(
                SUM(CASE 
                        WHEN "amountPaid" ~ '^[0-9]+(\.[0-9]+)?$' THEN "amountPaid"::numeric 
                        ELSE 0 
                    END) 
                / 
                NULLIF(COUNT(CASE 
                                WHEN "amountPaid" ~ '^[0-9]+(\.[0-9]+)?$' THEN 1 
                            END), 0), 
                2) AS b2b_avg
            FROM base_users
            WHERE "customerChannel" = 'B2B'
            ),
            b2c_avg_revenue AS (
            SELECT 
                ROUND(
                SUM(CASE 
                        WHEN "amountPaid" ~ '^[0-9]+(\.[0-9]+)?$' THEN "amountPaid"::numeric 
                        ELSE 0 
                    END) 
                / 
                NULLIF(COUNT(CASE 
                                WHEN "amountPaid" ~ '^[0-9]+(\.[0-9]+)?$' THEN 1 
                            END), 0), 
                2) AS b2c_avg
            FROM base_users
            WHERE "customerChannel" = 'B2C'
            ),

            activity AS (
            SELECT 
                a."profile_id", 
                MAX(a."timestamp") AS last_activity
            FROM "wa_user_activity_logs" a
            GROUP BY a."profile_id"
            ),
            active_users AS (
            SELECT COUNT(*) AS active_user_count
            FROM base_users m
            INNER JOIN activity a ON m."profile_id" = a."profile_id"
            WHERE DATE_PART('day', NOW() - a."last_activity") < 3
            )

            SELECT 
            t.total AS total_registrations,
            o.one_message_users AS one_msg_users,
            ROUND((o.one_message_users::decimal / NULLIF(t.total,0)) * 100, 2)  AS one_msg_pct,
            s.started_users AS started_users,
            ROUND((s.started_users::decimal / NULLIF(t.total,0)) * 100, 2)  AS started_pct,
            sr.one_msg_start_rate || '%' AS one_msg_start_users,
            ROUND((sr.one_msg_start_rate::decimal / NULLIF(o.one_message_users, 0)) * 100, 2)  AS one_msg_start_rate,
            r.total_revenue,
            b2b.b2b_avg AS avg_b2b_revenue,
            b2c.b2c_avg AS avg_b2c_revenue,
            au.active_user_count AS active_users,
            ROUND((au.active_user_count::decimal / NULLIF(s.started_users, 0)) * 100, 2)  AS active_users_pct
            FROM 
            total_users t,
            one_message_users o,
            started_users s,
            start_rate_of_one_msg_users sr,
            revenue r,
            b2b_avg_revenue b2b,
            b2c_avg_revenue b2c,
            active_users au;`;

        // Execute all queries concurrently
        let [userstats] = await Promise.all([
            sequelize.query(qry0),
        ]).then(results => results.map(result => result[0]));

        userstats = userstats.map(obj => Object.values(obj).map(value => value));
        return {
            userstats: userstats,
        };
    } catch (error) {
        error.fileName = 'statsService.js';
        throw error;
    }
};

export default {
    totalContentStatsService,
    dashboardCardsFunnelService,
    lastActiveUsersService,
    studentUserJourneyStatsService,
    studentTrialUserJourneyStatsService,
    studentCourseStatsService,
    clearingCacheService,
    studentAnalyticsService,
    studentBarAnalyticsService,
    userAnalyticsStatsService,
};
