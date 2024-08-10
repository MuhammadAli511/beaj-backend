import lessonRepository from "../repositories/lessonRepository.js";
import documentFileRepository from "../repositories/documentFileRepository.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import multipleChoiceQuestionRepository from "../repositories/multipleChoiceQuestionRepository.js";
import multipleChoiceQuestionAnswerRepository from "../repositories/multipleChoiceQuestionAnswerRepository.js";

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
            const multipleChoiceQuestions = await multipleChoiceQuestionRepository.getByLessonIds(lesson.LessonId);
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


export default {
    createLessonService,
    getAllLessonService,
    getLessonByIdService,
    updateLessonService,
    deleteLessonService,
    getLessonsByActivity
};
