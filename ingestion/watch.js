import commonValidation from "./common.js";
import lessonRepository from "../repositories/lessonRepository.js";


const validation = async (activities) => {
    const errors = [];
    let toCreateCount = 0;
    let toUpdateCount = 0;

    try {
        for (const activity of activities) {
            const { errors, toCreate, toUpdate } = await commonValidation(activity);
            errors.push(...errors);
            toCreateCount += toCreate;
            toUpdateCount += toUpdate;

            // For watch activity questionVideo should exist (This is only extra validation for watch activity)
            if (!activity.questions?.some(q => q.questionVideo)) {
                errors.push(`Watch activity "${activity.alias}" should have question video`);
            }
        }

        return {
            errors,
            toCreateCount,
            toUpdateCount,
        };
    } catch (error) {
        return {
            errors: [`Watch validation error: ${error.message}`],
            toCreateCount: 0,
            toUpdateCount: 0,
        };
    }
};


const ingestion = async (activities, courseId) => {
    try {
        let createdCount = 0;
        let updatedCount = 0;
        const errors = [];
        const results = [];

        for (const activity of activities) {
            // Add your ingestion logic here for watch activities
            // For example:
            // - Create/update activity in database
            // - Process questions and media content
            // - Handle video/audio links

            console.log(`Processing watch activity: ${activity.alias} for course: ${courseId}`);

            try {
                // Example processing logic - replace with your actual business logic
                // Check if activity exists in database
                const exists = !!(await lessonRepository.getLessonIdsByCourseWeekDaySeq(activity.courseId, activity.week, activity.day, activity.seq));

                if (exists) {
                    // Update existing activity
                    updatedCount++;
                    results.push({
                        activityId: activity.seq,
                        alias: activity.alias,
                        action: 'updated',
                        questionsProcessed: activity.questions?.length || 0,
                        videoContent: activity.questions?.filter(q => q.questionVideo || q.questionAudio).length || 0
                    });
                } else {
                    // Create new activity
                    createdCount++;
                    results.push({
                        activityId: activity.seq,
                        alias: activity.alias,
                        action: 'created',
                        questionsProcessed: activity.questions?.length || 0,
                        videoContent: activity.questions?.filter(q => q.questionVideo || q.questionAudio).length || 0
                    });
                }

                // Process each question's media content
                for (const question of activity.questions || []) {
                    if (question.questionVideo) {
                        console.log(`Processing video link: ${question.questionVideo}`);
                        // Add video processing logic here
                    }
                    if (question.questionAudio) {
                        console.log(`Processing audio link: ${question.questionAudio}`);
                        // Add audio processing logic here
                    }
                }

            } catch (activityError) {
                errors.push(`Error processing watch activity "${activity.alias}": ${activityError.message}`);
            }
        }

        return {
            success: true,
            message: `Successfully processed ${createdCount + updatedCount} watch activities`,
            createdCount,
            updatedCount,
            errors,
            results
        };
    } catch (error) {
        return {
            success: false,
            message: `Watch ingestion error: ${error.message}`,
            createdCount: 0,
            updatedCount: 0,
            errors: [error.message]
        };
    }
};

export default {
    validation,
    ingestion
};
