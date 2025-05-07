import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import multipleChoiceQuestionRepository from "../repositories/multipleChoiceQuestionRepository.js";
import multipleChoiceQuestionAnswerRepository from "../repositories/multipleChoiceQuestionAnswerRepository.js";

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
    let mcqAnswers = {};

    if (activityType == 'mcqs' || activityType == 'feedbackMcqs') {
        const multipleChoiceLessonIds = lessons.map(lesson => lesson.LessonId);
        multipleChoiceQuestions = await multipleChoiceQuestionRepository.getByLessonIds(multipleChoiceLessonIds);

        // Get all answer options for each question
        for (const question of multipleChoiceQuestions) {
            const answers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(question.Id);
            mcqAnswers[question.Id] = answers;
        }
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
        let userSelectedAnswerText = null;

        if (multipleChoiceQuestions) {
            multipleChoiceQuestion = multipleChoiceQuestions.find(multipleChoiceQuestion => multipleChoiceQuestion.Id == response.dataValues.questionId);

            // Map the user's selected option to the actual answer text
            if (multipleChoiceQuestion && mcqAnswers[multipleChoiceQuestion.Id] && responseData.submittedAnswerText && responseData.submittedAnswerText.length > 0) {
                const answers = mcqAnswers[multipleChoiceQuestion.Id];
                const userOption = responseData.submittedAnswerText[0].toLowerCase();

                // Extract the letter from "option a", "option b", etc.
                let selectedOption = null;
                if (userOption.includes('option')) {
                    selectedOption = userOption.split(' ')[1];
                } else {
                    selectedOption = userOption;
                }

                // Convert to index (a->0, b->1, c->2)
                if (selectedOption) {
                    const index = selectedOption.charCodeAt(0) - 'a'.charCodeAt(0);
                    const selectedAnswer = answers[index];
                    userSelectedAnswerText = selectedAnswer ? selectedAnswer.dataValues.AnswerText : null;
                }
            }
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
            answer: activityType == 'mcqs' || activityType == 'feedbackMcqs' ? userSelectedAnswerText : speakActivityQuestion?.answer,
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