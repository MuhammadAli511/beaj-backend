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
            -- Define course groupings
            course_groups AS (
                SELECT course_id, 'Main Course' as group_name
                FROM (VALUES (119),(120),(121),(122),(123),(124),(143)) AS t(course_id)
                
                UNION ALL
                
                SELECT course_id, 'Pre-Assessment' as group_name  
                FROM (VALUES (139),(140),(141),(142)) AS t(course_id)
                
                UNION ALL
                
                SELECT course_id, 'Post-Assessment' as group_name
                FROM (VALUES (144),(145),(146),(147)) AS t(course_id)
            ),

            -- Find start lessons (min sequence) for each course/week/day
            start_lessons AS (
                SELECT 
                    l."courseId",
                    l."weekNumber", 
                    l."dayNumber",
                    MIN(l."SequenceNumber") as min_sequence
                FROM "Lesson" l
                JOIN course_groups cg ON l."courseId" = cg.course_id
                WHERE l."weekNumber" IS NOT NULL 
                  AND l."dayNumber" IS NOT NULL
                GROUP BY l."courseId", l."weekNumber", l."dayNumber"
            ),

            -- Find end lessons (max sequence) for each course/week/day  
            end_lessons AS (
                SELECT 
                    l."courseId",
                    l."weekNumber",
                    l."dayNumber", 
                    MAX(l."SequenceNumber") as max_sequence
                FROM "Lesson" l
                JOIN course_groups cg ON l."courseId" = cg.course_id
                WHERE l."weekNumber" IS NOT NULL 
                  AND l."dayNumber" IS NOT NULL
                GROUP BY l."courseId", l."weekNumber", l."dayNumber"
            ),

            -- Map sequences back to lesson IDs
            start_lesson_ids AS (
                SELECT 
                    sl."courseId",
                    sl."weekNumber",
                    sl."dayNumber",
                    l."LessonId" as start_lesson_id
                FROM start_lessons sl
                JOIN "Lesson" l ON sl."courseId" = l."courseId" 
                               AND sl."weekNumber" = l."weekNumber"
                               AND sl."dayNumber" = l."dayNumber" 
                               AND sl.min_sequence = l."SequenceNumber"
            ),

            end_lesson_ids AS (
                SELECT 
                    el."courseId",
                    el."weekNumber", 
                    el."dayNumber",
                    l."LessonId" as end_lesson_id
                FROM end_lessons el
                JOIN "Lesson" l ON el."courseId" = l."courseId"
                               AND el."weekNumber" = l."weekNumber" 
                               AND el."dayNumber" = l."dayNumber"
                               AND el.max_sequence = l."SequenceNumber"
            ),

            -- Combine start and end lesson mappings
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

            -- Handle Level 4 special case: add Level 4's day 2 to day 3 for assessments
            adjusted_lesson_mapping AS (
                -- Keep all original lesson mappings
                SELECT
                    group_name,
                    "weekNumber",
                    "dayNumber",
                    start_lesson_id,
                    end_lesson_id
                FROM lesson_mapping

                UNION ALL

                -- Add Level 4's day 2 data to day 3 for assessments
                SELECT
                    group_name,
                    "weekNumber",
                    3 as "dayNumber",  -- Add Level 4's day 2 to day 3
                    start_lesson_id,
                    end_lesson_id
                FROM lesson_mapping
                WHERE group_name IN ('Pre-Assessment', 'Post-Assessment')
                  AND "dayNumber" = 2
                  AND "courseId" IN (142, 147)  -- Level 4 courses only
            ),

            -- Aggregate metrics by group/week/day
            aggregated_metrics AS (
                SELECT
                    group_name,
                    "weekNumber",
                    "dayNumber",
                    ARRAY_AGG(DISTINCT start_lesson_id) as start_lesson_ids,
                    ARRAY_AGG(DISTINCT end_lesson_id) as end_lesson_ids
                FROM adjusted_lesson_mapping
                GROUP BY group_name, "weekNumber", "dayNumber"
            )

            -- Generate the final report
            SELECT description, count
            FROM (
                SELECT 'Total Users' as description, COUNT(*) as count, 1 as sort_order
                FROM wa_users_metadata u
                WHERE u."classLevel" IS NOT NULL
                  AND u.cohort IS NOT NULL
                  AND u.rollout = 2

                UNION ALL

                SELECT 'Started Users (One Message)' as description, COUNT(*) as count, 2 as sort_order
                FROM wa_users_metadata u
                JOIN wa_user_progress p ON u.profile_id = p.profile_id
                WHERE u."classLevel" IS NOT NULL
                  AND u.cohort IS NOT NULL
                  AND u.rollout = 2
                  AND (p."acceptableMessages" IS NULL OR p."acceptableMessages" <> ARRAY['start now!'])

                UNION ALL

                -- Pre-Assessment Started metrics
                SELECT
                    'Pre-Assessment Started Week ' || am."weekNumber" || ' Day ' || am."dayNumber" as description,
                    COUNT(DISTINCT lc.profile_id) as count,
                    (3 + (am."weekNumber" - 1) * 10 + (am."dayNumber" - 1) * 2) as sort_order
                FROM aggregated_metrics am
                JOIN wa_lessons_completed lc ON lc."lessonId" = ANY(am.start_lesson_ids)
                WHERE am.group_name = 'Pre-Assessment'
                GROUP BY am.group_name, am."weekNumber", am."dayNumber", am.start_lesson_ids
                HAVING COUNT(DISTINCT lc.profile_id) >= 10

                UNION ALL

                -- Pre-Assessment Completed metrics
                SELECT
                    'Pre-Assessment Completed Week ' || am."weekNumber" || ' Day ' || am."dayNumber" as description,
                    COUNT(DISTINCT lc.profile_id) as count,
                    (4 + (am."weekNumber" - 1) * 10 + (am."dayNumber" - 1) * 2) as sort_order
                FROM aggregated_metrics am
                JOIN wa_lessons_completed lc ON lc."lessonId" = ANY(am.end_lesson_ids)
                                             AND lc."completionStatus" = 'Completed'
                WHERE am.group_name = 'Pre-Assessment'
                GROUP BY am.group_name, am."weekNumber", am."dayNumber", am.end_lesson_ids
                HAVING COUNT(DISTINCT lc.profile_id) >= 10

                UNION ALL

                -- Main Course Started metrics
                SELECT
                    'Main Course Started Week ' || am."weekNumber" || ' Day ' || am."dayNumber" as description,
                    COUNT(DISTINCT lc.profile_id) as count,
                    (100 + (am."weekNumber" - 1) * 10 + (am."dayNumber" - 1) * 2) as sort_order
                FROM aggregated_metrics am
                JOIN wa_lessons_completed lc ON lc."lessonId" = ANY(am.start_lesson_ids)
                WHERE am.group_name = 'Main Course'
                GROUP BY am.group_name, am."weekNumber", am."dayNumber", am.start_lesson_ids
                HAVING COUNT(DISTINCT lc.profile_id) >= 10

                UNION ALL

                -- Main Course Completed metrics
                SELECT
                    'Main Course Completed Week ' || am."weekNumber" || ' Day ' || am."dayNumber" as description,
                    COUNT(DISTINCT lc.profile_id) as count,
                    (101 + (am."weekNumber" - 1) * 10 + (am."dayNumber" - 1) * 2) as sort_order
                FROM aggregated_metrics am
                JOIN wa_lessons_completed lc ON lc."lessonId" = ANY(am.end_lesson_ids)
                                             AND lc."completionStatus" = 'Completed'
                WHERE am.group_name = 'Main Course'
                GROUP BY am.group_name, am."weekNumber", am."dayNumber", am.end_lesson_ids
                HAVING COUNT(DISTINCT lc.profile_id) >= 10
            ) final_results
            ORDER BY sort_order
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

const studentAnalyticsService = async (courseIds, grades, cohorts, graphType) => {
    try {
        // Set default date if not provided
        let grade = grades, courseId = courseIds, qry1 = ``, qry2 = ``, cohort = ``;
        if(cohorts){
            cohort = `and m.cohort = '${cohorts}'`
        }

        // console.log('courseIds', courseIds, 'grades', grades, 'cohorts', cohorts, 'graphType', graphType);

        if(graphType === 'graph1'){
           qry1 = `WITH "TargetGroup" AS (
                SELECT 
                    "m"."profile_id"
                FROM 
                    "wa_users_metadata" AS "m"
                inner join "wa_profiles" p on m."profile_id" = p."profile_id"
                WHERE 
                    p."profile_type" = 'student' and
                            m."rollout" = 2 and
                            m."classLevel" = '${grade}' 
                            ${cohort}
            ),
            "user_progress" AS (
                SELECT 
                    "p"."profile_id",
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
                    "p"."profile_id" = "t"."profile_id" 
                    AND "p"."currentCourseId" = ${courseId}
            ),
            get_dayCount as (
            SELECT 
                "currentWeek",
                "currentDay",
                "lesson_completed_count",
                -- (("currentWeek" - 1) * 6 + "currentDay") as day
                CASE 
                    WHEN ("lesson_completed_count" = 1) 
                    THEN (("currentWeek" - 1) * 5 + "currentDay") 
                    ELSE (("currentWeek" - 1) * 5 + "currentDay" ) - 1
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

            qry2 = `WITH TargetGroup AS (
                    SELECT 
                        m."profile_id"
                    FROM 
                        "wa_users_metadata" m
                    inner join "wa_profiles" p on m."profile_id" = p."profile_id"
                    WHERE 
                        p."profile_type" = 'student' and
                                m."rollout" = 2 and
                                m."classLevel" = '${grade}' 
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

        
        if(graphType === 'graph2'){
             qry1 = `WITH TargetGroup AS (
                SELECT 
                    m."profile_id"
                FROM 
                    "wa_users_metadata" m
                    inner join "wa_profiles" p on m."profile_id" = p."profile_id"
                WHERE 
                    p."profile_type" = 'student' and
                            m."rollout" = 2 and
                            m."classLevel" = '${grade}' 
                           ${cohort}
            ),
            get_lessonIds AS (
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
                    "courseId" = ${courseId} and "status" = 'Active'
            ),
            LessonWithMaxTimestamp AS (
                SELECT 
                    l."profile_id",
                    l."lessonId",
                    l."endTime",
                    ROW_NUMBER() OVER (
                        PARTITION BY l."profile_id" 
                        ORDER BY l."endTime" DESC
                    ) AS row_num
                FROM 
                    "wa_lessons_completed" l
                INNER JOIN 
                    TargetGroup tg 
                ON 
                    l."profile_id" = tg."profile_id"
                WHERE 
                    l."completionStatus" = 'Completed'
                    AND l."courseId" = ${courseId}
            ),
            LessonCompletionCounts AS (
                SELECT 
                    lw."lessonId",
                    COUNT(lw."profile_id") AS "completionCount"
                FROM 
                    LessonWithMaxTimestamp lw
                WHERE 
                    lw.row_num = 1
                GROUP BY 
                    lw."lessonId"
            )
            SELECT 
                g."LessonId",
               -- CONCAT(g."LessonId", ' (', g."activity", ')') AS "LessonId",
                COALESCE(lcc."completionCount", null) AS "total_students_completed"
            FROM 
                get_lessonIds g
            LEFT JOIN 
                LessonCompletionCounts lcc 
            ON 
                g."LessonId" = lcc."lessonId"
            ORDER BY 
                g."weekNumber",g."dayNumber",g."SequenceNumber";`


                 qry2 = `WITH TargetGroup AS (
                    SELECT 
                        m."profile_id"
                    FROM 
                        "wa_users_metadata" m
                    inner join "wa_profiles" p on m."profile_id" = p."profile_id"
                    WHERE 
                        p."profile_type" = 'student' and
                                m."rollout" = 2 and
                                m."classLevel" = '${grade}' 
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

       


        // Execute all queries concurrently
         let [lastLesson1, lastLesson2] = await Promise.all([
            sequelize.query(qry1),
            sequelize.query(qry2)
        ]).then(results => results.map(result => result[0]));

        if(lastLesson2){
            lastLesson2 = lastLesson2.map(obj => Object.values(obj).map(value => parseInt(value, 10)));
        }

        return {
            lastLesson: lastLesson1,
            lastLesssonTotal: lastLesson2
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
    studentAnalyticsService
};
