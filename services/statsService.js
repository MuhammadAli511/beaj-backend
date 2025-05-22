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


        const qry2 = `WITH TargetGroup AS (
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
                            "courseId" = 117 and "status" = 'Active'
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
                            AND l."courseId" = 117
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

        const qry3 = `WITH TargetGroup AS (
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
            "courseId" = 113 and "status" = 'Active'
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
            AND l."courseId" = 113
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

        const qry4 = `WITH lesson_data AS (
                    SELECT 
                        p."profile_id",
                        CASE WHEN l."lessonId" = 2396 THEN 1 ELSE 0 END AS attempted_117,
                        CASE WHEN l."lessonId" = 2392 THEN 1 ELSE 0 END AS attempted_113
                    FROM "wa_profiles" p
                    inner JOIN "wa_lessons_completed" l ON p."profile_id" = l."profile_id"
                   -- inner join "wa_users_metadata" m on p."profile_id" = m."profile_id"
                    WHERE 
                        (l."lessonId" = 2396 OR l."lessonId" = 2392)
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
                    COUNT(*) FILTER (WHERE attempted_117 = 0 AND attempted_113 = 1) AS course_113
                    -- COUNT(*) FILTER (WHERE attempted_117 = 1 AND attempted_113 = 1) AS both_courses
                FROM aggregated;
                `;

        const qry5 = `select "persona", count(*) from "wa_user_progress" u left join "wa_profiles" p 
                          on u."profile_id" = p."profile_id" where p."profile_type" = 'student' and 
                          (u."currentCourseId" = 117 or u."currentCourseId" = 113)
                          group by "persona";
                `;

        const qry6 = `WITH lesson_data AS (
                    SELECT 
                        p."profile_id",
                        CASE WHEN l."currentCourseId" = 117 THEN 1 ELSE 0 END AS attempted_117,
                        CASE WHEN l."currentCourseId" = 113 THEN 1 ELSE 0 END AS attempted_113
                    FROM "wa_profiles" p
                    inner JOIN "wa_user_progress" l ON p."profile_id" = l."profile_id"
                    inner join "wa_users_metadata" m on p."profile_id" = m."profile_id"
                    WHERE 
                        (l."currentCourseId" = 117 OR l."currentCourseId" = 113)
                        AND p."profile_type" = 'student'
                         AND m."userRegistrationComplete" IS NOT NULL
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
                    COUNT(*) FILTER (WHERE attempted_117 = 0 AND attempted_113 = 1) AS course_113
                    -- COUNT(*) FILTER (WHERE attempted_117 = 1 AND attempted_113 = 1) AS both_courses
                FROM aggregated;
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

const studentUserJourneyStatsService = async (date) => {
    try {
        // Set default date if not provided
        const filterDate = date || '2025-04-26 12:00:00';

        // Query 1: Get user data with joins and trial starts information
        const userDataQuery = `
            WITH ordered_logs AS (
              SELECT
                profile_id,
                id,
                timestamp,
                "messageDirection",
                "messageContent",
                "courseId",
                LEAD("courseId") OVER (
                  PARTITION BY profile_id
                  ORDER BY timestamp, id
                ) AS next_course_id
              FROM wa_user_activity_logs
              -- Add filter here to reduce the dataset early
              WHERE profile_id IN (
                SELECT p.profile_id
                FROM wa_users_metadata m
                INNER JOIN wa_profiles p ON m."profile_id" = p.profile_id
                WHERE m."userClickedLink" > TIMESTAMP '${filterDate}'
                AND p.profile_type = 'student'
              )
            ),
            
            user_trial_counts AS (
              SELECT
                profile_id,
                SUM(CASE WHEN next_course_id = 113 THEN 1 ELSE 0 END) AS started_113,
                SUM(CASE WHEN next_course_id = 117 THEN 1 ELSE 0 END) AS started_117
              FROM ordered_logs
              WHERE
                "messageDirection" = 'inbound'
                AND "messageContent"[1] = 'start free trial'
              GROUP BY profile_id
            ),
            
            first_messages AS (
              SELECT DISTINCT ON (profile_id)
                profile_id,
                "messageContent"[1] AS first_message_content
              FROM wa_user_activity_logs
              WHERE profile_id IN (
                SELECT p.profile_id
                FROM wa_users_metadata m
                INNER JOIN wa_profiles p ON m."profile_id" = p.profile_id
                WHERE m."userClickedLink" > TIMESTAMP '${filterDate}'
                AND p.profile_type = 'student'
              )
              ORDER BY profile_id, timestamp ASC, id ASC
            ),
            
            last_messages AS (
              SELECT DISTINCT ON (profile_id)
                profile_id,
                "messageContent" AS last_message_content,
                timestamp AS last_message_timestamp
              FROM wa_user_activity_logs
              WHERE profile_id IN (
                SELECT p.profile_id
                FROM wa_users_metadata m
                INNER JOIN wa_profiles p ON m."profile_id" = p.profile_id
                WHERE m."userClickedLink" > TIMESTAMP '${filterDate}'
                AND p.profile_type = 'student'
              )
              ORDER BY profile_id, timestamp DESC, id DESC
            ),
            
            filtered_users AS (
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
                m."profile_id"
              FROM wa_users_metadata m
              WHERE m."userClickedLink" > TIMESTAMP '${filterDate}'
            )
            
            SELECT
              fu."phoneNumber",
              fu.name,
              fu.city,
              fu."userClickedLink",
              fu."freeDemoStarted",
              fu."freeDemoEnded",
              fu."userRegistrationComplete",
              fu."schoolName",
              fu."targetGroup", 
              fu.cohort,
              p.profile_id, 
              p.phone_number, 
              p.profile_type, 
              p.created_at,
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
              COALESCE(utc.started_113, 0) AS level3_trial_starts,
              COALESCE(utc.started_117, 0) AS level1_trial_starts,
              CASE
                WHEN LOWER(fm.first_message_content) = LOWER('Start Free Trial now!') THEN 'Community'
                WHEN LOWER(fm.first_message_content) = LOWER('Start my Free Trial now!') THEN 'Social Media ads'
                ELSE 'Unknown'
              END AS source,
              lm.last_message_content,
              lm.last_message_timestamp
            FROM filtered_users fu
            INNER JOIN wa_profiles p
              ON fu."profile_id" = p.profile_id
            INNER JOIN wa_user_progress wup
              ON p.profile_id = wup.profile_id
            LEFT JOIN user_trial_counts utc
              ON utc.profile_id = fu."profile_id"
            LEFT JOIN first_messages fm
              ON fm.profile_id = p.profile_id
            LEFT JOIN last_messages lm
              ON lm.profile_id = p.profile_id
            WHERE p.profile_type = 'student'
            ORDER BY fu."phoneNumber"
        `;

        // Query 2: Get statistics for each stage of the journey - adding filter subquery to improve performance
        const statsQuery = `
            WITH filtered_users AS (
                SELECT m."profile_id"
                FROM wa_users_metadata m
                INNER JOIN wa_profiles p ON m."profile_id" = p.profile_id
                WHERE m."userClickedLink" > TIMESTAMP '${filterDate}'
                AND p.profile_type = 'student'
            )
            
            SELECT 'Clicked Link' AS stage, COUNT(*) as count
            FROM wa_users_metadata m
            INNER JOIN wa_profiles p ON m."profile_id" = p.profile_id
            INNER JOIN wa_user_progress wup ON p."profile_id" = wup."profile_id"
            WHERE m."profile_id" IN (SELECT "profile_id" FROM filtered_users)
            AND m."userClickedLink" IS NOT NULL

            UNION ALL

            SELECT 'Demo Started' AS stage, COUNT(*) as count
            FROM wa_users_metadata m
            INNER JOIN wa_profiles p ON m."profile_id" = p.profile_id
            INNER JOIN wa_user_progress wup ON p."profile_id" = wup."profile_id"
            WHERE m."profile_id" IN (SELECT "profile_id" FROM filtered_users)
            AND m."freeDemoStarted" IS NOT NULL

            UNION ALL

            SELECT 'Demo Ended' AS stage, COUNT(*) as count
            FROM wa_users_metadata m
            INNER JOIN wa_profiles p ON m."profile_id" = p.profile_id
            INNER JOIN wa_user_progress wup ON p."profile_id" = wup."profile_id"
            WHERE m."profile_id" IN (SELECT "profile_id" FROM filtered_users)
            AND m."freeDemoEnded" IS NOT NULL

            UNION ALL

            SELECT 'Registration Completed' AS stage, COUNT(*) as count
            FROM wa_users_metadata m
            INNER JOIN wa_profiles p ON m."profile_id" = p.profile_id
            INNER JOIN wa_user_progress wup ON p."profile_id" = wup."profile_id"
            WHERE m."profile_id" IN (SELECT "profile_id" FROM filtered_users)
            AND m."userRegistrationComplete" IS NOT NULL
        `;

        // Graph query - fixed duplicate condition and made date consistent with filterDate
        const graphQuery = `
            WITH daily_stats AS (
                SELECT 
                    DATE(m."userClickedLink") AS date,
                    COUNT(DISTINCT m."phoneNumber") AS clicked_count,
                    COUNT(DISTINCT CASE WHEN m."userRegistrationComplete" IS NOT NULL THEN m."phoneNumber" END) AS registered_count
                FROM wa_users_metadata m
                INNER JOIN wa_profiles p ON m."profile_id" = p.profile_id
                WHERE 
                    m."userClickedLink" >= TIMESTAMP '${filterDate}'
                    AND p.profile_type = 'student'
                GROUP BY DATE(m."userClickedLink")
                ORDER BY date
            )
            
            SELECT 
                date,
                clicked_count,
                registered_count,
                CASE 
                    WHEN clicked_count > 0 THEN ROUND((registered_count::numeric / clicked_count) * 100, 2)
                    ELSE 0
                END AS conversion_percentage
            FROM daily_stats;
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


export default {
    totalContentStatsService,
    dashboardCardsFunnelService,
    lastActiveUsersService,
    studentUserJourneyStatsService,
    studentTrialUserJourneyStatsService
};
