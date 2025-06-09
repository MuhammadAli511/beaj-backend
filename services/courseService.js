import courseRepository from "../repositories/courseRepository.js";
import courseWeekRepository from "../repositories/courseWeekRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";
import documentFileRepository from "../repositories/documentFileRepository.js";
import multipleChoiceQuestionRepository from "../repositories/multipleChoiceQuestionRepository.js";
import multipleChoiceQuestionAnswerRepository from "../repositories/multipleChoiceQuestionAnswerRepository.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";

const createCourseService = async (courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription, courseStartDate) => {
    try {
        const course = await courseRepository.create(courseName, coursePrice, courseWeeks, courseCategoryId, status, sequenceNumber, courseDescription, courseStartDate);
        const weekCount = parseInt(courseWeeks);
        await Promise.all(
            Array.from({ length: weekCount }, (_, i) => i + 1)
                .map(weekNumber => courseWeekRepository.create(weekNumber, course.CourseId, null, null))
        );
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
        for (const element of courseWeeks) {
            const { weekNumber, image, description } = element.dataValues;
            await courseWeekRepository.create(weekNumber, CourseId, image, description);
        }


        // LESSONS
        // Get original lessons
        const lessons = await lessonRepository.getLessonsByCourse(id);
        // Create new lessons
        for (const lesson of lessons) {
            const newLesson = await lessonRepository.create(lesson.dataValues.lessonType, lesson.dataValues.dayNumber, lesson.dataValues.activity, lesson.dataValues.activityAlias, lesson.dataValues.weekNumber, lesson.dataValues.text, newCourse.CourseId, lesson.dataValues.SequenceNumber, lesson.dataValues.status, lesson.dataValues.textInstruction, lesson.dataValues.audioInstructionUrl);

            if (lesson.dataValues.activity == 'listenAndSpeak' || lesson.dataValues.activity == 'watchAndSpeak' || lesson.dataValues.activity == 'watchAndAudio' || lesson.dataValues.activity == 'watchAndImage' || lesson.dataValues.activity == 'conversationalQuestionsBot' || lesson.dataValues.activity == 'conversationalMonologueBot' || lesson.dataValues.activity == 'conversationalAgencyBot' || lesson.dataValues.activity == 'speakingPractice' || lesson.dataValues.activity == 'feedbackAudio') {
                // SPEAK ACTIVITY QUESTIONS
                // Get original speak activity questions
                const speakActivityQuestions = await speakActivityQuestionRepository.getByLessonId(lesson.dataValues.LessonId);
                // Create new speak activity questions
                for (const speakActivityQuestion of speakActivityQuestions) {
                    await speakActivityQuestionRepository.create(speakActivityQuestion.dataValues.question, speakActivityQuestion.dataValues.mediaFile, speakActivityQuestion.dataValues.mediaFileSecond, speakActivityQuestion.dataValues.answer, newLesson.LessonId, speakActivityQuestion.dataValues.questionNumber, speakActivityQuestion.dataValues.difficultyLevel, speakActivityQuestion.dataValues.customFeedbackText, speakActivityQuestion.dataValues.customFeedbackImage, speakActivityQuestion.dataValues.customFeedbackAudio);
                }
            } else if (lesson.dataValues.activity == 'mcqs' || lesson.dataValues.activity == 'feedbackMcqs') {
                // MULTIPLE CHOICE QUESTIONS
                // Get original multiple choice questions
                const multipleChoiceQuestions = await multipleChoiceQuestionRepository.getByLessonId(lesson.dataValues.LessonId);
                // Create new multiple choice questions
                for (const multipleChoiceQuestion of multipleChoiceQuestions) {
                    const newMultipleChoiceQuestion = await multipleChoiceQuestionRepository.create(multipleChoiceQuestion.dataValues.QuestionAudioUrl, multipleChoiceQuestion.dataValues.QuestionImageUrl, multipleChoiceQuestion.dataValues.QuestionVideoUrl, multipleChoiceQuestion.dataValues.QuestionType, multipleChoiceQuestion.dataValues.QuestionText, multipleChoiceQuestion.dataValues.QuestionNumber, newLesson.LessonId, multipleChoiceQuestion.dataValues.OptionsType);
                    // MULTIPLE CHOICE QUESTION ANSWERS
                    // Get original multiple choice question answers
                    const multipleChoiceQuestionAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(multipleChoiceQuestion.dataValues.Id);
                    // Create new multiple choice question answers
                    for (const multipleChoiceQuestionAnswer of multipleChoiceQuestionAnswers) {
                        await multipleChoiceQuestionAnswerRepository.create(multipleChoiceQuestionAnswer.AnswerText, multipleChoiceQuestionAnswer.AnswerImageUrl, multipleChoiceQuestionAnswer.AnswerAudioUrl, multipleChoiceQuestionAnswer.IsCorrect, newMultipleChoiceQuestion.Id, multipleChoiceQuestionAnswer.SequenceNumber, multipleChoiceQuestionAnswer.CustomAnswerFeedbackText, multipleChoiceQuestionAnswer.CustomAnswerFeedbackImage, multipleChoiceQuestionAnswer.CustomAnswerFeedbackAudio);
                    }
                }
            } else {
                // DOCUMENT FILES
                // Get original document files
                const documentFiles = await documentFileRepository.getByLessonId(lesson.dataValues.LessonId);
                // Create new document files
                for (const documentFile of documentFiles) {
                    await documentFileRepository.create(newLesson.LessonId, documentFile.dataValues.language, documentFile.dataValues.image, documentFile.dataValues.video, documentFile.dataValues.audio, documentFile.dataValues.mediaType);
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
