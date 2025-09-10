import { commonValidation, commonIngestion } from "./common.js";
import { getDriveMediaUrl, compressImage } from "../utils/sheetUtils.js";
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

            // For image activity questionImage should exist (This is only extra validation for image activity)
            if (!activity.questions?.some(q => q.questionImage)) {
                allErrors.push(`image activity from "${activity.startRow}" to "${activity.endRow}" should have question image`);
            }
        }

        return {
            errors: allErrors,
            toCreateCount,
            toUpdateCount,
        };
    } catch (error) {
        return {
            errors: [`image validation error: ${error.message}`],
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

                // Handle image files for questions
                if (activity.questions && activity.questions.length > 0) {
                    for (const question of activity.questions) {
                        if (question.questionImage) {
                            hasRequiredProcessing = true;
                            try {
                                // Download image from Google Drive
                                console.log(`Downloading image from Google Drive: ${question.questionImage}`);
                                const imageFile = await getDriveMediaUrl(question.questionImage);

                                if (!imageFile) {
                                    errors.push(`Failed to download image from Google Drive for activity from "${activity.startRow}" to "${activity.endRow}"`);
                                    processingSuccessful = false;
                                    continue;
                                }

                                // Compress image and upload to Azure
                                console.log(`Image downloaded successfully for activity from "${activity.startRow}" to "${activity.endRow}"`);
                                const compressedImageUrl = await compressImage(imageFile);

                                // Check if document file already exists for this lesson
                                const existingDocFiles = await documentFileRepository.getByLessonId(lessonId);
                                const existingImageFile = existingDocFiles.find(doc => doc.image && doc.mediaType === "image");

                                if (existingImageFile) {
                                    // Update existing document file with new compressed image URL
                                    await documentFileRepository.update(
                                        existingImageFile.id,
                                        lessonId,
                                        null, // language hardcoded as empty string
                                        compressedImageUrl, // image
                                        null, // video
                                        null, // audio
                                        "image" // mediaType
                                    );
                                } else {
                                    // Create new document file with compressed image URL
                                    await documentFileRepository.create(
                                        lessonId,
                                        null, // language hardcoded as empty string
                                        compressedImageUrl, // image
                                        null, // video
                                        null, // audio
                                        "image" // mediaType
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
            errors: [`image ingestion error: ${error.message}`],
            createdCount: 0,
            updatedCount: 0
        };
    }
};

export default {
    validation,
    ingestion
};
