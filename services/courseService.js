import courseRepository from "../repositories/courseRepository.js";
import courseWeekRepository from "../repositories/courseWeekRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";
import documentFileRepository from "../repositories/documentFileRepository.js";
import multipleChoiceQuestionRepository from "../repositories/multipleChoiceQuestionRepository.js";
import multipleChoiceQuestionAnswerRepository from "../repositories/multipleChoiceQuestionAnswerRepository.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import Course from "../models/Course.js";

const createCourseService = async (courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription, courseStartDate) => {
    try {
        const course = await courseRepository.create(courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription, courseStartDate);
        for (let i = 1; i <= parseInt(courseWeeks); i++) {
            await courseWeekRepository.create(i, course.CourseId, null, null);
        }
    } catch (error) {
        error.fileName = 'courseService.js';
        throw error;
    }
};

const getAllCourseService = async () => {
    try {
        const courses = await courseRepository.getAll();
        return courses;
    } catch (error) {
        error.fileName = 'courseService.js';
        throw error;
    }
};

const getCourseByIdService = async (id) => {
    try {
        const course = await courseRepository.getById(id);
        return course;
    } catch (error) {
        error.fileName = 'courseService.js';
        throw error;
    }
};

const updateCourseService = async (id, courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription, courseStartDate) => {
    try {
        await courseRepository.update(id, courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription, courseStartDate);
    } catch (error) {
        error.fileName = 'courseService.js';
        throw error;
    }
};

const deleteCourseService = async (id) => {
    try {
        await courseRepository.deleteCourse(id);
        await courseWeekRepository.deleteCourseWeekByCourseId(id);
    } catch (error) {
        error.fileName = 'courseService.js';
        throw error;
    }
};

const getCourseByCourseCategoryIdService = async (id) => {
    try {
        const courses = await courseRepository.getByCourseCategoryId(id);
        return courses;
    } catch (error) {
        error.fileName = 'courseService.js';
        throw error;
    }
};

const duplicateCourseService = async (id) => {
    try {
        // COURSE
        // Get original course
        const course = await courseRepository.getById(id);
        const { CourseId, CourseName, CoursePrice, CourseWeeks, CourseCategoryId, status, SequenceNumber, CourseDescription, courseStartDate } = course.dataValues;
        // Create new course
        const newCourseName = CourseName + ' - Copy';
        const newCourse = await courseRepository.create(newCourseName, CoursePrice, CourseWeeks, CourseCategoryId, status, SequenceNumber, CourseDescription, courseStartDate);


        // COURSE WEEKS
        // Get original course weeks
        const courseWeeks = await courseWeekRepository.getByCourseId(id);
        // Create new course weeks
        for (let i = 0; i < courseWeeks.length; i++) {
            const { weekNumber, image, description } = courseWeeks[i].dataValues;
            await courseWeekRepository.create(weekNumber, CourseId, image, description);
        }


        // LESSONS
        // Get original lessons
        const lessons = await lessonRepository.getLessonsByCourse(id);
        // Create new lessons
        for (let i = 0; i < lessons.length; i++) {
            const lesson = lessons[i].dataValues;
            const newLesson = await lessonRepository.create(lesson.lessonType, lesson.dayNumber, lesson.activity, lesson.activityAlias, lesson.weekNumber, lesson.text, newCourse.CourseId, lesson.SequenceNumber, lesson.status);

            if (lesson.activity == 'listenAndSpeak' || lesson.activity == 'watchAndSpeak' || lesson.activity == 'watchAndAudio' || lesson.activity == 'watchAndImage' || lesson.activity == 'conversationalQuestionsBot' || lesson.activity == 'conversationalMonologueBot' || lesson.activity == 'conversationalAgencyBot' || lesson.activity == 'speakingPractice') {
                // SPEAK ACTIVITY QUESTIONS
                // Get original speak activity questions
                const speakActivityQuestions = await speakActivityQuestionRepository.getByLessonId(lesson.LessonId);
                // Create new speak activity questions
                for (let j = 0; j < speakActivityQuestions.length; j++) {
                    const speakActivityQuestion = speakActivityQuestions[j].dataValues;
                    await speakActivityQuestionRepository.create(speakActivityQuestion.question, speakActivityQuestion.mediaFile, speakActivityQuestion.answer, newLesson.LessonId, speakActivityQuestion.questionNumber);
                }
            } else if (lesson.activity == 'mcqs') {
                // MULTIPLE CHOICE QUESTIONS
                // Get original multiple choice questions
                const multipleChoiceQuestions = await multipleChoiceQuestionRepository.getByLessonId(lesson.LessonId);
                // Create new multiple choice questions
                for (let j = 0; j < multipleChoiceQuestions.length; j++) {
                    const multipleChoiceQuestion = multipleChoiceQuestions[j].dataValues;
                    const newMultipleChoiceQuestion = await multipleChoiceQuestionRepository.create(multipleChoiceQuestion.QuestionAudioUrl, multipleChoiceQuestion.QuestionImageUrl, multipleChoiceQuestion.QuestionVideoUrl, multipleChoiceQuestion.QuestionType, multipleChoiceQuestion.QuestionText, multipleChoiceQuestion.QuestionNumber, newLesson.LessonId, multipleChoiceQuestion.OptionsType);
                    // MULTIPLE CHOICE QUESTION ANSWERS
                    // Get original multiple choice question answers
                    const multipleChoiceQuestionAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(multipleChoiceQuestion.Id);
                    // Create new multiple choice question answers
                    for (let k = 0; k < multipleChoiceQuestionAnswers.length; k++) {
                        const multipleChoiceQuestionAnswer = multipleChoiceQuestionAnswers[k];
                        await multipleChoiceQuestionAnswerRepository.create(multipleChoiceQuestionAnswer.AnswerText, multipleChoiceQuestionAnswer.AnswerImageUrl, multipleChoiceQuestionAnswer.AnswerAudioUrl, multipleChoiceQuestionAnswer.IsCorrect, newMultipleChoiceQuestion.Id, multipleChoiceQuestionAnswer.SequenceNumber, multipleChoiceQuestionAnswer.CustomAnswerFeedbackText, multipleChoiceQuestionAnswer.CustomAnswerFeedbackImage, multipleChoiceQuestionAnswer.CustomAnswerFeedbackAudio);
                    }
                }
            } else {
                // DOCUMENT FILES
                // Get original document files
                const documentFiles = await documentFileRepository.getByLessonId(lesson.LessonId);
                // Create new document files
                for (let j = 0; j < documentFiles.length; j++) {
                    const documentFile = documentFiles[j].dataValues;
                    await documentFileRepository.create(newLesson.LessonId, documentFile.language, documentFile.image, documentFile.video, documentFile.audio, documentFile.mediaType);
                }
            }
        }
    } catch (error) {
        error.fileName = 'courseService.js';
        throw error;
    }
};

export default {
    createCourseService,
    getAllCourseService,
    getCourseByIdService,
    updateCourseService,
    deleteCourseService,
    duplicateCourseService,
    getCourseByCourseCategoryIdService
};
