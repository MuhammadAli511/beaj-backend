import lessonRepository from "../repositories/lessonRepository.js";
import documentFileRepository from "../repositories/documentFileRepository.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import multipleChoiceQuestionRepository from "../repositories/multipleChoiceQuestionRepository.js";
import multipleChoiceQuestionAnswerRepository from "../repositories/multipleChoiceQuestionAnswerRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waPurchasedCoursesRepository from "../repositories/waPurchasedCoursesRepository.js";
import waUserMetaRepository from "../repositories/waUsersMetadataRepository.js";
import prodSequelize from "../config/prodDB.js";
import courseRepository from "../repositories/courseRepository.js";
import azure_blob from "../utils/azureBlobStorage.js";
import { removeUserTillCourse } from "../utils/chatbotUtils.js";
import waUserActivityLogsRepository from "../repositories/waUserActivityLogsRepository.js";
import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";

const createLessonService = async (lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber, status, textInstruction, audioInstruction) => {
    try {
        const audioInstructionUrl = audioInstruction ? await azure_blob.uploadToBlobStorage(audioInstruction) : null;
        const lesson = await lessonRepository.create(lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber, status, textInstruction, audioInstructionUrl);
        return lesson;
    } catch (error) {
        error.fileName = 'lessonService.js';
        throw error;
    }
};

const getAllLessonService = async () => {
    try {
        const lessons = await lessonRepository.getAll();
        return lessons;
    } catch (error) {
        error.fileName = 'lessonService.js';
        throw error;
    }
};

const getLessonByIdService = async (id) => {
    try {
        const lesson = await lessonRepository.getById(id);
        if (lesson.activity == 'listenAndSpeak' || lesson.activity == 'watchAndSpeak' || lesson.activity == 'watchAndAudio' ||
            lesson.activity == 'watchAndImage' || lesson.activity == 'conversationalQuestionsBot' || lesson.activity == 'conversationalMonologueBot' ||
            lesson.activity == 'conversationalAgencyBot' || lesson.activity == 'speakingPractice' || lesson.activity == 'feedbackAudio' ||
            lesson.activity == 'assessmentWatchAndSpeak'
        ) {
            const speakActivityQuestionFiles = await speakActivityQuestionRepository.getByLessonId(lesson.LessonId);
            lesson.dataValues.speakActivityQuestionFiles = speakActivityQuestionFiles;
        } else if (lesson.activity == 'mcqs' || lesson.activity === 'feedbackMcqs' || lesson.activity == 'assessmentMcqs') {
            const multipleChoiceQuestions = await multipleChoiceQuestionRepository.getByLessonId(lesson.LessonId);
            const multipleChoiceQuestionAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(multipleChoiceQuestions.map(question => question.Id));
            lesson.dataValues.multipleChoiceQuestions = multipleChoiceQuestions.map(question => {
                return {
                    ...question,
                    multipleChoiceQuestionAnswers: multipleChoiceQuestionAnswers.filter(answer => answer.MultipleChoiceQuestionId === question.Id)
                };
            });
        } else {
            const documentFiles = await documentFileRepository.getByLessonId(lesson.LessonId);
            lesson.dataValues.documentFiles = documentFiles;
        }
        return lesson;
    } catch (error) {
        error.fileName = 'lessonService.js';
        throw error;
    }
};

const updateLessonService = async (id, lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber, status, textInstruction, audioInstruction) => {
    try {
        let audioInstructionUrl = null;
        if (audioInstruction && typeof audioInstruction === 'object') {
            audioInstructionUrl = await azure_blob.uploadToBlobStorage(audioInstruction);
        } else if (typeof audioInstruction === 'string' && audioInstruction.trim() !== '') {
            audioInstructionUrl = audioInstruction;
        }
        const lesson = await lessonRepository.update(id, lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber, status, textInstruction, audioInstructionUrl);
        return lesson;
    } catch (error) {
        error.fileName = 'lessonService.js';
        throw error;
    }
};

const deleteLessonService = async (id) => {
    try {
        const lesson = await lessonRepository.getById(id);
        const activity = lesson.activity;
        await lessonRepository.deleteLesson(id);

        if (activity == 'listenAndSpeak' || activity == 'watchAndSpeak' || activity == 'watchAndAudio' ||
            activity == 'watchAndImage' || activity == 'conversationalQuestionsBot' || activity == 'conversationalMonologueBot' ||
            activity == 'conversationalAgencyBot' || activity == 'speakingPractice' || activity == 'feedbackAudio' ||
            activity == 'assessmentWatchAndSpeak'
        ) {
            await speakActivityQuestionRepository.deleteByLessonId(id);
        } else if (activity == 'mcqs' || activity === 'feedbackMcqs' || activity == 'assessmentMcqs') {
            const multipleChoiceQuestions = await multipleChoiceQuestionRepository.getByLessonIds(id);
            await multipleChoiceQuestionAnswerRepository.deleteByQuestionId(multipleChoiceQuestions.map(question => question.Id));
            await multipleChoiceQuestionRepository.deleteByLessonId(id);
        } else {
            await documentFileRepository.deleteByLessonId(id);
        }
    } catch (error) {
        error.fileName = 'lessonService.js';
        throw error;
    }
};

const getLessonsByActivity = async (course, activity) => {
    try {
        const lessons = await lessonRepository.getByCourseActivity(course, activity);
        const lessonIds = lessons.map(lesson => lesson.LessonId);

        if (activity == 'listenAndSpeak' || activity == 'watchAndSpeak' || activity == 'watchAndAudio' || activity == 'watchAndImage' ||
            activity == 'conversationalQuestionsBot' || activity == 'conversationalMonologueBot' || activity == 'conversationalAgencyBot' ||
            activity == 'speakingPractice' || activity == 'feedbackAudio' || activity == 'assessmentWatchAndSpeak'
        ) {
            const speakActivityQuestionFiles = await speakActivityQuestionRepository.getByLessonIds(lessonIds);
            const lessonsWithFiles = lessons.map(lesson => {
                return {
                    ...lesson.dataValues,
                    speakActivityQuestionFiles: speakActivityQuestionFiles.filter(file => file.lessonId === lesson.LessonId)
                };
            });
            return lessonsWithFiles;
        } else if (activity == 'mcqs' || activity === 'feedbackMcqs' || activity == 'assessmentMcqs') {
            const multipleChoiceQuestions = await multipleChoiceQuestionRepository.getByLessonIds(lessonIds);
            const multipleChoiceQuestionAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(multipleChoiceQuestions.map(question => question.Id));
            const lessonsWithQuestions = lessons.map(lesson => {
                return {
                    ...lesson.dataValues,
                    multipleChoiceQuestions: multipleChoiceQuestions.filter(question => question.LessonId === lesson.LessonId).map(question => {
                        return {
                            ...question,
                            multipleChoiceQuestionAnswers: multipleChoiceQuestionAnswers.filter(answer => answer.MultipleChoiceQuestionId === question.Id)
                        };
                    })
                };
            });
            return lessonsWithQuestions;
        }
        else {
            const documentFiles = await documentFileRepository.getByLessonIds(lessonIds);
            const lessonsWithFiles = lessons.map(lesson => {
                return {
                    ...lesson.dataValues,
                    documentFiles: documentFiles.filter(file => file.lessonId === lesson.LessonId)
                };
            });
            return lessonsWithFiles;
        }
    } catch (error) {
        error.fileName = 'lessonService.js';
        throw error;
    }
}

const migrateLessonService = async (lessonId, courseId) => {
    let transaction;
    try {
        const lesson = await lessonRepository.getById(lessonId);

        transaction = await prodSequelize.transaction();

        try {

            const [newLesson] = await prodSequelize.query(
                `INSERT INTO "Lesson" 
                    ("lessonType", "dayNumber", "activity", "activityAlias", "weekNumber", "text", 
                    "courseId", "SequenceNumber", "status", "textInstruction", "audioInstructionUrl", "audioInstructionMediaId") 
                    VALUES (:lessonType, :dayNumber, :activity, :activityAlias, :weekNumber, :text, 
                    :courseId, :SequenceNumber, :status, :textInstruction, :audioInstructionUrl, :audioInstructionMediaId) 
                    RETURNING *`,
                {
                    replacements: {
                        lessonType: lesson.lessonType,
                        dayNumber: lesson.dayNumber,
                        activity: lesson.activity,
                        activityAlias: lesson.activityAlias,
                        weekNumber: lesson.weekNumber,
                        text: lesson.text,
                        courseId: courseId,
                        SequenceNumber: lesson.SequenceNumber,
                        status: lesson.status,
                        textInstruction: lesson.textInstruction,
                        audioInstructionUrl: lesson.audioInstructionUrl,
                        audioInstructionMediaId: lesson.audioInstructionMediaId
                    },
                    type: prodSequelize.QueryTypes.INSERT,
                    transaction,
                }
            );

            if (['listenAndSpeak', 'watchAndSpeak', 'watchAndAudio', 'watchAndImage', 'conversationalQuestionsBot', 'conversationalMonologueBot', 'conversationalAgencyBot', 'speakingPractice', 'feedbackAudio', 'assessmentWatchAndSpeak'].includes(lesson.activity)) {
                const speakActivityQuestionFiles = await speakActivityQuestionRepository.getByLessonId(lesson.LessonId);
                await Promise.all(speakActivityQuestionFiles.map(file => {
                    const answerArray = Array.isArray(file.answer) ? file.answer : [file.answer];
                    const formattedAnswer = `{${answerArray.map(answer => `"${answer}"`).join(',')}}`;
                    return prodSequelize.query(
                        `INSERT INTO "speakActivityQuestions" 
                                ("question", "mediaFile", "mediaFileMediaId", "mediaFileSecond", "mediaFileSecondMediaId", 
                                "answer", "lessonId", "questionNumber", "customFeedbackText", "customFeedbackImage", 
                                "customFeedbackAudio", "customFeedbackImageMediaId", "customFeedbackAudioMediaId", "difficultyLevel") 
                                VALUES (:question, :mediaFile, :mediaFileMediaId, :mediaFileSecond, :mediaFileSecondMediaId, 
                                :answer, :lessonId, :questionNumber, :customFeedbackText, :customFeedbackImage, 
                                :customFeedbackAudio, :customFeedbackImageMediaId, :customFeedbackAudioMediaId, :difficultyLevel)`,
                        {
                            replacements: {
                                question: file.question,
                                mediaFile: file.mediaFile,
                                mediaFileMediaId: file.mediaFileMediaId || null,
                                mediaFileSecond: file.mediaFileSecond,
                                mediaFileSecondMediaId: file.mediaFileSecondMediaId || null,
                                answer: formattedAnswer,
                                lessonId: newLesson[0].LessonId,
                                questionNumber: file.questionNumber,
                                customFeedbackText: file.customFeedbackText || null,
                                customFeedbackImage: file.customFeedbackImage || null,
                                customFeedbackAudio: file.customFeedbackAudio || null,
                                customFeedbackImageMediaId: file.customFeedbackImageMediaId || null,
                                customFeedbackAudioMediaId: file.customFeedbackAudioMediaId || null,
                                difficultyLevel: file.difficultyLevel || null
                            },
                            type: prodSequelize.QueryTypes.INSERT,
                            transaction
                        }
                    );
                }));

            } else if (['mcqs', 'feedbackMcqs', 'assessmentMcqs'].includes(lesson.activity)) {
                const multipleChoiceQuestions = await multipleChoiceQuestionRepository.getByLessonId(lesson.LessonId);

                await Promise.all(multipleChoiceQuestions.map(async question => {
                    const [newQuestion] = await prodSequelize.query(
                        `INSERT INTO "MultipleChoiceQuesions" 
                            ("QuestionType", "QuestionText", "QuestionImageUrl", "QuestionImageMediaId", 
                            "QuestionAudioUrl", "QuestionAudioMediaId", "QuestionVideoUrl", "QuestionVideoMediaId",
                            "QuestionNumber", "LessonId", "OptionsType")
                            VALUES (:QuestionType, :QuestionText, :QuestionImageUrl, :QuestionImageMediaId, 
                            :QuestionAudioUrl, :QuestionAudioMediaId, :QuestionVideoUrl, :QuestionVideoMediaId,
                            :QuestionNumber, :LessonId, :OptionsType)
                            RETURNING *`,
                        {
                            replacements: {
                                QuestionType: question.QuestionType,
                                QuestionText: question.QuestionText || null,
                                QuestionImageUrl: question.QuestionImageUrl || null,
                                QuestionImageMediaId: question.QuestionImageMediaId || null,
                                QuestionAudioUrl: question.QuestionAudioUrl || null,
                                QuestionAudioMediaId: question.QuestionAudioMediaId || null,
                                QuestionVideoUrl: question.QuestionVideoUrl || null,
                                QuestionVideoMediaId: question.QuestionVideoMediaId || null,
                                QuestionNumber: question.QuestionNumber,
                                LessonId: newLesson[0].LessonId,
                                OptionsType: question.OptionsType
                            },
                            type: prodSequelize.QueryTypes.INSERT,
                            transaction
                        }
                    );

                    const multipleChoiceQuestionAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(question.Id);

                    await Promise.all(multipleChoiceQuestionAnswers.map(answer =>
                        prodSequelize.query(
                            `INSERT INTO "MultipleChoiceQuestionAnswers" 
                                ("AnswerText", "AnswerImageUrl", "AnswerImageMediaId", "AnswerAudioUrl", "AnswerAudioMediaId", 
                                "IsCorrect", "MultipleChoiceQuestionId", "SequenceNumber", "CustomAnswerFeedbackText", 
                                "CustomAnswerFeedbackImage", "CustomAnswerFeedbackImageMediaId", "CustomAnswerFeedbackAudio", "CustomAnswerFeedbackAudioMediaId") 
                                VALUES (:AnswerText, :AnswerImageUrl, :AnswerImageMediaId, :AnswerAudioUrl, :AnswerAudioMediaId,
                                :IsCorrect, :MultipleChoiceQuestionId, :SequenceNumber, :CustomAnswerFeedbackText, 
                                :CustomAnswerFeedbackImage, :CustomAnswerFeedbackImageMediaId, :CustomAnswerFeedbackAudio, :CustomAnswerFeedbackAudioMediaId)`,
                            {
                                replacements: {
                                    AnswerText: answer.AnswerText || null,
                                    AnswerImageUrl: answer.AnswerImageUrl || null,
                                    AnswerImageMediaId: answer.AnswerImageMediaId || null,
                                    AnswerAudioUrl: answer.AnswerAudioUrl || null,
                                    AnswerAudioMediaId: answer.AnswerAudioMediaId || null,
                                    IsCorrect: answer.IsCorrect,
                                    MultipleChoiceQuestionId: newQuestion[0].Id,
                                    SequenceNumber: answer.SequenceNumber,
                                    CustomAnswerFeedbackText: answer.CustomAnswerFeedbackText || null,
                                    CustomAnswerFeedbackImage: answer.CustomAnswerFeedbackImage || null,
                                    CustomAnswerFeedbackImageMediaId: answer.CustomAnswerFeedbackImageMediaId || null,
                                    CustomAnswerFeedbackAudio: answer.CustomAnswerFeedbackAudio || null,
                                    CustomAnswerFeedbackAudioMediaId: answer.CustomAnswerFeedbackAudioMediaId || null
                                },
                                type: prodSequelize.QueryTypes.INSERT,
                                transaction
                            }
                        )
                    ));
                }));
            } else {
                const documentFiles = await documentFileRepository.getByLessonId(lesson.LessonId);


                await Promise.all(documentFiles.map(file => {
                    return prodSequelize.query(
                        `INSERT INTO "DocumentFiles" 
                            ("lessonId", "language", "image", "imageMediaId", "video", "videoMediaId", "audio", "audioMediaId", "mediaType") 
                            VALUES (:lessonId, :language, :image, :imageMediaId, :video, :videoMediaId, :audio, :audioMediaId, :mediaType)`,
                        {
                            replacements: {
                                lessonId: newLesson[0].LessonId,
                                language: file.language,
                                image: file.image || null,
                                imageMediaId: file.imageMediaId || null,
                                video: file.video || null,
                                videoMediaId: file.videoMediaId || null,
                                audio: file.audio || null,
                                audioMediaId: file.audioMediaId || null,
                                mediaType: file.mediaType
                            },
                            type: prodSequelize.QueryTypes.INSERT,
                            transaction
                        }
                    )
                }));
            }

            await transaction.commit();
            return newLesson[0];

        } catch (err) {
            if (transaction) {
                await transaction.rollback();
            }
            throw err;
        }

    } catch (error) {
        error.fileName = 'lessonService.js';
        throw error;
    }
};

const getLessonByCourseIdService = async (id) => {
    try {
        const lessons = await lessonRepository.getLessonsByCourse(id);
        return lessons;
    } catch (error) {
        error.fileName = 'lessonService.js';
        throw error;
    }
};

const testLessonService = async (phoneNumber, lesson) => {
    try {
        const {
            LessonId,
            courseId,
            weekNumber,
            dayNumber,
            SequenceNumber,
        } = lesson;

        let lessonObj;
        const lessons = await lessonRepository.getLessonsByCourseOrdered(courseId);

        const currentIndex = lessons.findIndex(l => l.LessonId === LessonId);

        if (currentIndex <= 0) {
            lessonObj = {
                status: 'success',
                previous_lesson_id: LessonId,
                message: 'start my course',
            };

            const now = new Date();

            // Delete previous purchases
            await waPurchasedCoursesRepository.deleteByPhoneNumber(phoneNumber);

            const waUserMetaArray = await waUserMetaRepository.getByPhoneNumber(phoneNumber);
            const waUserMeta = Array.isArray(waUserMetaArray) ? waUserMetaArray[0] : waUserMetaArray;

            const courseCateg = await courseRepository.getById(courseId);

            // Add new record
            await waPurchasedCoursesRepository.create({
                phoneNumber,
                courseId: courseId,
                courseCategoryId: courseCateg.CourseCategoryId,
                profile_id: waUserMeta.profile_id,
                purchaseDate: now,
                courseStartDate: now,
            });

            // Update progress
            await waUserProgressRepository.updateTestUserProgress(phoneNumber, {
                engagement_type: null,
                currentCourseId: courseId,
                currentWeek: null,
                currentDay: null,
                currentLessonId: null,
                currentLesson_sequence: null,
                acceptableMessages: [lessonObj.message],
                questionNumber: null,
                retryCounter: 0,
                activityType: null,
                lastUpdated: now,
            });

            await waUserProgressRepository.update(waUserMeta.profile_id, phoneNumber, null, null, null, null, null, null, null, null, [lessonObj.message]);
            await waUserProgressRepository.updateEngagementType(waUserMeta.profile_id, phoneNumber, "Course Start");
            await waUserActivityLogsRepository.deleteByPhoneNumber(phoneNumber);
            await waLessonsCompletedRepository.deleteByPhoneNumber(phoneNumber);
            await waQuestionResponsesRepository.deleteByPhoneNumber(phoneNumber);

            // removeUserTillCourse(waUserMeta.profile_id, phoneNumber);

            return lessonObj;
        }

        const previousLesson = lessons[currentIndex - 1];

        if (
            previousLesson.weekNumber === weekNumber &&
            previousLesson.dayNumber === dayNumber
        ) {
            lessonObj = {
                status: 'success',
                previous_lesson_id: previousLesson.LessonId,
                message: 'start next activity',
            };
        }

        // Check if previous was last in its group and current is first in new group
        const prevGroup = lessons.filter(
            l => l.weekNumber === previousLesson.weekNumber && l.dayNumber === previousLesson.dayNumber
        );
        const currGroup = lessons.filter(
            l => l.weekNumber === weekNumber && l.dayNumber === dayNumber
        );

        const isPrevLastInGroup =
            previousLesson.LessonId === prevGroup[prevGroup.length - 1].LessonId;
        const isCurrFirstInGroup =
            LessonId === currGroup[0].LessonId;

        if (isPrevLastInGroup && isCurrFirstInGroup) {
            lessonObj = {
                status: 'success',
                previous_lesson_id: previousLesson.LessonId,
                message: 'start next lesson',
            };
        }

        // Handle progress + course purchase logic
        if (previousLesson?.LessonId) {
            const now = new Date();

            // Delete previous purchases
            await waPurchasedCoursesRepository.deleteByPhoneNumber(phoneNumber);

            const waUserMetaArray = await waUserMetaRepository.getByPhoneNumber(phoneNumber);
            const waUserMeta = Array.isArray(waUserMetaArray) ? waUserMetaArray[0] : waUserMetaArray;

            const courseCateg = await courseRepository.getById(previousLesson.courseId);

            // Add new record
            await waPurchasedCoursesRepository.create({
                phoneNumber,
                courseId: previousLesson.courseId,
                courseCategoryId: courseCateg.CourseCategoryId,
                profile_id: waUserMeta.profile_id,
                purchaseDate: now,
                courseStartDate: now,
            });

            // Update progress
            await waUserProgressRepository.updateTestUserProgress(phoneNumber, {
                engagement_type: 'Course Start',
                currentCourseId: previousLesson.courseId,
                currentWeek: previousLesson.weekNumber,
                currentDay: previousLesson.dayNumber,
                currentLessonId: previousLesson.LessonId,
                currentLesson_sequence: previousLesson.SequenceNumber,
                acceptableMessages: [lessonObj.message],
                questionNumber: null,
                retryCounter: 0,
                activityType: null,
                lastUpdated: now,
            });

            return lessonObj;
        }

        // Fallback return
        return {
            status: 'success',
            previous_lesson_id: previousLesson.LessonId,
            message: '',
        };
    } catch (error) {
        error.fileName = 'lessonService.js';
        throw error;
    }
};

export default {
    createLessonService,
    getAllLessonService,
    getLessonByIdService,
    updateLessonService,
    deleteLessonService,
    getLessonsByActivity,
    migrateLessonService,
    getLessonByCourseIdService,
    testLessonService
};
