import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import multipleChoiceQuestionRepository from "../repositories/multipleChoiceQuestionRepository.js";

const getAllWaQuestionResponsesService = async () => {
    return await waQuestionResponsesRepository.getAll();
};

const getWaQuestionResponsesByActivityTypeService = async (activityType) => {
    const waQuestionResponses = await waQuestionResponsesRepository.getByActivityType(activityType);
    // Lesson Details
    const lessonIds = waQuestionResponses.map(response => response.lessonId);
    const lessons = await lessonRepository.getByLessonIds(lessonIds);
    // Course Details
    const courseIds = lessons.map(lesson => lesson.courseId);
    const courses = await courseRepository.getByCourseIds(courseIds);
    // Multiple Choice Question Details
    let multipleChoiceQuestions = null;
    let speakActivityQuestions = null;
    if (activityType == 'mcqs' || activityType == 'feedbackMcqs') {
        const multipleChoiceLessonIds = lessons.map(lesson => lesson.LessonId);
        multipleChoiceQuestions = await multipleChoiceQuestionRepository.getByLessonIds(multipleChoiceLessonIds);
    } else {
        // Speak Activity Question Details
        const speakActivityLessonIds = lessons.map(lesson => lesson.LessonId);
        speakActivityQuestions = await speakActivityQuestionRepository.getByLessonIds(speakActivityLessonIds);
    }
    // User Details
    const result = waQuestionResponses.map(response => {
        const lesson = lessons.find(lesson => lesson.LessonId == response.lessonId);
        const course = courses.find(course => course.CourseId == lesson?.courseId);
        const responseData = response.dataValues || response;
        let multipleChoiceQuestion = null;
        let speakActivityQuestion = null;
        if (multipleChoiceQuestions) {
            multipleChoiceQuestion = multipleChoiceQuestions.find(multipleChoiceQuestion => multipleChoiceQuestion.Id == response.dataValues.questionId);
        } else {
            speakActivityQuestion = speakActivityQuestions.find(speakActivityQuestion => speakActivityQuestion.id == response.dataValues.questionId);
        }
        return {
            id: responseData.id,
            profileId: responseData.profile_id,
            phoneNumber: responseData.phoneNumber,
            lessonId: responseData.lessonId,
            questionId: responseData.questionId,
            activityType: responseData.activityType,
            alias: responseData.alias,
            submittedAnswerText: responseData.submittedAnswerText,
            submittedUserAudio: responseData.submittedUserAudio,
            submittedFeedbackText: responseData.submittedFeedbackText,
            submittedFeedbackAudio: responseData.submittedFeedbackAudio,
            dayNumber: lesson?.dayNumber,
            activityAlias: lesson?.activityAlias,
            weekNumber: lesson?.weekNumber,
            text: lesson?.text,
            courseId: lesson?.courseId,
            courseName: course?.CourseName,
            SequenceNumber: lesson?.SequenceNumber,
            question: speakActivityQuestion?.question?.match(/<question>(.*?)<\/question>/s)?.[1]?.trim() || speakActivityQuestion?.question || multipleChoiceQuestion?.QuestionText,
            answer: speakActivityQuestion?.answer,
            mediaFile: activityType == 'conversationalMonologueBot' ? null : speakActivityQuestion?.mediaFile,
            mediaFileSecond: speakActivityQuestion?.mediaFileSecond,
            questionNumber: speakActivityQuestion?.questionNumber || multipleChoiceQuestion?.QuestionNumber,
        };
    });

    return result;
};

export default {
    getAllWaQuestionResponsesService,
    getWaQuestionResponsesByActivityTypeService
};