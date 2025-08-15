import { sendButtonMessage, sendMediaMessage, sendMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { sleep } from "../utils/utils.js";
import { getDaysPerWeek, getTotalLessonsForCourse } from "../utils/utils.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import { endingMessage } from "../utils/endingMessageUtils.js";


const courseEndingFlow = async (profileId, userMobileNumber, currentUserState) => {
    if (currentUserState.dataValues.engagement_type == "Free Trial - Teachers" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
        await endingMessage(profileId, userMobileNumber, currentUserState, theStartingLesson);
        return;
    }
    const daysPerWeek = await getDaysPerWeek(profileId);
    const lessonNumberCheck = (currentUserState.dataValues.currentWeek - 1) * daysPerWeek + currentUserState.dataValues.currentDay;
    let totalLessons = 0;
    let courseName = await courseRepository.getCourseNameById(currentUserState.dataValues.currentCourseId);
    if (courseName.toLowerCase().includes("assessment")) {
        if (courseName.toLowerCase().includes("level 4")) {
            totalLessons = 2;
        } else {
            totalLessons = 3;
        }
    } else if (courseName.toLowerCase().includes("level 0") || courseName.toLowerCase().includes("level 4")) {
        totalLessons = 1;
    } else {
        totalLessons = await getTotalLessonsForCourse(profileId);
    }
    if (lessonNumberCheck >= totalLessons) {
        if (
            (totalLessons == 3 && courseName.toLowerCase().includes("assessment")) ||
            (totalLessons == 2 && courseName.toLowerCase().includes("assessment") && courseName.toLowerCase().includes("level 4"))
        ) {
            await sendButtonMessage(userMobileNumber, 'Click on Start Now! 👇', [{ id: 'start_now', title: 'Start Now!' }, { id: 'change_user', title: 'Change User' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Click on Start Now! 👇", null);
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start now!", "change user"]);
            return;
        } else {
            // if teacher
            if (currentUserState.dataValues.persona == "teacher") {
                if (courseName.toLowerCase().includes("level 3")) {
                    const audioUrl = "https://beajbloblive.blob.core.windows.net/beajdocuments/complete_final_task.mp3";
                    await sendMediaMessage(userMobileNumber, audioUrl, 'audio', null);
                    await createActivityLog(userMobileNumber, "audio", "outbound", audioUrl, null);
                    await sleep(3000);
                    await sendButtonMessage(userMobileNumber, 'Click on the button below to complete the final task and get your certificate', [{ id: 'complete_final_task', title: 'Complete Final Task' }]);
                    await createActivityLog(userMobileNumber, "template", "outbound", "Click on the button below to complete the final task and get your certificate", null);
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["complete final task"]);
                    return;
                } else {
                    await sendButtonMessage(userMobileNumber, 'You have completed all the lessons in this course. Click the button below to proceed', [{ id: 'start_next_level', title: 'Start Next Level' }]);
                    await createActivityLog(userMobileNumber, "template", "outbound", "You have completed all the lessons in this course. Click the button below to proceed", null);
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start next level"]);
                    return;
                }
            } else {
                let finalKidsMessage = "This is the end of your Beaj Summer Camp!\n\nWe thank you for becoming a part of the Beaj family! 🤩";
                await sendButtonMessage(userMobileNumber, finalKidsMessage, [{ id: 'change_user', title: 'Change User' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", finalKidsMessage, null);
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["change user"]);
                return;
            }
        }
    }
    await sendMessage(userMobileNumber, "Please wait for the next lesson to start.");
    await createActivityLog(userMobileNumber, "text", "outbound", "Please wait for the next lesson to start.", null);
    return;
};

export { courseEndingFlow };