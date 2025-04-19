import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";

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
    // Speak Activity Question Details
    const speakActivityLessonIds = lessons.map(lesson => lesson.LessonId);
    const speakActivityQuestions = await speakActivityQuestionRepository.getByLessonIds(speakActivityLessonIds);
    // User Details
    const phoneNumbers = waQuestionResponses.map(response => response.phoneNumber);
    const users = await waUsersMetadataRepository.getByPhoneNumbers(phoneNumbers);

    const result = waQuestionResponses.map(response => {
        const lesson = lessons.find(lesson => lesson.LessonId == response.lessonId);
        const course = courses.find(course => course.CourseId == lesson?.courseId);
        const speakActivityQuestion = speakActivityQuestions.find(speakActivityQuestion => speakActivityQuestion.id == response.dataValues.questionId);
        const user = users.find(user => user.phoneNumber == response.phoneNumber);
        const responseData = response.dataValues || response;

        return {
            id: responseData.id,
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
            question: speakActivityQuestion?.question?.match(/<question>(.*?)<\/question>/s)?.[1]?.trim() || speakActivityQuestion?.question,
            answer: speakActivityQuestion?.answer,
            mediaFile: activityType == 'conversationalMonologueBot' ? null : speakActivityQuestion?.mediaFile,
            mediaFileSecond: speakActivityQuestion?.mediaFileSecond,
            questionNumber: speakActivityQuestion?.questionNumber,
            name: user?.name
        };
    });

    return result;
};

export default {
    getAllWaQuestionResponsesService,
    getWaQuestionResponsesByActivityTypeService
};