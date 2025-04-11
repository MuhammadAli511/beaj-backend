import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waFeedbackRepository from "../repositories/waFeedbackRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";

const createFeedback = async (
    phoneNumber,
    feedbackContent
) => {
    const userCurrentProgress = await waUserProgressRepository.getByPhoneNumber(
        phoneNumber
    );

    const userAcceptableList = userCurrentProgress.acceptableMessages || [];
    if (userAcceptableList.includes("start next activity")) {
        await waUserProgressRepository.updateAcceptableMessagesList(phoneNumber, ["start next activity"]);
    } else if (userAcceptableList.includes("start next lesson")) {
        await waUserProgressRepository.updateAcceptableMessagesList(phoneNumber, ["start next lesson"]);
    }

    let courseId = null,
        lessonId = null,
        weekNumber = null,
        dayNumber = null,
        activityType = null;

    if (userCurrentProgress) {
        courseId = userCurrentProgress.currentCourseId || null;
        lessonId = userCurrentProgress.currentLessonId || null;
        weekNumber = userCurrentProgress.currentWeek || null;
        dayNumber = userCurrentProgress.currentDay || null;
        activityType = await lessonRepository.getActivityByLessonId(lessonId);
    }

    await waFeedbackRepository.create({
        phoneNumber: phoneNumber,
        feedbackContent: feedbackContent,
        courseId: courseId,
        lessonId: lessonId,
        weekNumber: weekNumber,
        dayNumber: dayNumber,
        activityType: activityType,
    });

    return;

};

export { createFeedback };