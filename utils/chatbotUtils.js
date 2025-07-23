import dotenv from "dotenv";
import { format } from 'date-fns';
import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waUserActivityLogsRepository from "../repositories/waUserActivityLogsRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import waPurchasedCoursesRepository from '../repositories/waPurchasedCoursesRepository.js';
import waConstantsRepository from "../repositories/waConstantsRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";
import { sendMessage, sendMediaMessage, sendButtonMessage } from "./whatsappUtils.js";
import { createActivityLog } from "./createActivityLogUtils.js";
import { watchAndImageView } from "../views/watchAndImage.js";
import { speakingPracticeView } from "../views/speakingPractice.js";
import { watchAndAudioView } from "../views/watchAndAudio.js";
import { readView } from "../views/read.js";
import { videoView } from "../views/video.js";
import { videoEndView } from "../views/videoEnd.js";
import { getLevelFromCourseName, sleep } from "./utils.js";
import { conversationalQuestionsBotView } from "../views/conversationalQuestionsBot.js";
import { conversationalMonologueBotView } from "../views/conversationalMonologueBot.js";
import { watchAndSpeakView } from "../views/watchAndSpeak.js";
import { mcqsView } from "../views/mcqs.js";
import { listenAndSpeakView } from "../views/listenAndSpeak.js";
import { conversationalAgencyBotView } from "../views/conversationalAgencyBot.js";
import waActiveSessionRepository from "../repositories/waActiveSessionRepository.js";
import waProfileRepository from "../repositories/waProfileRepository.js";
import { feedbackMcqsView } from "../views/feedbackMcqs.js";
import { feedbackAudioView } from "../views/feedbackAudio.js";
import { assessmentMcqsView } from "../views/assessmentMcqs.js";
import { assessmentWatchAndSpeakView } from "../views/assessmentWatchAndSpeak.js";
import { level4ReportCard, kidsReportCard } from "./imageGenerationUtils.js";

dotenv.config();


const removeUser = async (phoneNumber) => {
    await waUsersMetadataRepository.deleteByPhoneNumber(phoneNumber);
    await waUserProgressRepository.deleteByPhoneNumber(phoneNumber);
    await waUserActivityLogsRepository.deleteByPhoneNumber(phoneNumber);
    await waLessonsCompletedRepository.deleteByPhoneNumber(phoneNumber);
    await waQuestionResponsesRepository.deleteByPhoneNumber(phoneNumber);
    await waActiveSessionRepository.deleteByPhoneNumber(phoneNumber);
    await waProfileRepository.deleteByPhoneNumber(phoneNumber);
    await waPurchasedCoursesRepository.deleteByPhoneNumber(phoneNumber);

    await sendMessage(phoneNumber, "Your data has been removed. Please start again using the link provided.");
};

const removeUserTillCourse = async (profileId, phoneNumber) => {
    const profile = await waProfileRepository.getByProfileId(profileId);
    const profileType = profile.dataValues.profile_type;
    if (profileType == "teacher") {
        await waUserProgressRepository.update(profileId, phoneNumber, null, null, null, null, null, null, null, null, ["start my course"]);
    } else {
        await waUserProgressRepository.update(profileId, phoneNumber, null, null, null, null, null, null, null, null, ["start now!"]);
    }
    await waUserProgressRepository.updateEngagementType(profileId, phoneNumber, "Course Start");
    await waUserActivityLogsRepository.deleteByPhoneNumber(phoneNumber);
    await waLessonsCompletedRepository.deleteByPhoneNumber(phoneNumber);
    await waQuestionResponsesRepository.deleteByPhoneNumber(phoneNumber);
    await sendMessage(phoneNumber, "Your data has been removed. Please start again using the link provided.");
};

const resetCourseKid = async (phoneNumber, botPhoneNumberId) => {
    // First, delete all existing data like "reset all"
    await waUsersMetadataRepository.deleteByPhoneNumber(phoneNumber);
    await waUserProgressRepository.deleteByPhoneNumber(phoneNumber);
    await waUserActivityLogsRepository.deleteByPhoneNumber(phoneNumber);
    await waLessonsCompletedRepository.deleteByPhoneNumber(phoneNumber);
    await waQuestionResponsesRepository.deleteByPhoneNumber(phoneNumber);
    await waActiveSessionRepository.deleteByPhoneNumber(phoneNumber);
    await waProfileRepository.deleteByPhoneNumber(phoneNumber);
    await waPurchasedCoursesRepository.deleteByPhoneNumber(phoneNumber);

    // Create test profiles
    const profiles = [
        { phone_number: phoneNumber, bot_phone_number_id: botPhoneNumberId, profile_type: 'student' },
        { phone_number: phoneNumber, bot_phone_number_id: botPhoneNumberId, profile_type: 'student' },
        { phone_number: phoneNumber, bot_phone_number_id: botPhoneNumberId, profile_type: 'student' },
        { phone_number: phoneNumber, bot_phone_number_id: botPhoneNumberId, profile_type: 'student' },
        { phone_number: phoneNumber, bot_phone_number_id: botPhoneNumberId, profile_type: 'student' },
        { phone_number: phoneNumber, bot_phone_number_id: botPhoneNumberId, profile_type: 'student' },
        { phone_number: phoneNumber, bot_phone_number_id: botPhoneNumberId, profile_type: 'student' }
    ];

    const createdProfiles = [];
    for (const profileData of profiles) {
        const profile = await waProfileRepository.create(profileData);
        createdProfiles.push(profile);
    }

    // Create user metadata for each profile
    const userMetadata = [
        { phoneNumber: phoneNumber, name: 'user 1', userClickedLink: new Date(), userRegistrationComplete: new Date(), profile_id: createdProfiles[0].dataValues.profile_id, classLevel: 'grade 1' },
        { phoneNumber: phoneNumber, name: 'user 2', userClickedLink: new Date(), userRegistrationComplete: new Date(), profile_id: createdProfiles[1].dataValues.profile_id, classLevel: 'grade 2' },
        { phoneNumber: phoneNumber, name: 'user 3', userClickedLink: new Date(), userRegistrationComplete: new Date(), profile_id: createdProfiles[2].dataValues.profile_id, classLevel: 'grade 3' },
        { phoneNumber: phoneNumber, name: 'user 4', userClickedLink: new Date(), userRegistrationComplete: new Date(), profile_id: createdProfiles[3].dataValues.profile_id, classLevel: 'grade 4' },
        { phoneNumber: phoneNumber, name: 'user 5', userClickedLink: new Date(), userRegistrationComplete: new Date(), profile_id: createdProfiles[4].dataValues.profile_id, classLevel: 'grade 5' },
        { phoneNumber: phoneNumber, name: 'user 6', userClickedLink: new Date(), userRegistrationComplete: new Date(), profile_id: createdProfiles[5].dataValues.profile_id, classLevel: 'grade 6' },
        { phoneNumber: phoneNumber, name: 'user 7', userClickedLink: new Date(), userRegistrationComplete: new Date(), profile_id: createdProfiles[6].dataValues.profile_id, classLevel: 'grade 7' }
    ];

    for (const metadata of userMetadata) {
        await waUsersMetadataRepository.create(metadata);
    }

    // Create user progress for each profile
    const userProgress = [
        { profile_id: createdProfiles[0].dataValues.profile_id, phoneNumber: phoneNumber, persona: 'kid', engagement_type: 'Course Start', acceptableMessages: ['Start Now!'], lastUpdated: new Date() },
        { profile_id: createdProfiles[1].dataValues.profile_id, phoneNumber: phoneNumber, persona: 'kid', engagement_type: 'Course Start', acceptableMessages: ['Start Now!'], lastUpdated: new Date() },
        { profile_id: createdProfiles[2].dataValues.profile_id, phoneNumber: phoneNumber, persona: 'kid', engagement_type: 'Course Start', acceptableMessages: ['Start Now!'], lastUpdated: new Date() },
        { profile_id: createdProfiles[3].dataValues.profile_id, phoneNumber: phoneNumber, persona: 'kid', engagement_type: 'Course Start', acceptableMessages: ['Start Now!'], lastUpdated: new Date() },
        { profile_id: createdProfiles[4].dataValues.profile_id, phoneNumber: phoneNumber, persona: 'kid', engagement_type: 'Course Start', acceptableMessages: ['Start Now!'], lastUpdated: new Date() },
        { profile_id: createdProfiles[5].dataValues.profile_id, phoneNumber: phoneNumber, persona: 'kid', engagement_type: 'Course Start', acceptableMessages: ['Start Now!'], lastUpdated: new Date() },
        { profile_id: createdProfiles[6].dataValues.profile_id, phoneNumber: phoneNumber, persona: 'kid', engagement_type: 'Course Start', acceptableMessages: ['Start Now!'], lastUpdated: new Date() }
    ];

    for (const progress of userProgress) {
        await waUserProgressRepository.create(progress);
    }

    // Create purchased courses
    const paymentProof = "https://beajbloblive.blob.core.windows.net/beajdocuments/20250618163609353-d5f65630-4f1e-4b87-974d-44034f71c1d5-1664985517525471";
    const purchasedCourses = [
        { phoneNumber: phoneNumber, courseCategoryId: 71, courseId: 119, courseStartDate: new Date(), purchaseDate: new Date(), profile_id: createdProfiles[0].dataValues.profile_id, paymentProof: paymentProof, paymentStatus: 'Approved' },
        { phoneNumber: phoneNumber, courseCategoryId: 71, courseId: 120, courseStartDate: new Date(), purchaseDate: new Date(), profile_id: createdProfiles[1].dataValues.profile_id, paymentProof: paymentProof, paymentStatus: 'Approved' },
        { phoneNumber: phoneNumber, courseCategoryId: 71, courseId: 121, courseStartDate: new Date(), purchaseDate: new Date(), profile_id: createdProfiles[2].dataValues.profile_id, paymentProof: paymentProof, paymentStatus: 'Approved' },
        { phoneNumber: phoneNumber, courseCategoryId: 71, courseId: 122, courseStartDate: new Date(), purchaseDate: new Date(), profile_id: createdProfiles[3].dataValues.profile_id, paymentProof: paymentProof, paymentStatus: 'Approved' },
        { phoneNumber: phoneNumber, courseCategoryId: 71, courseId: 123, courseStartDate: new Date(), purchaseDate: new Date(), profile_id: createdProfiles[4].dataValues.profile_id, paymentProof: paymentProof, paymentStatus: 'Approved' },
        { phoneNumber: phoneNumber, courseCategoryId: 71, courseId: 124, courseStartDate: new Date(), purchaseDate: new Date(), profile_id: createdProfiles[5].dataValues.profile_id, paymentProof: paymentProof, paymentStatus: 'Approved' },
        { phoneNumber: phoneNumber, courseCategoryId: 71, courseId: 143, courseStartDate: new Date(), purchaseDate: new Date(), profile_id: createdProfiles[6].dataValues.profile_id, paymentProof: paymentProof, paymentStatus: 'Approved' },
    ];

    for (const purchase of purchasedCourses) {
        await waPurchasedCoursesRepository.create(purchase);
    }

    await sendMessage(phoneNumber, "Test data has been created for kid profiles. You now have 7 student profiles with purchased courses.");
};

const weekEndScoreCalculation = async (profileId, phoneNumber, weekNumber, courseId) => {
    // Get lessonIds for mcqs of that week
    const mcqLessonIds = await lessonRepository.getLessonIdsByCourseAndWeekAndActivityType(courseId, weekNumber, 'mcqs');
    const correctMcqs = await waQuestionResponsesRepository.getTotalScoreForList(profileId, phoneNumber, mcqLessonIds);
    const totalMcqs = await waQuestionResponsesRepository.getTotalQuestionsForList(profileId, phoneNumber, mcqLessonIds);

    // Get lessonIds for listenAndSpeak of that week
    const listenAndSpeakLessonIds = await lessonRepository.getLessonIdsByCourseAndWeekAndActivityType(courseId, weekNumber, 'listenAndSpeak');
    const correctListenAndSpeak = await waQuestionResponsesRepository.getTotalScoreForList(profileId, phoneNumber, listenAndSpeakLessonIds);
    const totalListenAndSpeak = await waQuestionResponsesRepository.getTotalQuestionsForList(profileId, phoneNumber, listenAndSpeakLessonIds);

    // Get lessonIds for watchAndSpeak of that week
    const watchAndSpeakLessonIds = await lessonRepository.getLessonIdsByCourseAndWeekAndActivityType(courseId, weekNumber, 'watchAndSpeak');
    const correctWatchAndSpeak = await waQuestionResponsesRepository.watchAndSpeakScoreForList(profileId, phoneNumber, watchAndSpeakLessonIds);

    // Get lessonIds for read of that week
    const readLessonIds = await lessonRepository.getLessonIdsByCourseAndWeekAndActivityType(courseId, weekNumber, 'read');
    const correctRead = await waQuestionResponsesRepository.readScoreForList(profileId, phoneNumber, readLessonIds);

    // Get lessonIds for conversationalMonologueBot of that week
    const monologueLessonIds = await lessonRepository.getLessonIdsByCourseAndWeekAndActivityType(courseId, weekNumber, 'conversationalMonologueBot');
    const correctMonologue = await waQuestionResponsesRepository.monologueScoreForList(profileId, phoneNumber, monologueLessonIds);

    // Get lessonIds for speakingPractice of that week
    const speakingPracticeLessonIds = await lessonRepository.getLessonIdsByCourseAndWeekAndActivityType(courseId, weekNumber, 'speakingPractice');
    const correctSpeakingPractice = await waQuestionResponsesRepository.monologueScoreForList(profileId, phoneNumber, speakingPracticeLessonIds);

    // Calculate sum of scores and sum of total scores and give percentage out of 100
    const totalScore = correctMcqs + correctListenAndSpeak + correctWatchAndSpeak.score + correctRead.score + correctMonologue.score + correctSpeakingPractice.score;
    const totalQuestions = totalMcqs + totalListenAndSpeak + correctWatchAndSpeak.total + correctRead.total + correctMonologue.total + correctSpeakingPractice.total;
    const percentage = Math.round((totalScore / totalQuestions) * 100);
    return percentage;
};

const studentReportCardCalculation = async (profileId, phoneNumber) => {
    // Parallel fetch of initial data
    const [purchasedCourses, courses, userMetadata] = await Promise.all([
        waPurchasedCoursesRepository.getPurchasedCoursesByProfileId(profileId),
        courseRepository.getAll(),
        waUsersMetadataRepository.getByProfileId(profileId)
    ]);

    // Match purchased courses with course details to get course names
    const purchasedCoursesWithNames = purchasedCourses.map(purchasedCourse => {
        const courseDetails = courses.find(course => course.dataValues.CourseId === purchasedCourse.dataValues.courseId);
        return {
            ...purchasedCourse.dataValues,
            courseName: courseDetails ? courseDetails.dataValues.CourseName : null
        };
    });

    const gradeCourse = purchasedCoursesWithNames.filter(course => course.courseName && course.courseName.toLowerCase().includes("grade"));

    if (gradeCourse.length === 0) {
        console.log("No grade course found for this profile");
        return;
    }

    const gradeCourseId = gradeCourse[0].courseId;
    const gradeCourseName = gradeCourse[0].courseName;

    // Prepare all lesson ID fetching operations based on grade
    const lessonFetchPromises = [];
    let mathsSubjects = [];
    let englishSubjects = [];

    // MATHS lesson fetching based on grade
    if (gradeCourseName.toLowerCase().includes("grade 1") || gradeCourseName.toLowerCase().includes("grade 2")) {
        mathsSubjects = ['placeValue', 'addition', 'subtraction', 'patterns'];
        lessonFetchPromises.push(
            lessonRepository.getLessonIdsByCourseAndAliasAndWeekAndDay(gradeCourseId, "🧮 *Maths Challenge!*", [[1, 2], [1, 4], [2, 2]]), // placeValue
            lessonRepository.getLessonIdsByCourseAndAliasAndWeekAndDay(gradeCourseId, "🧮 *Maths Challenge!*", [[2, 4], [3, 2], [4, 2]]), // addition
            lessonRepository.getLessonIdsByCourseAndAliasAndWeekAndDay(gradeCourseId, "🧮 *Maths Challenge!*", [[3, 4]]), // subtraction
            lessonRepository.getLessonIdsByCourseAndAliasAndWeekAndDay(gradeCourseId, "🧮 *Maths Challenge!*", [[4, 4]]) // patterns
        );
    } else if (gradeCourseName.toLowerCase().includes("grade 3") || gradeCourseName.toLowerCase().includes("grade 4")) {
        mathsSubjects = ['placeValue', 'addition', 'subtraction', 'multiplication'];
        lessonFetchPromises.push(
            lessonRepository.getLessonIdsByCourseAndAliasAndWeekAndDay(gradeCourseId, "🧮 *Maths Challenge!*", [[1, 2], [1, 4]]), // placeValue
            lessonRepository.getLessonIdsByCourseAndAliasAndWeekAndDay(gradeCourseId, "🧮 *Maths Challenge!*", [[2, 2], [3, 4]]), // addition
            lessonRepository.getLessonIdsByCourseAndAliasAndWeekAndDay(gradeCourseId, "🧮 *Maths Challenge!*", [[2, 4], [3, 2], [4, 2]]), // subtraction
            lessonRepository.getLessonIdsByCourseAndAliasAndWeekAndDay(gradeCourseId, "🧮 *Maths Challenge!*", [[4, 4]]) // multiplication
        );
    } else if (gradeCourseName.toLowerCase().includes("grade 5") || gradeCourseName.toLowerCase().includes("grade 6")) {
        mathsSubjects = ['placeValue', 'additionAndSubtraction', 'multiplication', 'fractions'];
        lessonFetchPromises.push(
            lessonRepository.getLessonIdsByCourseAndAliasAndWeekAndDay(gradeCourseId, "🧮 *Maths Challenge!*", [[1, 2], [1, 4]]), // placeValue
            lessonRepository.getLessonIdsByCourseAndAliasAndWeekAndDay(gradeCourseId, "🧮 *Maths Challenge!*", [[1, 4]]), // additionAndSubtraction
            lessonRepository.getLessonIdsByCourseAndAliasAndWeekAndDay(gradeCourseId, "🧮 *Maths Challenge!*", [[2, 2], [2, 4], [3, 2], [3, 4]]), // multiplication
            lessonRepository.getLessonIdsByCourseAndAliasAndWeekAndDay(gradeCourseId, "🧮 *Maths Challenge!*", [[4, 2], [4, 4]]) // fractions
        );
    }

    // ENGLISH lesson fetching
    if (gradeCourseName.toLowerCase().includes("grade 7")) {
        englishSubjects = ['comprehension', 'vocabulary', 'reading', 'speaking1', 'speaking2'];
        lessonFetchPromises.push(
            lessonRepository.getLessonIdsByCourseAndAlias(gradeCourseId, ["*What Did They Say?*", "What Did They Say?"]), // comprehension
            lessonRepository.getLessonIdsByCourseAndAlias(gradeCourseId, ["*End of Week Challenge!* 💪🏽"]), // vocabulary
            lessonRepository.getLessonIdsByCourseAndAlias(gradeCourseId, ["📖 *Let's Read!*"]), // reading
            lessonRepository.getLessonIdsByCourseAndAlias(gradeCourseId, ["*Let's Listen and Speak*"]), // speaking1
            lessonRepository.getLessonIdsByCourseAndAlias(gradeCourseId, ["*Let's Watch* 🎦 *and Speak* 🗣️", "*Let's Watch* 🎦 *and Speak* 🗣️"]) // speaking2
        );
    } else {
        englishSubjects = ['comprehension', 'vocabulary', 'reading', 'speaking1'];
        lessonFetchPromises.push(
            lessonRepository.getLessonIdsByCourseAndAlias(gradeCourseId, ["📕 *Do you Remember?*"]), // comprehension
            lessonRepository.getLessonIdsByCourseAndAlias(gradeCourseId, ["🔡 *Let's Learn New Words!*", "🔡 *Let's Learn New Words!*", "🔠 *Let's Learn New Words!*", "🔠 *Let's Learn New Words!*"]), // vocabulary
            lessonRepository.getLessonIdsByCourseAndAlias(gradeCourseId, ["📖 *Let's Read!*"]), // reading
            lessonRepository.getLessonIdsByCourseAndAlias(gradeCourseId, ["🗣️ *You Can Speak!*", "🗣️ *You Can Speak!* ", "🗣 *Let's Practise Speaking!*", "🗣 *Let's Practise Speaking!*"]) // speaking1
        );
    }

    // Execute all lesson ID fetching in parallel
    const lessonResults = await Promise.all(lessonFetchPromises);

    // Map results to appropriate variables
    const mathsLessonIds = lessonResults.slice(0, mathsSubjects.length);
    const englishLessonIds = lessonResults.slice(mathsSubjects.length);

    // Prepare all score calculation promises
    const scorePromises = [];
    const scoreTypes = [];

    // Add maths score calculations
    mathsLessonIds.forEach((lessonIds, index) => {
        if (lessonIds.length > 0) {
            scorePromises.push(
                waQuestionResponsesRepository.getTotalQuestionsForList(profileId, phoneNumber, lessonIds),
                waQuestionResponsesRepository.getTotalScoreForList(profileId, phoneNumber, lessonIds)
            );
            scoreTypes.push(`maths_${mathsSubjects[index]}_total`, `maths_${mathsSubjects[index]}_correct`);
        }
    });

    // Add english score calculations
    englishLessonIds.forEach((lessonIds, index) => {
        if (lessonIds.length > 0) {
            if (englishSubjects[index] === 'reading') {
                // Special case for reading (watchAndSpeak)
                scorePromises.push(waQuestionResponsesRepository.watchAndSpeakScoreForList(profileId, phoneNumber, lessonIds));
                scoreTypes.push(`english_reading_score`);
            } else if (englishSubjects[index] === 'speaking2') {
                // Special case for speaking2 (watchAndSpeak)
                scorePromises.push(waQuestionResponsesRepository.watchAndSpeakScoreForList(profileId, phoneNumber, lessonIds));
                scoreTypes.push(`english_speaking2_score`);
            } else {
                // Regular MCQ scoring
                scorePromises.push(
                    waQuestionResponsesRepository.getTotalQuestionsForList(profileId, phoneNumber, lessonIds),
                    waQuestionResponsesRepository.getTotalScoreForList(profileId, phoneNumber, lessonIds)
                );
                scoreTypes.push(`english_${englishSubjects[index]}_total`, `english_${englishSubjects[index]}_correct`);
            }
        }
    });

    // Execute all score calculations in parallel
    const scoreResults = await Promise.all(scorePromises);

    // Process results and calculate percentages
    const scores = {};
    let resultIndex = 0;

    scoreTypes.forEach(scoreType => {
        scores[scoreType] = scoreResults[resultIndex++];
    });

    // Calculate Maths percentages
    const mathsPercentages = {};
    mathsSubjects.forEach(subject => {
        const totalKey = `maths_${subject}_total`;
        const correctKey = `maths_${subject}_correct`;

        if (scores[totalKey] && scores[totalKey] > 0) {
            mathsPercentages[subject] = Math.round((scores[correctKey] / scores[totalKey]) * 100);
        }
    });

    // Calculate English percentages
    const englishPercentages = {};
    englishSubjects.forEach(subject => {
        if (subject === 'reading') {
            const scoreKey = `english_reading_score`;
            if (scores[scoreKey] && scores[scoreKey].total > 0) {
                englishPercentages.reading = Math.round((scores[scoreKey].score / scores[scoreKey].total) * 100);
            }
        } else if (subject === 'speaking2') {
            const scoreKey = `english_speaking2_score`;
            if (scores[scoreKey] && scores[scoreKey].total > 0) {
                englishPercentages.speaking2 = Math.round((scores[scoreKey].score / scores[scoreKey].total) * 100);
            }
        } else {
            const totalKey = `english_${subject}_total`;
            const correctKey = `english_${subject}_correct`;

            if (scores[totalKey] && scores[totalKey] > 0) {
                englishPercentages[subject] = Math.round((scores[correctKey] / scores[totalKey]) * 100);
            }
        }
    });

    // Handle combined speaking percentage - check if both have questions (lesson IDs), not just if percentages are truthy
    const speaking1HasQuestions = englishLessonIds[englishSubjects.indexOf('speaking1')] && englishLessonIds[englishSubjects.indexOf('speaking1')].length > 0;
    const speaking2HasQuestions = englishSubjects.includes('speaking2') && englishLessonIds[englishSubjects.indexOf('speaking2')] && englishLessonIds[englishSubjects.indexOf('speaking2')].length > 0;

    if (speaking1HasQuestions && speaking2HasQuestions) {
        englishPercentages.speaking = Math.round((englishPercentages.speaking1 + englishPercentages.speaking2) / 2);
        delete englishPercentages.speaking1;
        delete englishPercentages.speaking2;
    } else if (englishPercentages.speaking1 !== undefined) {
        englishPercentages.speaking = englishPercentages.speaking1;
        delete englishPercentages.speaking1;
    }

    // Create report card object with non-zero percentages only
    const reportCard = {
        Maths: {},
        English: {}
    };

    // Add non-zero Maths percentages with proper labels
    const mathsLabels = {
        placeValue: "Place Value",
        addition: "Addition",
        subtraction: "Subtraction",
        patterns: "Patterns",
        multiplication: "Multiplication",
        additionAndSubtraction: "Addition/Subtraction",
        fractions: "Fractions"
    };

    Object.entries(mathsPercentages).forEach(([key, percentage]) => {
        if (percentage > 0) {
            reportCard.Maths[mathsLabels[key]] = percentage;
        }
    });

    // Add non-zero English percentages with proper labels
    const englishLabels = {
        comprehension: "Comprehension",
        vocabulary: "Vocabulary",
        speaking: "Speaking",
        reading: "Reading"
    };

    Object.entries(englishPercentages).forEach(([key, percentage]) => {
        if (percentage > 0) {
            reportCard.English[englishLabels[key]] = percentage;
        }
    });

    // Calculate totals for each category
    const mathsScores = Object.values(reportCard.Maths);
    const englishScores = Object.values(reportCard.English);

    if (mathsScores.length > 0) {
        reportCard.Maths.Total = Math.round(mathsScores.reduce((sum, score) => sum + score, 0) / mathsScores.length);
    }

    if (englishScores.length > 0) {
        reportCard.English.Total = Math.round(englishScores.reduce((sum, score) => sum + score, 0) / englishScores.length);
    }

    // Remove empty categories
    if (Object.keys(reportCard.Maths).length === 0) delete reportCard.Maths;
    if (Object.keys(reportCard.English).length === 0) delete reportCard.English;

    // Process user metadata
    const userMetadataData = userMetadata.dataValues;
    let name = userMetadataData.name;
    let grade = userMetadataData.classLevel ? userMetadataData.classLevel.replace(/\D/g, '') : undefined;
    let section;
    if (userMetadataData.cohort && /^Cohort\s+\d+$/.test(userMetadataData.cohort)) {
        const cohortNumber = parseInt(userMetadataData.cohort.replace(/\D/g, ''), 10);
        section = String.fromCharCode(64 + cohortNumber); // 65 = 'A'
    } else {
        section = userMetadataData.cohort;
    }

    // Generate report card image
    let reportCardImage;
    if (grade == 7) {
        reportCardImage = await level4ReportCard({ name, grade, section, ...reportCard });
    } else {
        reportCardImage = await kidsReportCard({ name, grade, section, ...reportCard });
    }
    console.log("Report Card Image:", reportCardImage);
    return reportCardImage;
};

const getNextCourse = async (userProfileId) => {
    const purchaseCourses = await waPurchasedCoursesRepository.getPurchasedCoursesByProfileId(userProfileId);
    const courses = await courseRepository.getAll();
    const startedCourses = await waLessonsCompletedRepository.getUniqueStartedCoursesByProfileId(userProfileId);
    const notCompletedPurchasedCourse = purchaseCourses.filter(course => !startedCourses.includes(course.dataValues.courseId));
    if (notCompletedPurchasedCourse.length > 0) {
        for (const purchasedCourse of notCompletedPurchasedCourse) {
            for (const course of courses) {
                if (purchasedCourse.dataValues.courseId === course.dataValues.CourseId) {
                    purchasedCourse.dataValues.sequenceNumber = course.dataValues.SequenceNumber;
                    purchasedCourse.dataValues.courseStartDate = course.dataValues.courseStartDate;
                    purchasedCourse.dataValues.courseName = course.dataValues.CourseName;
                    break;
                }
            }
        }
        const sortedNotCompletedPurchasedCourse = notCompletedPurchasedCourse.toSorted((a, b) => a.dataValues.sequenceNumber - b.dataValues.sequenceNumber);
        const nextCourse = sortedNotCompletedPurchasedCourse[0];
        return nextCourse;
    }
    return null;
};

const startCourseForUser = async (profileId, userMobileNumber, numbers_to_ignore) => {
    const nextCourse = await getNextCourse(profileId);
    if (!nextCourse) {
        await sendMessage(userMobileNumber, "No available purchased courses. Kindly contact beaj support.");
        await createActivityLog(userMobileNumber, "text", "outbound", "No available purchased courses. Kindly contact beaj support.", null);
        return false;
    }
    // Get today's date
    const today = new Date();
    const courseStartDate = new Date(nextCourse.dataValues.courseStartDate);

    // Extract only the year, month, and day to ensure accurate local date comparison
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();

    const courseStartYear = courseStartDate.getFullYear();
    const courseStartMonth = courseStartDate.getMonth();
    const courseStartDateOnly = courseStartDate.getDate();

    // Check if today < course start date
    if (todayYear < courseStartYear || (todayYear === courseStartYear && todayMonth < courseStartMonth) || (todayYear === courseStartYear && todayMonth === courseStartMonth && todayDate < courseStartDateOnly)) {
        if (!numbers_to_ignore.includes(userMobileNumber)) {
            const formattedStartDate = format(new Date(nextCourse.dataValues.courseStartDate), 'MMMM do, yyyy');
            const message = "We will start on " + formattedStartDate + "! See you then!";
            await sendMessage(userMobileNumber, message);
            await createActivityLog(userMobileNumber, "text", "outbound", message, null);
            return false;
        }
    }
    // Update engagment type
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Course Start");

    // Update user progress
    await waUserProgressRepository.update(
        profileId,
        userMobileNumber,
        nextCourse.dataValues.courseId,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null
    );

    // Extract Level from courseName
    // if teacher
    const profile = await waProfileRepository.getByProfileId(profileId);
    const profileType = profile.dataValues.profile_type;
    if (profileType == "teacher") {
        const courseName = nextCourse.dataValues.courseName.split("-");
        const level = courseName[0].trim();
        if (level == "Level 0") {
            let intro_message = "Assalam o Alaikum 👋\n\nWelcome to Beaj Self Development Course.\n\nMa'am Zainab Qureshi, Ma'am Fizza Hasan and Ma'am Sameen Shahid will be your instructors.";
            await sendMessage(userMobileNumber, intro_message);
            await createActivityLog(userMobileNumber, "text", "outbound", intro_message, null);
            const demoVideo = await waConstantsRepository.getByKey("DEMO_VIDEO");
            if (demoVideo) {
                await sendMediaMessage(userMobileNumber, demoVideo.dataValues.constantValue, 'video', null, 0, "WA_Constants", demoVideo.dataValues.id, demoVideo.dataValues.constantMediaId, "constantMediaId");
                await createActivityLog(userMobileNumber, "video", "outbound", demoVideo.dataValues.constantValue, null);
                await sleep(5000);
            }
            await sendButtonMessage(userMobileNumber, "Are you ready to start the Warmup Activity?", [{ id: "lets_start", title: "Start" }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Are you ready to start the Warmup Activity?", null);
        } else if (level == "Level 4") {
            await sendButtonMessage(userMobileNumber, 'Are you ready to start your final task?', [{ id: 'lets_start', title: "Start" }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Are you ready to start your final task?", null);
        } else {
            await sendButtonMessage(userMobileNumber, "Are you ready to start " + level + "?", [{ id: "lets_start", title: "Start" }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Are you ready to start " + level + "?", null);
        }

        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start"]);
    } else {
        const courseName = nextCourse.dataValues.courseName;
        const level = getLevelFromCourseName(courseName);
        if (courseName.toLowerCase().includes("assessment")) {
            let key = "LEVEL" + level + "PUZZLE1";
            const puzzleImage = await waConstantsRepository.getByKey(key);
            if (puzzleImage) {
                const captionText = "🎯 Play games to unlock the Summer Camp!";
                await sendButtonMessage(userMobileNumber, captionText, [{ id: "lets_start", title: "Start" }], 0, puzzleImage.dataValues.constantValue, null, "WA_Constants", puzzleImage.dataValues.id, puzzleImage.dataValues.constantMediaId, null, "constantMediaId");
                await createActivityLog(userMobileNumber, "template", "outbound", captionText, null);
            }
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start"]);
        } else {
            const captionText = "👍 Let's begin your adventure!";
            await sendButtonMessage(userMobileNumber, captionText, [{ id: "lets_start", title: "Start" }]);
            await createActivityLog(userMobileNumber, "template", "outbound", captionText, null);
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start"]);
        }
    }
    return true;
};

const sendCourseLessonToTeacher = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, buttonId = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (activity == 'video') {
            await videoView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'videoEnd') {
            await videoEndView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'mcqs') {
            await mcqsView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher', buttonId);
        }
        else if (activity == 'watchAndSpeak') {
            await watchAndSpeakView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'watchAndAudio') {
            await watchAndAudioView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'watchAndImage') {
            await watchAndImageView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'listenAndSpeak') {
            await listenAndSpeakView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'read') {
            await readView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'conversationalQuestionsBot') {
            await conversationalQuestionsBotView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'conversationalMonologueBot') {
            await conversationalMonologueBotView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'conversationalAgencyBot') {
            await conversationalAgencyBotView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'speakingPractice') {
            await speakingPracticeView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'feedbackAudio') {
            await feedbackAudioView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'feedbackMcqs') {
            await feedbackMcqsView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
        else if (activity == 'assessmentMcqs') {
            await assessmentMcqsView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher', buttonId);
        }
        else if (activity == 'assessmentWatchAndSpeak') {
            await assessmentWatchAndSpeakView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'teacher');
        }
    } catch (error) {
        console.log('Error sending lesson to user:', error);
        error.fileName = 'chatBotService.js';
        throw error;
    }
};

const sendCourseLessonToKid = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, buttonId = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (activity == 'video') {
            await videoView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'videoEnd') {
            await videoEndView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'mcqs') {
            await mcqsView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid', buttonId);
        }
        else if (activity == 'watchAndSpeak') {
            await watchAndSpeakView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'listenAndSpeak') {
            await listenAndSpeakView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'read') {
            await readView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'speakingPractice') {
            await speakingPracticeView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'assessmentMcqs') {
            await assessmentMcqsView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid', buttonId);
        }
        else if (activity == 'assessmentWatchAndSpeak') {
            await assessmentWatchAndSpeakView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'watchAndAudio') {
            await watchAndAudioView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'watchAndImage') {
            await watchAndImageView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'conversationalQuestionsBot') {
            await conversationalQuestionsBotView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'conversationalMonologueBot') {
            await conversationalMonologueBotView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'conversationalAgencyBot') {
            await conversationalAgencyBotView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'feedbackAudio') {
            await feedbackAudioView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
        else if (activity == 'feedbackMcqs') {
            await feedbackMcqsView(profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, 'kid');
        }
    } catch (error) {
        console.log('Error sending lesson to user:', error);
        error.fileName = 'chatBotService.js';
        throw error;
    }
};

export {
    removeUser,
    getNextCourse,
    startCourseForUser,
    sendCourseLessonToTeacher,
    sendCourseLessonToKid,
    weekEndScoreCalculation,
    studentReportCardCalculation,
    removeUserTillCourse,
    resetCourseKid
};