import { sendButtonMessage, sendMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import courseRepository from "../repositories/courseRepository.js";
import { beaj_team_numbers } from "../constants/constants.js";


const dayBlockingFlow = async (profileId, userMobileNumber, daysPerWeek, currentUserState, currentUserMetadata, nextLesson, messageContent) => {

    if (
        (daysPerWeek == 5 && currentUserState.dataValues.persona == "kid") ||
        (currentUserMetadata.dataValues.cohort == "Cohort 20" && currentUserState.dataValues.persona == "teacher")
    ) {
        if (!beaj_team_numbers.includes(userMobileNumber)) {
            const course = await courseRepository.getById(
                currentUserState.dataValues.currentCourseId
            );
            let courseStartDate = new Date(course.dataValues.courseStartDate);
            if (currentUserMetadata.dataValues.cohort == "Cohort 20" && currentUserState.dataValues.persona == "teacher") {
                // check course name
                const courseName = await courseRepository.getCourseNameById(currentUserState.dataValues.currentCourseId);
                if (courseName.toLowerCase().includes("level 0") || courseName.toLowerCase().includes("level 1")) {
                    courseStartDate = new Date("August 11, 2025");
                } else if (courseName.toLowerCase().includes("level 2")) {
                    courseStartDate = new Date("September 8, 2025");
                } else if (courseName.toLowerCase().includes("level 3") || courseName.toLowerCase().includes("level 4")) {
                    courseStartDate = new Date("October 6, 2025");
                }
            }
            const today = new Date();

            // Calculate the number of days from the start date needed for the current day's content
            const lessonDayNumber = (nextLesson.dataValues.weekNumber - 1) * daysPerWeek + nextLesson.dataValues.dayNumber;
            const daysRequiredForCurrentLesson = lessonDayNumber - 1; // As before

            // Add days to course start date, skipping Saturdays and Sundays
            let dayUnlockDate = new Date(courseStartDate);
            let daysAdded = 0;

            while (daysAdded < daysRequiredForCurrentLesson) {
                dayUnlockDate.setDate(dayUnlockDate.getDate() + 1);
                if (currentUserMetadata.dataValues.cohort == "Cohort 20") {
                    // Skip weekends: Saturday (6) and Sunday (0)
                    if (dayUnlockDate.getDay() !== 0) {
                        daysAdded++;
                    }
                } else {
                    // Skip weekends: Saturday (6) and Sunday (0)
                    if (dayUnlockDate.getDay() !== 0 && dayUnlockDate.getDay() !== 6) {
                        daysAdded++;
                    }
                }
            }

            // Extract year, month, and date for comparison
            const todayYear = today.getFullYear();
            const todayMonth = today.getMonth();
            const todayDate = today.getDate();

            const dayUnlockDateYear = dayUnlockDate.getFullYear();
            const dayUnlockDateMonth = dayUnlockDate.getMonth();
            const dayUnlockDateDate = dayUnlockDate.getDate();

            // Check if today is before the unlock date
            if (
                todayYear < dayUnlockDateYear ||
                (todayYear == dayUnlockDateYear &&
                    todayMonth < dayUnlockDateMonth) ||
                (todayYear == dayUnlockDateYear &&
                    todayMonth == dayUnlockDateMonth &&
                    todayDate < dayUnlockDateDate)
            ) {
                if (messageContent.toLowerCase().includes("start next lesson")) {
                    if (currentUserMetadata.dataValues.cohort == "Cohort 20" && currentUserState.dataValues.persona == "teacher") {
                        const message = "Please come back tomorrow to unlock the next lesson.";
                        await sendButtonMessage(userMobileNumber, message, [{ id: 'start_next_lesson', title: 'Start Next Lesson' }]);
                        await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Lesson", null);
                    } else {
                        const message = "Please come back tomorrow to unlock the next lesson.";
                        await sendButtonMessage(userMobileNumber, message, [{ id: 'start_next_lesson', title: 'Start Next Lesson' }, { id: 'change_user', title: 'Change User' }]);
                        await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Lesson", null);
                    }
                } else if (messageContent.toLowerCase().includes("start next game")) {
                    const message = "Please come back tomorrow to unlock the next game.";
                    await sendButtonMessage(userMobileNumber, message, [{ id: 'start_next_game', title: 'Start Next Game' }, { id: 'change_user', title: 'Change User' }]);
                    await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Game", null);
                } else {
                    const message = "Please come back tomorrow to unlock the next lesson.";
                    await sendMessage(userMobileNumber, message);
                    await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                }
                return false;
            }
        }
    }
};

export { dayBlockingFlow };