import { commonValidation, commonIngestion } from "./common.js";
import { getDriveMediaUrl } from "../utils/sheetUtils.js";
import documentFileRepository from "../repositories/documentFileRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";


const validation = async (activities) => {
    let allErrors = [];
    let toCreateCount = 0;
    let toUpdateCount = 0;

    try {
        for (const activity of activities) {
            const { errors, toCreate, toUpdate } = await commonValidation(activity);
            allErrors.push(...errors);
            toCreateCount += toCreate;
            toUpdateCount += toUpdate;

            // For watch activity questionVideo should exist (This is only extra validation for watch activity)
            if (!activity.questions?.some(q => q.questionVideo)) {
                allErrors.push(`Watch activity from "${activity.startRow}" to "${activity.endRow}" should have question video`);
            }
        }

        return {
            errors: allErrors,
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
    let createdCount = 0;
    let updatedCount = 0;
    let errors = [];

    try {
        for (const activity of activities) {
            try {
                // Check if lesson exists
                const exists = await lessonRepository.getLessonIdsByCourseWeekDaySeq(activity.courseId, activity.week, activity.day, activity.seq);

                // Create or update the lesson
                const lessonCreation = await commonIngestion(activity, exists);
                const lessonId = lessonCreation.LessonId || lessonCreation.dataValues?.LessonId;

                if (!lessonId) {
                    errors.push(`Failed to get lesson ID for activity from "${activity.startRow}" to "${activity.endRow}"`);
                    continue;
                }

                // Handle video files for questions
                if (activity.questions && activity.questions.length > 0) {
                    for (const question of activity.questions) {
                        if (question.questionVideo) {
                            try {
                                // Check if document file already exists for this lesson
                                const existingDocFiles = await documentFileRepository.getByLessonId(lessonId);
                                const existingVideoFile = existingDocFiles.find(doc => doc.video === question.questionVideo);

                                if (existingVideoFile) {
                                    // Update existing document file
                                    await documentFileRepository.update(
                                        existingVideoFile.id,
                                        lessonId,
                                        "", // language hardcoded as empty string
                                        null, // image
                                        question.questionVideo, // video
                                        null, // audio
                                        "video" // mediaType
                                    );
                                } else {
                                    // Create new document file
                                    await documentFileRepository.create(
                                        lessonId,
                                        "", // language hardcoded as empty string
                                        null, // image
                                        question.questionVideo, // video
                                        null, // audio
                                        "video" // mediaType
                                    );
                                }
                            } catch (docError) {
                                errors.push(`Failed to handle video file for activity from "${activity.startRow}" to "${activity.endRow}": ${docError.message}`);
                            }
                        }
                    }
                }

                // Count the operation
                if (exists) {
                    updatedCount++;
                } else {
                    createdCount++;
                }

            } catch (activityError) {
                errors.push(`Failed to process activity from "${activity.startRow}" to "${activity.endRow}": ${activityError.message}`);
            }
        }

        return {
            errors,
            createdCount,
            updatedCount
        };

    } catch (error) {
        return {
            errors: [`Watch ingestion error: ${error.message}`],
            createdCount: 0,
            updatedCount: 0
        };
    }
};

export default {
    validation,
    ingestion
};
