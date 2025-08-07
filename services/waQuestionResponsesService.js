import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import multipleChoiceQuestionRepository from "../repositories/multipleChoiceQuestionRepository.js";
import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import multipleChoiceQuestionAnswerRepository from "../repositories/multipleChoiceQuestionAnswerRepository.js";

const getAllWaQuestionResponsesService = async () => {
    return await waQuestionResponsesRepository.getAll();
};

const getWaQuestionResponsesByActivityTypeService = async (activityType, courseId = null) => {
    const waQuestionResponses = await waQuestionResponsesRepository.getByActivityType(activityType, courseId);

    // Extract all IDs upfront
    const lessonIds = waQuestionResponses.map(response => response.lessonId);
    const profileIds = [...new Set(waQuestionResponses.map(response => response.profile_id))];

    const [lessons, userNamesResults] = await Promise.all([
        lessonRepository.getByLessonIds(lessonIds),
        profileIds.length > 0 ? waUsersMetadataRepository.getUserNamesByProfileIds(profileIds) : Promise.resolve([])
    ]);

    const courseIds = lessons.map(lesson => lesson.courseId);
    const lessonIdsForQuestions = lessons.map(lesson => lesson.LessonId);

    let coursesPromise = courseRepository.getByCourseIds(courseIds);
    let questionsPromise;

    if (activityType == 'mcqs' || activityType == 'feedbackMcqs' || activityType == 'assessmentMcqs') {
        questionsPromise = multipleChoiceQuestionRepository.getByLessonIds(lessonIdsForQuestions);
    } else {
        questionsPromise = speakActivityQuestionRepository.getByLessonIds(lessonIdsForQuestions);
    }

    const [courses, questions] = await Promise.all([coursesPromise, questionsPromise]);

    let multipleChoiceQuestions = null;
    let speakActivityQuestions = null;
    let mcqAnswers = {};

    if (activityType == 'mcqs' || activityType == 'feedbackMcqs' || activityType == 'assessmentMcqs') {
        multipleChoiceQuestions = questions;

        if (multipleChoiceQuestions.length > 0) {
            const questionIds = multipleChoiceQuestions.map(q => q.Id);
            const allAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionIds(questionIds);

            // Group answers by question ID
            mcqAnswers = allAnswers.reduce((acc, answer) => {
                const questionId = answer.MultipleChoiceQuestionId;
                if (!acc[questionId]) acc[questionId] = [];
                acc[questionId].push(answer);
                return acc;
            }, {});
        }
    } else {
        speakActivityQuestions = questions;
    }

    const lessonMap = lessons.reduce((acc, lesson) => {
        acc[lesson.LessonId] = lesson;
        return acc;
    }, {});

    const courseMap = courses.reduce((acc, course) => {
        acc[course.CourseId] = course;
        return acc;
    }, {});

    const userNamesMap = userNamesResults.reduce((acc, user) => {
        acc[user.profile_id] = user.name;
        return acc;
    }, {});

    const mcqQuestionsMap = multipleChoiceQuestions ? multipleChoiceQuestions.reduce((acc, question) => {
        acc[question.Id] = question;
        return acc;
    }, {}) : {};

    const speakQuestionsMap = speakActivityQuestions ? speakActivityQuestions.reduce((acc, question) => {
        acc[question.id] = question;
        return acc;
    }, {}) : {};

    // User Details
    const result = waQuestionResponses.map(response => {
        const lesson = lessonMap[response.lessonId];
        const course = lesson ? courseMap[lesson.courseId] : null;
        const responseData = response.dataValues || response;
        let multipleChoiceQuestion = null;
        let speakActivityQuestion = null;
        let userSelectedAnswerText = null;

        if (multipleChoiceQuestions) {
            multipleChoiceQuestion = mcqQuestionsMap[responseData.questionId];

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
            speakActivityQuestion = speakQuestionsMap[responseData.questionId];
        }
        return {
            id: responseData.id,
            profileId: responseData.profile_id,
            phoneNumber: responseData.phoneNumber,
            name: userNamesMap[responseData.profile_id] || null,
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
            answer: activityType == 'mcqs' || activityType == 'feedbackMcqs' || activityType == 'assessmentMcqs' ? userSelectedAnswerText : speakActivityQuestion?.answer,
            mediaFile: activityType == 'conversationalMonologueBot' ? null : speakActivityQuestion?.mediaFile,
            mediaFileSecond: speakActivityQuestion?.mediaFileSecond,
            questionNumber: speakActivityQuestion?.questionNumber || multipleChoiceQuestion?.QuestionNumber,
        };
    });

    if (activityType == 'feedbackMcqs' || activityType == 'assessmentMcqs') {
        const feedbackMcqsStatistics = await getFeedbackMcqsStatisticsService();
        return {
            result: result,
            feedbackMcqsStatistics: feedbackMcqsStatistics
        };
    } else {
        return {
            result: result
        };
    }
};

const getFeedbackMcqsStatisticsService = async () => {
    // Get all feedback MCQs responses
    const feedbackResponses = await waQuestionResponsesRepository.getByActivityType('feedbackMcqs');

    if (!feedbackResponses || feedbackResponses.length === 0) {
        return {};
    }

    // Get unique lesson IDs and question IDs
    const questionIds = [...new Set(feedbackResponses.map(response => response.questionId))];

    // Get questions and answer options
    const questions = await multipleChoiceQuestionRepository.getByIds(questionIds);

    // Initialize result object
    const result = {};

    // Get all answer options for each question
    const questionsWithAnswers = {};
    for (const question of questions) {
        const answers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(question.Id);
        questionsWithAnswers[question.Id] = {
            question: question,
            answers: answers
        };
    }

    // Group responses by question
    for (const question of questions) {
        const questionText = question.QuestionText;
        const questionResponses = feedbackResponses.filter(response => response.questionId === question.Id);

        const answerCounts = {};

        // Count each answer option
        for (const response of questionResponses) {
            if (!response.submittedAnswerText || response.submittedAnswerText.length === 0) {
                continue;
            }

            const userOption = response.submittedAnswerText[0].toLowerCase();
            let selectedOption = null;

            // Extract the letter from "option a", "option b", etc.
            if (userOption.includes('option')) {
                selectedOption = userOption.split(' ')[1];
            } else {
                selectedOption = userOption;
            }

            // Convert to index (a->0, b->1, c->2)
            if (selectedOption) {
                const index = selectedOption.charCodeAt(0) - 'a'.charCodeAt(0);
                const answers = questionsWithAnswers[question.Id].answers;

                if (answers && index >= 0 && index < answers.length) {
                    const answerText = answers[index].dataValues.AnswerText;

                    // Initialize or increment count
                    if (!answerCounts[answerText]) {
                        answerCounts[answerText] = 1;
                    } else {
                        answerCounts[answerText]++;
                    }
                }
            }
        }

        // Add to result
        result[questionText] = answerCounts;
    }

    return result;
};

export default {
    getAllWaQuestionResponsesService,
    getWaQuestionResponsesByActivityTypeService,
    getFeedbackMcqsStatisticsService
};