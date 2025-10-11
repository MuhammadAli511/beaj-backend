import { commonValidation, commonIngestion } from "./common.js";
import { getDriveMediaUrl, compressVideo } from "../utils/sheetUtils.js";
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

            // For video activity questionVideo should exist (This is only extra validation for video activity)
            if (!activity.questions?.some(q => q.questionVideo)) {
                allErrors.push(`video activity from "${activity.startRow}" to "${activity.endRow}" should have question video`);
            }
        }

        return {
            errors: allErrors,
            toCreateCount,
            toUpdateCount,
        };
    } catch (error) {
        return {
            errors: [`video validation error: ${error.message}`],
            toCreateCount: 0,
            toUpdateCount: 0,
        };
    }
};


const ingestion = async (activities) => {
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

                // Track if processing is successful
                let processingSuccessful = true;
                let hasRequiredProcessing = false;

                // Handle video files for questions
                if (activity.questions && activity.questions.length > 0) {
                    for (const question of activity.questions) {
                        if (question.questionVideo) {
                            hasRequiredProcessing = true;
                            try {
                                // Download video from Google Drive
                                console.log(`Downloading video from Google Drive: ${question.questionVideo}`);
                                const videoFile = await getDriveMediaUrl(question.questionVideo);

                                if (!videoFile) {
                                    errors.push(`Failed to download video from Google Drive for activity from "${activity.startRow}" to "${activity.endRow}"`);
                                    processingSuccessful = false;
                                    continue;
                                }

                                // Compress video and upload to Azure
                                console.log(`Video downloaded successfully for activity from "${activity.startRow}" to "${activity.endRow}"`);
                                const compressedVideoUrl = await compressVideo(videoFile, question.questionVideoSize);

                                // Check if document file already exists for this lesson
                                const existingDocFiles = await documentFileRepository.getByLessonId(lessonId);
                                const existingVideoFile = existingDocFiles.find(doc => doc.video && doc.mediaType === "video");

                                if (existingVideoFile) {
                                    // Update existing document file with new compressed video URL
                                    await documentFileRepository.update(
                                        existingVideoFile.id,
                                        lessonId,
                                        null, // language hardcoded as empty string
                                        null, // image
                                        compressedVideoUrl, // compressed video URL from Azure
                                        null, // audio
                                        "video" // mediaType
                                    );
                                } else {
                                    // Create new document file with compressed video URL
                                    await documentFileRepository.create(
                                        lessonId,
                                        null, // language hardcoded as empty string
                                        null, // image
                                        compressedVideoUrl, // compressed video URL from Azure
                                        null, // audio
                                        "video" // mediaType
                                    );
                                }
                            } catch (docError) {
                                console.error(`Processing error for lesson ${lessonId}:`, docError);
                                errors.push(`Failed to process file for activity from "${activity.startRow}" to "${activity.endRow}": ${docError.message}`);
                                processingSuccessful = false;
                            }
                        }
                    }
                }

                // Only count the operation as successful if all processing was successful
                // If there is no required processing, consider it successful (nothing to process)
                if (processingSuccessful || !hasRequiredProcessing) {
                    if (exists) {
                        updatedCount++;
                    } else {
                        createdCount++;
                    }
                    console.log(`Successfully processed activity from "${activity.startRow}" to "${activity.endRow}"`);
                } else {
                    console.log(`Skipped counting activity from "${activity.startRow}" to "${activity.endRow}" due to processing failure`);
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
            errors: [`video ingestion error: ${error.message}`],
            createdCount: 0,
            updatedCount: 0
        };
    }
};

export default {
    validation,
    ingestion
};
