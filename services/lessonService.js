import lessonRepository from "../repositories/lessonRepository.js";
import documentFileRepository from "../repositories/documentFileRepository.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import multipleChoiceQuestionRepository from "../repositories/multipleChoiceQuestionRepository.js";
import multipleChoiceQuestionAnswerRepository from "../repositories/multipleChoiceQuestionAnswerRepository.js";
import prodSequelize from "../config/prodDB.js";

const createLessonService = async (lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber, status) => {
    try {
        const lesson = await lessonRepository.create(lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber, status);
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
        if (lesson.activity == 'listenAndSpeak' || lesson.activity == 'postListenAndSpeak' || lesson.activity == 'preListenAndSpeak' || lesson.activity == 'watchAndSpeak') {
            const speakActivityQuestionFiles = await speakActivityQuestionRepository.getByLessonId(lesson.LessonId);
            lesson.dataValues.speakActivityQuestionFiles = speakActivityQuestionFiles;
        } else if (lesson.activity == 'mcqs' || lesson.activity == 'preMCQs' || lesson.activity == 'postMCQs') {
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

const updateLessonService = async (id, lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber, status) => {
    try {
        const lesson = await lessonRepository.update(id, lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber, status);
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

        if (activity == 'listenAndSpeak' || activity == 'postListenAndSpeak' || activity == 'preListenAndSpeak' || activity == 'watchAndSpeak') {
            await speakActivityQuestionRepository.deleteByLessonId(id);
        } else if (activity == 'mcqs' || activity == 'preMCQs' || activity == 'postMCQs') {
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

        if (activity == 'listenAndSpeak' || activity == 'postListenAndSpeak' || activity == 'preListenAndSpeak' || activity == 'watchAndSpeak') {
            const speakActivityQuestionFiles = await speakActivityQuestionRepository.getByLessonIds(lessonIds);
            const lessonsWithFiles = lessons.map(lesson => {
                return {
                    ...lesson.dataValues,
                    speakActivityQuestionFiles: speakActivityQuestionFiles.filter(file => file.lessonId === lesson.LessonId)
                };
            });
            return lessonsWithFiles;
        } else if (activity == 'mcqs' || activity == 'preMCQs' || activity == 'postMCQs') {
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
        } else {
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

const migrateLessonService = async (lessonId, courseId, sequenceNumber) => {
    try {
        const lesson = await lessonRepository.getById(lessonId);

        const transaction = await prodSequelize.transaction();

        try {
            const [newLesson, created] = await prodSequelize.models.Lesson.findOrCreate({
                where: { LessonId: lessonId },
                defaults: {
                    lessonType: lesson.lessonType,
                    dayNumber: lesson.dayNumber,
                    activity: lesson.activity,
                    activityAlias: lesson.activityAlias,
                    weekNumber: lesson.weekNumber,
                    text: lesson.text,
                    courseId: courseId,
                    sequenceNumber: sequenceNumber,
                    status: lesson.status,
                },
                transaction
            });

            if (lesson.activity == 'listenAndSpeak' || lesson.activity == 'postListenAndSpeak' || lesson.activity == 'preListenAndSpeak' || lesson.activity == 'watchAndSpeak') {
                const speakActivityQuestionFiles = await speakActivityQuestionRepository.getByLessonId(lesson.LessonId);
                for (let i = 0; i < speakActivityQuestionFiles.length; i++) {
                    await prodSequelize.models.SpeakActivityQuestion.create({
                        question: speakActivityQuestionFiles[i].question,
                        mediaFile: speakActivityQuestionFiles[i].mediaFile,
                        answer: speakActivityQuestionFiles[i].answer,
                        lessonId: newLesson.LessonId,
                        questionNumber: speakActivityQuestionFiles[i].questionNumber
                    }, { transaction });
                }
            } else if (lesson.activity == 'mcqs' || lesson.activity == 'preMCQs' || lesson.activity == 'postMCQs') {
                const multipleChoiceQuestions = await multipleChoiceQuestionRepository.getByLessonId(lesson.LessonId);
                for (let i = 0; i < multipleChoiceQuestions.length; i++) {
                    const newQuestion = await prodSequelize.models.MultipleChoiceQuestion.create({
                        QuestionType: multipleChoiceQuestions[i].QuestionType,
                        QuestionText: multipleChoiceQuestions[i].QuestionText,
                        QuestionImageUrl: multipleChoiceQuestions[i].QuestionImageUrl,
                        QuestionAudioUrl: multipleChoiceQuestions[i].QuestionAudioUrl,
                        QuestionNumber: multipleChoiceQuestions[i].QuestionNumber,
                        LessonId: newLesson.LessonId,
                        OptionsType: multipleChoiceQuestions[i].OptionsType
                    }, { transaction });

                    const multipleChoiceQuestionAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(multipleChoiceQuestions[i].Id);
                    for (let j = 0; j < multipleChoiceQuestionAnswers.length; j++) {
                        await prodSequelize.models.MultipleChoiceQuestionAnswer.create({
                            AnswerText: multipleChoiceQuestionAnswers[j].AnswerText,
                            AnswerImageUrl: multipleChoiceQuestionAnswers[j].AnswerImageUrl,
                            AnswerAudioUrl: multipleChoiceQuestionAnswers[j].AnswerAudioUrl,
                            IsCorrect: multipleChoiceQuestionAnswers[j].IsCorrect,
                            MultipleChoiceQuestionId: newQuestion.Id,
                            SequenceNumber: multipleChoiceQuestionAnswers[j].SequenceNumber
                        }, { transaction });
                    }
                }
            } else {
                const documentFiles = await documentFileRepository.getByLessonId(lesson.LessonId);
                for (let i = 0; i < documentFiles.length; i++) {
                    await prodSequelize.models.DocumentFile.create({
                        lessonId: newLesson.LessonId,
                        language: documentFiles[i].language,
                        image: documentFiles[i].image,
                        video: documentFiles[i].video,
                        audio: documentFiles[i].audio,
                        mediaType: documentFiles[i].mediaType
                    }, { transaction });
                }
            }
            await transaction.commit();
            return newLesson;
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
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
    migrateLessonService
};
