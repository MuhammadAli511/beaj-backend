import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import { sendMessage } from "./whatsappUtils.js";
import { createActivityLog } from "./createActivityLogUtils.js";


const demoCourseStart = async (profileId, userMobileNumber, startingLesson, courseName) => {
    const courseId = await courseRepository.getCourseIdByName(courseName);
    await waUserProgressRepository.update(
        profileId, userMobileNumber, courseId, startingLesson.dataValues.weekNumber, startingLesson.dataValues.dayNumber, startingLesson.dataValues.LessonId, startingLesson.dataValues.SequenceNumber, startingLesson.dataValues.activity, null, null
    );
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, courseName);

    let persona = "";
    if (courseName == "Free Trial - Teachers") {
        persona = "teacher";
    } else if (courseName == "Free Trial - Kids - Level 1" || courseName == "Free Trial - Kids - Level 3") {
        persona = "kid";
    }
    await waUserProgressRepository.updatePersona(profileId, userMobileNumber, persona);

    // Text Message
    let message = "";
    if (courseName == "Free Trial - Teachers") {
        message = "Great! Let's start your free trial! 🤩 Here is your first lesson.";
        await sendMessage(userMobileNumber, message);
        await createActivityLog(userMobileNumber, "text", "outbound", message, null);
    } else if (courseName == "Free Trial - Kids - Level 1" || courseName == "Free Trial - Kids - Level 3") {
        message = `Great! 💥 Let's Start!\nزبردست! شروع کرتے ہیں!`;
        await sendMessage(userMobileNumber, message);
        await createActivityLog(userMobileNumber, "text", "outbound", message, null);
    }
};



export {
    demoCourseStart,
};