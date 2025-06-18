import courseRepository from "../repositories/courseRepository.js";
import courseWeekRepository from "../repositories/courseWeekRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";
import documentFileRepository from "../repositories/documentFileRepository.js";
import multipleChoiceQuestionRepository from "../repositories/multipleChoiceQuestionRepository.js";
import multipleChoiceQuestionAnswerRepository from "../repositories/multipleChoiceQuestionAnswerRepository.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import Lesson from "../models/Lesson.js";

const combineCourses = async (courseId1, courseId2, courseId3, combinedCourseName) => {
    console.log('Starting course combination process...');
    console.log(`Input courses: ${courseId1}, ${courseId2}, ${courseId3}`);

    try {
        // Get original courses and validate they exist
        const course1 = await courseRepository.getById(courseId1);
        const course2 = await courseRepository.getById(courseId2);
        const course3 = await courseRepository.getById(courseId3);

        if (!course1 || !course2 || !course3) {
            throw new Error('One or more courses not found');
        }

        console.log(`Found courses: ${course1.dataValues.CourseName}, ${course2.dataValues.CourseName}, ${course3.dataValues.CourseName}`);

        // Get active lessons count for validation
        const activeLessons1 = await Lesson.findAll({ where: { courseId: courseId1, status: 'Active' } });
        const activeLessons2 = await Lesson.findAll({ where: { courseId: courseId2, status: 'Active' } });
        const activeLessons3 = await Lesson.findAll({ where: { courseId: courseId3, status: 'Active' } });

        console.log('\n=== ACTIVE LESSONS COUNT (BEFORE COMBINATION) ===');
        console.log(`Course 1 (${course1.dataValues.CourseName}): ${activeLessons1.length} active lessons`);
        console.log(`Course 2 (${course2.dataValues.CourseName}): ${activeLessons2.length} active lessons`);
        console.log(`Course 3 (${course3.dataValues.CourseName}): ${activeLessons3.length} active lessons`);
        console.log(`Total active lessons from input courses: ${activeLessons1.length + activeLessons2.length + activeLessons3.length}`);

        // Calculate week offsets based on actual week records, not metadata
        const course1WeekRecords = await courseWeekRepository.getByCourseId(courseId1);
        const course2WeekRecords = await courseWeekRepository.getByCourseId(courseId2);
        const course3WeekRecords = await courseWeekRepository.getByCourseId(courseId3);

        const course1Weeks = course1WeekRecords.length;
        const course2Weeks = course2WeekRecords.length;
        const course3Weeks = course3WeekRecords.length;
        const totalWeeks = course1Weeks + course2Weeks + course3Weeks;

        const course2WeekOffset = course1Weeks;
        const course3WeekOffset = course1Weeks + course2Weeks;

        console.log(`\n=== WEEK MAPPING ===`);
        console.log(`Course 1: ${course1Weeks} weeks (1-${course1Weeks}) -> no offset`);
        console.log(`Course 2: ${course2Weeks} weeks (1-${course2Weeks}) -> offset +${course2WeekOffset} = weeks ${course2WeekOffset + 1}-${course2WeekOffset + course2Weeks}`);
        console.log(`Course 3: ${course3Weeks} weeks (1-${course3Weeks}) -> offset +${course3WeekOffset} = weeks ${course3WeekOffset + 1}-${course3WeekOffset + course3Weeks}`);
        console.log(`Combined course will have ${totalWeeks} weeks total`);

        // Create combined course
        console.log('\n=== CREATING COMBINED COURSE ===');
        const combinedCourse = await courseRepository.create(
            combinedCourseName || `Combined: ${course1.dataValues.CourseName} + ${course2.dataValues.CourseName} + ${course3.dataValues.CourseName}`,
            course1.dataValues.CoursePrice, // Use first course's price
            totalWeeks,
            course1.dataValues.CourseCategoryId, // Use first course's category
            course1.dataValues.status,
            course1.dataValues.SequenceNumber,
            `Combined course containing: ${course1.dataValues.CourseName}, ${course2.dataValues.CourseName}, ${course3.dataValues.CourseName}`,
            course1.dataValues.courseStartDate
        );

        console.log(`Created combined course with ID: ${combinedCourse.CourseId}`);

        // Create course weeks for all three courses
        console.log('\n=== CREATING COURSE WEEKS ===');
        await createCourseWeeks(courseId1, combinedCourse.CourseId, 0);
        await createCourseWeeks(courseId2, combinedCourse.CourseId, course2WeekOffset);
        await createCourseWeeks(courseId3, combinedCourse.CourseId, course3WeekOffset);

        // Copy active lessons from all three courses
        console.log('\n=== COPYING ACTIVE LESSONS ===');
        await copyActiveLessons(courseId1, combinedCourse.CourseId, 0);
        await copyActiveLessons(courseId2, combinedCourse.CourseId, course2WeekOffset);
        await copyActiveLessons(courseId3, combinedCourse.CourseId, course3WeekOffset);

        // Final validation
        const finalActiveLessons = await Lesson.findAll({ where: { courseId: combinedCourse.CourseId, status: 'Active' } });

        console.log('\n=== FINAL VALIDATION ===');
        console.log(`Combined course active lessons: ${finalActiveLessons.length}`);
        console.log(`Expected total: ${activeLessons1.length + activeLessons2.length + activeLessons3.length}`);

        if (finalActiveLessons.length === activeLessons1.length + activeLessons2.length + activeLessons3.length) {
            console.log('✅ SUCCESS: All active lessons copied successfully!');
        } else {
            console.log('❌ WARNING: Lesson count mismatch detected!');
        }

        return combinedCourse;

    } catch (error) {
        console.error('Error combining courses:', error);
        throw error;
    }
};

const createCourseWeeks = async (sourceCourseId, targetCourseId, weekOffset) => {
    const sourceWeeks = await courseWeekRepository.getByCourseId(sourceCourseId);

    for (const week of sourceWeeks) {
        const { weekNumber, image, description } = week.dataValues;
        const newWeekNumber = weekNumber + weekOffset;
        await courseWeekRepository.create(newWeekNumber, targetCourseId, image, description);
        console.log(`Created week ${newWeekNumber} for combined course`);
    }
};

const copyActiveLessons = async (sourceCourseId, targetCourseId, weekOffset) => {
    // Get only active lessons
    const activeLessons = await Lesson.findAll({
        where: {
            courseId: sourceCourseId,
            status: 'Active'
        },
        order: [
            ['weekNumber', 'ASC'],
            ['dayNumber', 'ASC'],
            ['SequenceNumber', 'ASC']
        ]
    });

    console.log(`Copying ${activeLessons.length} active lessons from course ${sourceCourseId}`);

    for (const lesson of activeLessons) {
        const lessonData = lesson.dataValues;
        const newWeekNumber = lessonData.weekNumber + weekOffset;

        // Create new lesson with adjusted week number
        const newLesson = await lessonRepository.create(
            lessonData.lessonType,
            lessonData.dayNumber,
            lessonData.activity,
            lessonData.activityAlias,
            newWeekNumber,
            lessonData.text,
            targetCourseId,
            lessonData.SequenceNumber,
            lessonData.status
        );

        // Copy related data based on activity type
        await copyLessonRelatedData(lessonData.LessonId, newLesson.LessonId, lessonData.activity);
    }
};

const copyLessonRelatedData = async (sourceLessonId, targetLessonId, activity) => {
    if (activity === 'listenAndSpeak' || activity === 'watchAndSpeak' || activity === 'watchAndAudio' ||
        activity === 'watchAndImage' || activity === 'conversationalQuestionsBot' ||
        activity === 'conversationalMonologueBot' || activity === 'conversationalAgencyBot' ||
        activity === 'speakingPractice' || activity === 'feedbackAudio' || activity === 'assessmentWatchAndSpeak') {

        // Copy speak activity questions
        const speakQuestions = await speakActivityQuestionRepository.getByLessonId(sourceLessonId);
        for (const question of speakQuestions) {
            const questionData = question.dataValues;
            await speakActivityQuestionRepository.create(
                questionData.question,
                questionData.mediaFile,
                questionData.mediaFileSecond,
                questionData.answer,
                targetLessonId,
                questionData.questionNumber
            );
        }

    } else if (activity === 'mcqs' || activity === 'feedbackMcqs' || activity === 'assessmentMcqs') {

        // Copy multiple choice questions
        const mcqs = await multipleChoiceQuestionRepository.getByLessonId(sourceLessonId);
        for (const mcq of mcqs) {
            const mcqData = mcq.dataValues;
            const newMcq = await multipleChoiceQuestionRepository.create(
                mcqData.QuestionAudioUrl,
                mcqData.QuestionImageUrl,
                mcqData.QuestionVideoUrl,
                mcqData.QuestionType,
                mcqData.QuestionText,
                mcqData.QuestionNumber,
                targetLessonId,
                mcqData.OptionsType
            );

            // Copy MCQ answers
            const answers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(mcqData.Id);
            for (const answer of answers) {
                await multipleChoiceQuestionAnswerRepository.create(
                    answer.AnswerText,
                    answer.AnswerImageUrl,
                    answer.AnswerAudioUrl,
                    answer.IsCorrect,
                    newMcq.Id,
                    answer.SequenceNumber,
                    answer.CustomAnswerFeedbackText,
                    answer.CustomAnswerFeedbackImage,
                    answer.CustomAnswerFeedbackAudio
                );
            }
        }

    } else {

        // Copy document files for other activities
        const documentFiles = await documentFileRepository.getByLessonId(sourceLessonId);
        for (const file of documentFiles) {
            const fileData = file.dataValues;
            await documentFileRepository.create(
                targetLessonId,
                fileData.language,
                fileData.image,
                fileData.video,
                fileData.audio,
                fileData.mediaType
            );
        }
    }
};

export { combineCourses };

// Command line execution
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('Usage: node scripts/combineCourses.js <courseId1> <courseId2> <courseId3> [combinedCourseName]');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/combineCourses.js 1 2 3');
    console.log('  node scripts/combineCourses.js 1 2 3 "Complete Level 1-3 Course"');
    console.log('');
    console.log('Arguments:');
    console.log('  courseId1          - ID of the first course (Level 1)');
    console.log('  courseId2          - ID of the second course (Level 2)');
    console.log('  courseId3          - ID of the third course (Level 3)');
    console.log('  combinedCourseName - Optional name for the combined course');
    process.exit(1);
}

if (args.length < 3) {
    console.error('Error: Please provide at least 3 course IDs');
    console.log('Usage: node scripts/combineCourses.js <courseId1> <courseId2> <courseId3> [combinedCourseName]');
    process.exit(1);
}

const courseId1 = parseInt(args[0]);
const courseId2 = parseInt(args[1]);
const courseId3 = parseInt(args[2]);
const combinedCourseName = args[3] || null;

// Validate course IDs
if (isNaN(courseId1) || isNaN(courseId2) || isNaN(courseId3)) {
    console.error('Error: All course IDs must be valid numbers');
    process.exit(1);
}

if (courseId1 === courseId2 || courseId2 === courseId3 || courseId1 === courseId3) {
    console.error('Error: All course IDs must be different');
    process.exit(1);
}

async function runCombination() {
    try {
        console.log('='.repeat(60));
        console.log('          COURSE COMBINATION SCRIPT');
        console.log('='.repeat(60));
        console.log(`Combining courses: ${courseId1} + ${courseId2} + ${courseId3}`);
        if (combinedCourseName) {
            console.log(`Target name: ${combinedCourseName}`);
        }

        const result = await combineCourses(
            courseId1,
            courseId2,
            courseId3,
            combinedCourseName
        );

        console.log('\n=== COMBINATION COMPLETED SUCCESSFULLY ===');
        console.log(`New combined course created with ID: ${result.CourseId}`);
        console.log(`Course name: ${result.CourseName}`);
        console.log(`Total weeks: ${result.CourseWeeks}`);

    } catch (error) {
        console.error('\n=== COMBINATION FAILED ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Only run if this file is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
    runCombination();
} 