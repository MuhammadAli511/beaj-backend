import { commonValidation, commonIngestion } from "./common.js";
import { getDriveMediaUrl, compressVideo, compressAudio, compressImage } from "../utils/sheetUtils.js";
import multipleChoiceQuestionRepository from "../repositories/multipleChoiceQuestionRepository.js";
import multipleChoiceQuestionAnswerRepository from "../repositories/multipleChoiceQuestionAnswerRepository.js";
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

            // For mcqs activity below are possible combinations
            // - questionText
            // - questionImage
            // - questionVideo
            // - questionText + questionImage
            // - questionText + questionVideo
            if (!activity.questions?.some(q => q.questionText || q.questionImage || q.questionVideo || (q.questionText && q.questionImage) || (q.questionText && q.questionVideo))) {
                allErrors.push(`assessmentMcqs activity from "${activity.startRow}" to "${activity.endRow}" should have atleast one of the following combinations: questionText, questionImage, questionVideo, questionText + questionImage, questionText + questionVideo`);
            }

            // For each question, atmost 3 answers should exist
            // if (!activity.questions?.some(q => q.answers?.length <= 3)) {
            //     allErrors.push(`mcqs activity from "${activity.startRow}" to "${activity.endRow}" should have atmost 3 answers for each question`);
            // }

            for (const question of activity.questions || []) {
                // Must have answers
                if (!question.answers || question.answers.length === 0) {
                    allErrors.push(
                        `assessmentMcqs question in activity from "${activity.startRow}" to "${activity.endRow}" has no answers.`
                    );
                    continue;
                }
                // Ensure exactly 3 options
                if (question.answers.length !== 3) {
                    allErrors.push(
                        `assessmentMcqs question in activity from "${activity.startRow}" to "${activity.endRow}" must have exactly 3 options, found ${question.answers.length}.`
                    );
                }

            }
        }

        return {
            errors: allErrors,
            toCreateCount,
            toUpdateCount,
        };
    } catch (error) {
        return {
            errors: [`mcqs validation error: ${error.message}`],
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

                // Check if mcqs activity question already exists for this lesson using lessonId and questionNumber
                const existingMultipleChoiceQuestions = await multipleChoiceQuestionRepository.getByLessonId(lessonId);

                // Handle video files for questions
                if (activity.questions && activity.questions.length > 0) {
                    for (const question of activity.questions) {
                        if (question.questionVideo || question.questionImage || question.questionText) {
                            hasRequiredProcessing = true;
                            let questionType = null;
                            if (question.questionText && question.questionImage) {
                                questionType = "Text+Image";
                            } else if (question.questionText && question.questionVideo) {
                                questionType = "Text+Video";
                            } else if (question.questionImage) {
                                questionType = "Image";
                            } else if (question.questionVideo) {
                                questionType = "Video";
                            } else if (question.questionText) {
                                questionType = "Text";
                            }
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
                                    // Download image from Google Drive
                                    console.log(`Downloading image from Google Drive: ${question.questionImage}`);
                                    imageFile = await getDriveMediaUrl(question.questionImage);

                                    if (!imageFile) {
                                        errors.push(`Failed to download image from Google Drive for activity from "${activity.startRow}" to "${activity.endRow}"`);
                                        processingSuccessful = false;
                                        continue;
                                    }

                                    // Compress image and upload to Azure
                                    console.log(`Image downloaded successfully for activity from "${activity.startRow}" to "${activity.endRow}"`);
                                    compressedImageUrl = await compressImage(imageFile);
                                }


                                let existingMultipleChoiceQuestion = existingMultipleChoiceQuestions.find(existingQ => existingQ.questionNumber == question.questionNumber);
                                if (existingMultipleChoiceQuestion) {
                                    // Update existing mcqs activity question with new compressed video/image URL
                                    await multipleChoiceQuestionRepository.update(
                                        existingMultipleChoiceQuestion.Id,
                                        null,
                                        compressedImageUrl,
                                        compressedVideoUrl,
                                        questionType,
                                        question.questionText,
                                        question.questionNumber,
                                        lessonId,
                                        "Text"
                                    );
                                } else {
                                    // Create new mcqs activity question with new compressed video/image URL
                                    existingMultipleChoiceQuestion = await multipleChoiceQuestionRepository.create(
                                        null,
                                        compressedImageUrl,
                                        compressedVideoUrl,
                                        questionType,
                                        question.questionText,
                                        question.questionNumber,
                                        lessonId,
                                        "Text"
                                    );
                                }
                                const existingMultipleChoiceQuestionAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(existingMultipleChoiceQuestion.Id);
                                for (const answer of question.answers) {
                                    let compressedCustomFeedbackImageUrl = null, compressedCustomFeedbackAudioUrl = null;
                                    if (answer?.customFeedbackImage) {
                                        let customFeedbackImageDriveUrl = await getDriveMediaUrl(answer?.customFeedbackImage);
                                        if (customFeedbackImageDriveUrl) {
                                            compressedCustomFeedbackImageUrl = await compressImage(customFeedbackImageDriveUrl);
                                        }
                                    }
                                    if (answer?.customFeedbackAudio) {
                                        let customFeedbackAudioDriveUrl = await getDriveMediaUrl(answer?.customFeedbackAudio);
                                        if (customFeedbackAudioDriveUrl) {
                                            compressedCustomFeedbackAudioUrl = await compressAudio(customFeedbackAudioDriveUrl);
                                        }
                                    }
                                    const existingMultipleChoiceQuestionAnswer = existingMultipleChoiceQuestionAnswers.find(existingA => existingA.SequenceNumber == answer.answerNumber && existingA.MultipleChoiceQuestionId == existingMultipleChoiceQuestion.Id);
                                    if (existingMultipleChoiceQuestionAnswer) {
                                        await multipleChoiceQuestionAnswerRepository.update(
                                            existingMultipleChoiceQuestionAnswer.Id,
                                            answer.answerText,
                                            null,
                                            null,
                                            answer.correct,
                                            existingMultipleChoiceQuestion.Id,
                                            answer.answerNumber,
                                            answer.customFeedbackText,
                                            compressedCustomFeedbackImageUrl,
                                            compressedCustomFeedbackAudioUrl
                                        );
                                    }
                                    else {
                                        await multipleChoiceQuestionAnswerRepository.create(
                                            answer.answerText,
                                            null,
                                            null,
                                            answer.correct,
                                            existingMultipleChoiceQuestion.Id,
                                            answer.answerNumber,
                                            answer.customFeedbackText,
                                            compressedCustomFeedbackImageUrl,
                                            compressedCustomFeedbackAudioUrl
                                        );
                                    }
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
            errors: [`mcqs ingestion error: ${error.message}`],
            createdCount: 0,
            updatedCount: 0
        };
    }
};

export default {
    validation,
    ingestion
};
