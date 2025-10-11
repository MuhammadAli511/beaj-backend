import { commonValidation, commonIngestion } from "./common.js";
import { getDriveMediaUrl, compressVideo, compressAudio, compressImage } from "../utils/sheetUtils.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
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

            // For watchAndSpeak activity questionText should exist
            if (!activity.questions?.some(q => q.questionText)) {
                allErrors.push(`watchAndSpeak activity from "${activity.startRow}" to "${activity.endRow}" should have question text`);
            }

            // For watchAndSpeak activity questionVideo should exist
            if (!activity.questions?.some(q => q.questionVideo)) {
                allErrors.push(`watchAndSpeak activity from "${activity.startRow}" to "${activity.endRow}" should have question video`);
            }
        }

        return {
            errors: allErrors,
            toCreateCount,
            toUpdateCount,
        };
    } catch (error) {
        return {
            errors: [`watchAndSpeak validation error: ${error.message}`],
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

                // Check if speak activity question already exists for this lesson using lessonId and questionNumber
                const existingSpeakActivityQuestions = await speakActivityQuestionRepository.getByLessonId(lessonId);

                // Handle video files for questions
                if (activity.questions && activity.questions.length > 0) {
                    for (const question of activity.questions) {
                        if (question.questionVideo && question.questionText) {
                            hasRequiredProcessing = true;
                            try {
                                let videoFile = null, imageFile = null, compressedVideoUrl = null, compressedImageUrl = null;
                                if (question.questionVideo) {
                                    // Download video from Google Drive
                                    console.log(`Downloading video from Google Drive: ${question.questionVideo}`);
                                    videoFile = await getDriveMediaUrl(question.questionVideo);

                                    if (!videoFile) {
                                        errors.push(`Failed to download video from Google Drive for activity from "${activity.startRow}" to "${activity.endRow}"`);
                                        processingSuccessful = false;
                                        continue;
                                    }

                                    // Compress video and upload to Azure
                                    console.log(`Video downloaded successfully for activity from "${activity.startRow}" to "${activity.endRow}"`);
                                    compressedVideoUrl = await compressVideo(videoFile);
                                }

                                if (question.questionImage) {
                                    // Download audio from Google Drive
                                    console.log(`Downloading image from Google Drive: ${question.questionImage}`);
                                    imageFile = await getDriveMediaUrl(question.questionImage);

                                    if (!imageFile) {
                                        errors.push(`Failed to download image from Google Drive for activity from "${activity.startRow}" to "${activity.endRow}"`);
                                        processingSuccessful = false;
                                        continue;
                                    }

                                    // Compress audio and upload to Azure
                                    console.log(`Image downloaded successfully for activity from "${activity.startRow}" to "${activity.endRow}"`);
                                    compressedImageUrl = await compressImage(imageFile);
                                }


                                const existingSpeakActivityQuestion = existingSpeakActivityQuestions.find(existingQ => existingQ.questionNumber == question.questionNumber && existingQ.difficultyLevel == question.difficultyLevel);
                                let compressedCustomFeedbackImageUrl = null, compressedCustomFeedbackAudioUrl = null;
                                if (question?.answers[0]?.customFeedbackImage) {
                                    let customFeedbackImageDriveUrl = await getDriveMediaUrl(question?.answers[0]?.customFeedbackImage);
                                    if (customFeedbackImageDriveUrl) {
                                        compressedCustomFeedbackImageUrl = await compressImage(customFeedbackImageDriveUrl);
                                    }
                                }
                                if (question?.answers[0]?.customFeedbackAudio) {
                                    let customFeedbackAudioDriveUrl = await getDriveMediaUrl(question?.answers[0]?.customFeedbackAudio);
                                    if (customFeedbackAudioDriveUrl) {
                                        compressedCustomFeedbackAudioUrl = await compressAudio(customFeedbackAudioDriveUrl);
                                    }
                                }
                                if (existingSpeakActivityQuestion) {
                                    // Update existing speak activity question with new compressed video URL
                                    await speakActivityQuestionRepository.update(
                                        existingSpeakActivityQuestion.id,
                                        question.questionText,
                                        compressedVideoUrl,
                                        compressedImageUrl,
                                        [question?.answers[0]?.answerText],
                                        lessonId,
                                        question.questionNumber,
                                        question.difficultyLevel,
                                        question?.answers[0]?.customFeedbackText,
                                        compressedCustomFeedbackImageUrl,
                                        compressedCustomFeedbackAudioUrl,
                                    );
                                } else {
                                    // Create new speak activity question with new compressed video URL
                                    await speakActivityQuestionRepository.create(
                                        question.questionText,
                                        compressedVideoUrl,
                                        compressedImageUrl,
                                        [question?.answers[0]?.answerText],
                                        lessonId,
                                        question.questionNumber,
                                        question.difficultyLevel,
                                        question?.answers[0]?.customFeedbackText,
                                        compressedCustomFeedbackImageUrl,
                                        compressedCustomFeedbackAudioUrl,
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
            errors: [`watchAndSpeak ingestion error: ${error.message}`],
            createdCount: 0,
            updatedCount: 0
        };
    }
};

export default {
    validation,
    ingestion
};
