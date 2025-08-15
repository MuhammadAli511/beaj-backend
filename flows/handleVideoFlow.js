import lessonRepository from "../repositories/lessonRepository.js";
import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import { getAcceptableMessagesList } from "../utils/utils.js";
import { sendCourseLesson } from "../utils/chatbotUtils.js";


const handleVideoFlow = async (profileId, userMobileNumber, latestUserState, messageType, messageContent, persona, buttonId) => {
    const nextLesson = await lessonRepository.getNextLesson(
        latestUserState.dataValues.currentCourseId,
        latestUserState.dataValues.currentWeek,
        latestUserState.dataValues.currentDay,
        latestUserState.dataValues.currentLesson_sequence
    );
    
    // Mark previous lesson as completed
    const currentLesson = await lessonRepository.getCurrentLesson(latestUserState.dataValues.currentLessonId);
    await waLessonsCompletedRepository.endLessonByPhoneNumberLessonIdAndProfileId(userMobileNumber, currentLesson.dataValues.LessonId, profileId);
    
    // Get acceptable messages for the next question/lesson
    const acceptableMessagesList = await getAcceptableMessagesList(nextLesson.dataValues.activity);
    
    // Update user progress to next lesson
    await waUserProgressRepository.update(profileId, userMobileNumber, nextLesson.dataValues.courseId,
        nextLesson.dataValues.weekNumber, nextLesson.dataValues.dayNumber, nextLesson.dataValues.LessonId,
        nextLesson.dataValues.SequenceNumber, nextLesson.dataValues.activity, null, 0, acceptableMessagesList);
    const uptodateState = await waUserProgressRepository.getByProfileId(profileId);
    
    // Send next lesson to user
    await sendCourseLesson(profileId, userMobileNumber, uptodateState, nextLesson, messageType, messageContent, persona, buttonId);
};

export { handleVideoFlow };
