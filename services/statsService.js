import courseRepository from '../repositories/courseRepository.js';
import courseCategoryRepository from '../repositories/courseCategoryRepository.js';
import lessonRepository from '../repositories/lessonRepository.js';
import waUsersMetadataRepository from '../repositories/waUsersMetadataRepository.js';
import waUserActivityLogsRepository from '../repositories/waUserActivityLogsRepository.js';
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
        // TOTAL USERS query
        const totalUsersQuery = `
            SELECT COUNT(*) as total_users
            FROM wa_users_metadata 
            WHERE "cohort" NOT IN ('', 'Cohort 0') 
                AND cohort IS NOT NULL 
                AND "rollout" = 2 
                AND "classLevel" IS NOT NULL;
        `;

        // ONE MESSAGE query
        const oneMessageQuery = `
            SELECT COUNT(*) as one_message_count
            FROM wa_users_metadata wum 
            JOIN wa_user_progress wup 
                ON wum."profile_id" = wup."profile_id" 
            WHERE wum."cohort" NOT IN ('', 'Cohort 0') 
                AND wum."cohort" IS NOT NULL 
                AND wum."rollout" = 2 
                AND wum."classLevel" IS NOT NULL 
                AND NOT (wup."acceptableMessages" @> ARRAY['start now!']::text[]);
        `;

        // PRE ASSESSMENT query
        const preAssessmentQuery = `
            WITH LessonBoundaries AS ( 
                SELECT 
                    "courseId", 
                    "weekNumber", 
                    "dayNumber", 
                    MIN("SequenceNumber") as min_sequence, 
                    MAX("SequenceNumber") as max_sequence 
                FROM "Lesson" 
                WHERE "dayNumber" IS NOT NULL 
                    AND "weekNumber" IS NOT NULL 
                    AND "SequenceNumber" IS NOT NULL 
                    AND "courseId" IN (139, 140, 141, 142) 
                GROUP BY "courseId", "weekNumber", "dayNumber" 
            ), 
            LessonGroups AS ( 
                SELECT 
                    CONCAT( 
                        'Week ', l."weekNumber", 
                        ' Day ', l."dayNumber", 
                        CASE 
                            WHEN l."SequenceNumber" = lb.min_sequence THEN ' Start' 
                            WHEN l."SequenceNumber" = lb.max_sequence THEN ' Complete' 
                        END 
                    ) as heading, 
                    STRING_AGG(l."LessonId"::text, ', ' ORDER BY l."courseId") as lesson_ids, 
                    ARRAY_AGG(l."LessonId" ORDER BY l."courseId") as lesson_id_array, 
                    l."weekNumber", 
                    l."dayNumber", 
                    CASE 
                        WHEN l."SequenceNumber" = lb.min_sequence THEN ' Start' 
                        WHEN l."SequenceNumber" = lb.max_sequence THEN ' Complete' 
                    END as lesson_type 
                FROM "Lesson" l 
                INNER JOIN LessonBoundaries lb 
                    ON l."courseId" = lb."courseId" 
                    AND l."weekNumber" = lb."weekNumber" 
                    AND l."dayNumber" = lb."dayNumber" 
                    AND (l."SequenceNumber" = lb.min_sequence OR l."SequenceNumber" = lb.max_sequence) 
                WHERE l."courseId" IN (139, 140, 141, 142) 
                GROUP BY 
                    l."weekNumber", 
                    l."dayNumber", 
                    CASE 
                        WHEN l."SequenceNumber" = lb.min_sequence THEN ' Start' 
                        WHEN l."SequenceNumber" = lb.max_sequence THEN ' Complete' 
                    END 
            ) 
            SELECT 
                lg.heading, 
                COUNT(DISTINCT wlc.id) as completion_count 
            FROM LessonGroups lg 
            LEFT JOIN wa_lessons_completed wlc 
                ON wlc."lessonId" = ANY(lg.lesson_id_array) 
                AND wlc."completionStatus" = 'Completed' 
            GROUP BY 
                lg.heading, 
                lg.lesson_ids, 
                lg."weekNumber", 
                lg."dayNumber", 
                lg.lesson_type 
            ORDER BY 
                MIN(lg."weekNumber"), 
                MIN(lg."dayNumber"), 
                CASE 
                    WHEN lg.lesson_type = ' Start' THEN 1 
                    ELSE 2 
                END;
        `;

        // ACTUAL COURSE query
        const actualCourseQuery = `
            WITH LessonBoundaries AS ( 
                SELECT 
                    "courseId", 
                    "weekNumber", 
                    "dayNumber", 
                    MIN("SequenceNumber") as min_sequence, 
                    MAX("SequenceNumber") as max_sequence 
                FROM "Lesson" 
                WHERE "dayNumber" IS NOT NULL 
                    AND "weekNumber" IS NOT NULL 
                    AND "SequenceNumber" IS NOT NULL 
                    AND "courseId" IN (119, 120, 121, 122, 123, 124, 143) 
                GROUP BY "courseId", "weekNumber", "dayNumber" 
            ), 
            LessonGroups AS ( 
                SELECT 
                    CONCAT( 
                        'Week ', l."weekNumber", 
                        ' Day ', l."dayNumber", 
                        CASE 
                            WHEN l."SequenceNumber" = lb.min_sequence THEN ' Start' 
                            WHEN l."SequenceNumber" = lb.max_sequence THEN ' Complete' 
                        END 
                    ) as heading, 
                    STRING_AGG(l."LessonId"::text, ', ' ORDER BY l."courseId") as lesson_ids, 
                    ARRAY_AGG(l."LessonId" ORDER BY l."courseId") as lesson_id_array, 
                    l."weekNumber", 
                    l."dayNumber", 
                    CASE 
                        WHEN l."SequenceNumber" = lb.min_sequence THEN ' Start' 
                        WHEN l."SequenceNumber" = lb.max_sequence THEN ' Complete' 
                    END as lesson_type 
                FROM "Lesson" l 
                INNER JOIN LessonBoundaries lb 
                    ON l."courseId" = lb."courseId" 
                    AND l."weekNumber" = lb."weekNumber" 
                    AND l."dayNumber" = lb."dayNumber" 
                    AND (l."SequenceNumber" = lb.min_sequence OR l."SequenceNumber" = lb.max_sequence) 
                WHERE l."courseId" IN (119, 120, 121, 122, 123, 124, 143) 
                GROUP BY 
                    l."weekNumber", 
                    l."dayNumber", 
                    CASE 
                        WHEN l."SequenceNumber" = lb.min_sequence THEN ' Start' 
                        WHEN l."SequenceNumber" = lb.max_sequence THEN ' Complete' 
                    END 
            ) 
            SELECT 
                lg.heading, 
                COUNT(DISTINCT wlc.id) as completion_count 
            FROM LessonGroups lg 
            LEFT JOIN wa_lessons_completed wlc 
                ON wlc."lessonId" = ANY(lg.lesson_id_array) 
                AND wlc."completionStatus" = 'Completed' 
            GROUP BY 
                lg.heading, 
                lg.lesson_ids, 
                lg."weekNumber", 
                lg."dayNumber", 
                lg.lesson_type 
            ORDER BY 
                MIN(lg."weekNumber"), 
                MIN(lg."dayNumber"), 
                CASE 
                    WHEN lg.lesson_type = ' Start' THEN 1 
                    ELSE 2 
                END;
        `;

        // Execute all queries concurrently using Promise.all
        const [totalUsersResult, oneMessageResult, preAssessmentResult, actualCourseResult] = await Promise.all([
            sequelize.query(totalUsersQuery),
            sequelize.query(oneMessageQuery),
            sequelize.query(preAssessmentQuery),
            sequelize.query(actualCourseQuery)
        ]);

        // Extract the results from the query responses
        const totalUsers = totalUsersResult[0];
        const oneMessage = oneMessageResult[0];
        const preAssessment = preAssessmentResult[0];
        const actualCourse = actualCourseResult[0];

        return {
            totalUsers,
            oneMessage,
            preAssessment,
            actualCourse
        };
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
        let grade = grades, courseId = courseIds, qry1 = ``, qry2 = ``, cohort = ``, cohortCond = ``;
        if (cohorts) {
            cohort = ` and m.cohort = '${cohorts}' AND m.cohort != 'Cohort 0' `

        }
        else {
            cohort = ` AND m.cohort IS NOT NULL AND m.cohort != 'Cohort 0' `;
        }

        console.log('courseIds', courseIds, 'grades', grades, 'cohorts', cohorts, 'graphType', graphType);

        if (graphType === 'graph1') {
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


        if (graphType === 'graph2') {
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

        if (graphType === 'graph3') {

            if (grade === null) {
                grade = `'grade 1', 'grade 2', 'grade 3', 'grade 4', 'grade 5', 'grade 6', 'grade 7'`;
                cohortCond = ` AND m.cohort IS NOT NULL AND m.cohort != 'Cohort 0' `;
            }
            else if (grade !== null && cohorts === null) {
                grade = `'${grade}'`;
                cohortCond = ` AND m.cohort IS NOT NULL AND m.cohort != 'Cohort 0' `;
            }
            else if (cohort !== null) {
                grade = `'${grade}'`;
                cohortCond = ` AND m.cohort = '${cohorts}' `;
            }

            qry1 = `WITH "TargetGroup" AS (
                        SELECT 
                            m.profile_id
                        FROM 
                            wa_users_metadata m
                        INNER JOIN 
                            wa_profiles p ON m."profile_id" = p."profile_id"
                        WHERE 
                            p.profile_type = 'student'
                            AND m.rollout = 2
                            AND m."classLevel" IN (${grade})
                            ${cohortCond}
                    ),

                    "LatestLessonsPerDay" AS (
                        SELECT DISTINCT ON (l."courseId", l."weekNumber", l."dayNumber")
                            l."courseId",
                            l."weekNumber",
                            l."dayNumber",
                            l."LessonId"
                        FROM 
                            "Lesson" l
                        WHERE 
                            l."status" = 'Active'
                            AND l."courseId" IN (119, 120, 121, 122, 123, 124, 143)
                        ORDER BY 
                            l."courseId", l."weekNumber", l."dayNumber", l."SequenceNumber" DESC
                    ),

                    "FilteredCompletions" AS (
                        SELECT 
                            c."profile_id",
                            c."lessonId",
                            l."courseId",
                            l."weekNumber",
                            l."dayNumber",
                            c."endTime"
                        FROM 
                            "wa_lessons_completed" c
                        INNER JOIN 
                            "TargetGroup" t ON t."profile_id" = c."profile_id"
                        INNER JOIN 
                            "Lesson" l ON l."LessonId" = c."lessonId"
                        INNER JOIN 
                            "LatestLessonsPerDay" latest 
                                ON latest."LessonId" = l."LessonId"
                                AND latest."courseId" = l."courseId"
                                AND latest."weekNumber" = l."weekNumber"
                                AND latest."dayNumber" = l."dayNumber"
                        WHERE 
                            c."endTime" IS NOT NULL
                    ),

                    "LessonCountsByDate" AS (
                        SELECT 
                            DATE(c."endTime") AS completion_date,
                            COUNT(DISTINCT c."profile_id" || '-' || c."courseId" || '-' || c."lessonId") AS lesson_completion_count
                        FROM 
                            "FilteredCompletions" c
                        GROUP BY 
                            DATE(c."endTime")
                    ),

                    -- Only count weekdays (Monday to Friday)
                    "WeekdayLessonDates" AS (
                        SELECT 
                            completion_date
                        FROM 
                            "LessonCountsByDate"
                        WHERE 
                            EXTRACT(DOW FROM completion_date) NOT IN (0, 6) -- 0 = Sunday, 6 = Saturday
                    ),

                    "StartedUsers" AS (
                        SELECT 
                            COUNT(DISTINCT c."profile_id") AS started_user_count
                        FROM 
                            "wa_lessons_completed" c
                        INNER JOIN 
                            "TargetGroup" t ON t."profile_id" = c."profile_id"
                        WHERE 
                            c."courseId" IN (119, 120, 121, 122, 123, 124, 143)
                    )

                    SELECT 
                        lc.*,
                        su.started_user_count,
                        su.started_user_count * (SELECT COUNT(*) FROM "WeekdayLessonDates") AS expected_total_lessons,
                        (SELECT SUM(lesson_completion_count) FROM "LessonCountsByDate") AS actual_total_lessons
                    FROM 
                        "LessonCountsByDate" lc
                    CROSS JOIN 
                        "StartedUsers" su
                    ORDER BY 
                        lc.completion_date;`

            // qry1 = `WITH "TargetGroup" AS (
            //     SELECT 
            //         m.profile_id
            //     FROM 
            //         wa_users_metadata m
            //     INNER JOIN 
            //         wa_profiles p ON m."profile_id" = p."profile_id"
            //     WHERE 
            //         p.profile_type = 'student'
            //         AND m.rollout = 2
            //         AND m."classLevel" IN (${grade})
            //         ${cohortCond}
            // ),

            // "LatestLessonsPerDay" AS (
            //     SELECT DISTINCT ON (l."courseId", l."weekNumber", l."dayNumber")
            //         l."courseId",
            //         l."weekNumber",
            //         l."dayNumber",
            //         l."LessonId"
            //     FROM 
            //         "Lesson" l
            //     WHERE 
            //         l."status" = 'Active'
            //         AND l."courseId" IN (119, 120, 121, 122, 123, 124, 143)
            //     ORDER BY 
            //         l."courseId", l."weekNumber", l."dayNumber", l."SequenceNumber" DESC
            // ),

            // "FilteredCompletions" AS (
            //     SELECT 
            //         c."profile_id",
            //         c."lessonId",
            //         l."courseId",
            //         l."weekNumber",
            //         l."dayNumber",
            //         c."endTime"
            //     FROM 
            //         "wa_lessons_completed" c
            //     INNER JOIN 
            //         "TargetGroup" t ON t."profile_id" = c."profile_id"
            //     INNER JOIN 
            //         "Lesson" l ON l."LessonId" = c."lessonId"
            //     INNER JOIN 
            //         "LatestLessonsPerDay" latest 
            //             ON latest."LessonId" = l."LessonId"
            //             AND latest."courseId" = l."courseId"
            //             AND latest."weekNumber" = l."weekNumber"
            //             AND latest."dayNumber" = l."dayNumber"
            //     WHERE 
            //         c."endTime" IS NOT NULL
            // ),

            // "LessonCountsByDate" AS (
            //     SELECT 
            //         DATE(c."endTime") AS completion_date,
            //         COUNT(DISTINCT c."profile_id" || '-' || c."courseId" || '-' || c."lessonId") AS lesson_completion_count
            //     FROM 
            //         "FilteredCompletions" c
            //     GROUP BY 
            //         DATE(c."endTime")
            // ),

            // "StartedUsers" AS (
            //     SELECT 
            //         COUNT(DISTINCT c."profile_id") AS started_user_count
            //     FROM 
            //         "wa_lessons_completed" c
            //     INNER JOIN 
            //         "TargetGroup" t ON t."profile_id" = c."profile_id"
            //     WHERE 
            //         c."courseId" IN (119, 120, 121, 122, 123, 124, 143)
            // )

            // SELECT 
            //     lc.*,
            //     su.started_user_count,
            //     su.started_user_count * (SELECT COUNT(*) FROM "LessonCountsByDate") AS expected_total_lessons,
            //     (SELECT SUM(lesson_completion_count) FROM "LessonCountsByDate") AS actual_total_lessons
            // FROM 
            //     "LessonCountsByDate" lc
            // CROSS JOIN 
            //     "StartedUsers" su
            // ORDER BY 
            //     lc.completion_date;`;


            // console.log('qry1', qry1);
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
                    p.profile_type = 'student'
                    AND m.rollout = 2
                    AND m."classLevel" = '${grade}'
                    AND m."cohort" IS NOT NULL
                    AND m."cohort" != 'Cohort 0'
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
                        p."profile_type" = 'student'
                        AND m."rollout" = 2
                        AND m."classLevel" = '${grade}'
                        AND l."courseId" = ${courseId}
                        ${cohortCond}
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
                        p."profile_type" = 'student'
                        AND m."rollout" = 2
                        AND m."classLevel" = '${grade}'
                        ${cohortCond}
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


            // console.log('qry1', qry1);
        }


        // Execute all queries concurrently
        let [lastLesson1, lastLesson2] = await Promise.all([
            sequelize.query(qry1),
            sequelize.query(qry2)
        ]).then(results => results.map(result => result[0]));

        if (lastLesson2) {
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

const studentBarAnalyticsService = async (courseIds, grades, cohorts, graphType, parameterId) => {
    try {
        // Set default date if not provided
        let grade = grades, courseId = courseIds, qry1 = ``, qry2 = ``, cohort = ``, cohortCond = ``;
        if (cohorts) {
            cohort = ` and m.cohort = '${cohorts}' AND m.cohort != 'Cohort 0' `

        }
        else {
            cohort = ` AND m.cohort IS NOT NULL AND m.cohort != 'Cohort 0' `;
        }

        console.log('courseIds', courseIds, 'grades', grades, 'cohorts', cohorts, 'graphType', graphType);

        if (graphType === 'graph1') {

            qry1 = `WITH "TargetGroup" AS (
                    SELECT 
                        m."profile_id",
                        m."phoneNumber",
                        m."name",
                        m."cohort",
                        m."classLevel",
                        m."city",
                        m."schoolName",
                        m."customerSource",
                        m."customerChannel",
                        m."rollout"
                    FROM 
                        "wa_users_metadata" AS m
                    INNER JOIN 
                        "wa_profiles" p ON m."profile_id" = p."profile_id"
                    WHERE 
                        p."profile_type" = 'student' AND
                        m."rollout" = 2 AND
                        m."classLevel" = '${grade}' 
                        ${cohort}
                ),
                "user_progress" AS (
                    SELECT 
                        p."profile_id",
                        tg."phoneNumber",
                        tg."name",
                        tg."cohort",
                        tg."classLevel",
                        tg."city",
                        tg."schoolName",
                        tg."customerSource",
                        tg."customerChannel",
                        tg."rollout",
                        p."currentWeek",
                        p."currentDay",
                        p."acceptableMessages",
                        CASE 
                            WHEN 'start next lesson' = ANY(p."acceptableMessages") THEN 1 
                            ELSE 0 
                        END AS "lesson_completed_count"
                    FROM 
                        "wa_user_progress" AS p
                    INNER JOIN 
                        "TargetGroup" AS tg 
                        ON p."profile_id" = tg."profile_id"
                    WHERE 
                        p."currentCourseId" = ${courseId}
                ),
                "get_dayCount" AS (
                    SELECT 
                        "profile_id",
                        "phoneNumber",
                        "name",
                        "cohort",
                        "classLevel",
                        "city",
                        "schoolName",
                        "customerSource",
                        "customerChannel",
                        "rollout",
                        "currentWeek",
                        "currentDay",
                        CASE 
                            WHEN ("lesson_completed_count" = 1) 
                                THEN (("currentWeek" - 1) * 5 + "currentDay") 
                            ELSE (("currentWeek" - 1) * 5 + "currentDay") - 1
                        END AS "day"
                    FROM 
                        "user_progress"
                    WHERE 
                        "currentWeek" IS NOT NULL 
                        AND "currentDay" IS NOT NULL
                ),
                "activity_status" AS (
                    SELECT 
                        profile_id,
                        MAX(timestamp) AS last_message_timestamp
                    FROM 
                        wa_user_activity_logs
                    GROUP BY profile_id
                )
                SELECT 
                    gdc."profile_id",
                    gdc."phoneNumber",
                    gdc."name",
                    gdc."cohort",
                    gdc."classLevel",
                    gdc."city",
                    gdc."schoolName",
                    gdc."customerSource",
                    gdc."customerChannel",
                    gdc."rollout",
                    -- Use current_date - last activity to calculate diff
                    CASE 
                        WHEN a.last_message_timestamp IS NOT NULL 
                            AND DATE_PART('day', CURRENT_DATE - a.last_message_timestamp) < 3 
                        THEN 'Active'
                        ELSE 'Inactive'
                    END AS "status"
                FROM 
                    "get_dayCount" gdc
                LEFT JOIN 
                    "activity_status" a ON gdc.profile_id = a.profile_id
                WHERE 
                    gdc."day" = ${parameterId};
                `;
        }


        if (graphType === 'graph2') {

            qry1 = `WITH 
                TargetGroup AS (
                    SELECT 
                        m."profile_id",
                        m."phoneNumber",
                        m."name",
                        m."cohort",
                        m."classLevel",
                        m."city",
                        m."schoolName",
                        m."customerSource",
                        m."customerChannel",
                        m."rollout"
                    FROM 
                        "wa_users_metadata" m
                    INNER JOIN 
                        "wa_profiles" p ON m."profile_id" = p."profile_id"
                    WHERE 
                        p."profile_type" = 'student' AND
                        m."rollout" = 2 AND
                        m."classLevel" = '${grade}' 
                        ${cohort}
                ),
                
                activity_status AS (
                    SELECT 
                        profile_id,
                        MAX(timestamp) AS last_message_timestamp
                    FROM 
                        wa_user_activity_logs
                    GROUP BY profile_id
                ),

                LessonWithMaxTimestamp AS (
                    SELECT 
                        l."profile_id",
                        tg."phoneNumber",
                        tg."name",
                        tg."cohort",
                        tg."classLevel",
                        tg."city",
                        tg."schoolName",
                        tg."customerSource",
                        tg."customerChannel",
                        tg."rollout",
                        l."lessonId",
                        l."endTime",
                        ROW_NUMBER() OVER (
                            PARTITION BY l."profile_id" 
                            ORDER BY l."endTime" DESC
                        ) AS row_num
                    FROM 
                        "wa_lessons_completed" l
                    INNER JOIN 
                        TargetGroup tg ON l."profile_id" = tg."profile_id"
                    WHERE 
                        l."completionStatus" = 'Completed' AND 
                        l."courseId" = ${courseId}
                )

                SELECT 
                    l."profile_id",
                    l."phoneNumber",
                    l."name",
                    l."cohort",
                    l."classLevel",
                    l."city",
                    l."schoolName",
                    l."customerSource",
                    l."customerChannel",
                    l."rollout",
                    l."lessonId",
                    CASE 
                        WHEN a.last_message_timestamp IS NOT NULL 
                            AND DATE_PART('day', CURRENT_DATE - a.last_message_timestamp) < 3 
                        THEN 'Active'
                        ELSE 'Inactive'
                    END AS status
                FROM 
                    LessonWithMaxTimestamp l
                LEFT JOIN 
                    activity_status a ON l."profile_id" = a."profile_id"
                WHERE 
                    l."lessonId" = ${parameterId} AND 
                    l.row_num = 1;`;

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

export default {
    totalContentStatsService,
    lastActiveUsersService,
    studentUserJourneyStatsService,
    studentTrialUserJourneyStatsService,
    studentCourseStatsService,
    clearingCacheService,
    studentAnalyticsService,
    studentBarAnalyticsService,
};
