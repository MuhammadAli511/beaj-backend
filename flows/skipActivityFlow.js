import { sendButtonMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import course_languages from "../constants/language.js";
import { audio_activities } from "../constants/constants.js";


const skipActivityFlow = async (userMobileNumber, startingLesson, acceptableMessagesList, nextQuestion = null) => {
    let skipActivityMessage = course_languages[startingLesson.dataValues.courseLanguage]["skip_activity_message"];
    let skipActivityButton = course_languages[startingLesson.dataValues.courseLanguage]["skip_activity_button"];

    if (audio_activities.includes(startingLesson.dataValues.activity)) {
        skipActivityMessage = course_languages[startingLesson.dataValues.courseLanguage]["skip_activity_message_audio"];
    }

    if (startingLesson.dataValues.skipOnFirstQuestion == true && nextQuestion && (nextQuestion?.dataValues?.QuestionNumber == 1 || nextQuestion?.dataValues?.questionNumber == 1)) {
        await sendButtonMessage(userMobileNumber, skipActivityMessage, [{ id: "skip", title: skipActivityButton }]);
        await createActivityLog(userMobileNumber, "template", "outbound", skipActivityMessage, null);
        acceptableMessagesList.push("skip");
    }
    else if (startingLesson.dataValues.skipOnEveryQuestion == true) {
        await sendButtonMessage(userMobileNumber, skipActivityMessage, [{ id: "skip", title: skipActivityButton }]);
        await createActivityLog(userMobileNumber, "template", "outbound", skipActivityMessage, null);
        acceptableMessagesList.push("skip");
    }

    return acceptableMessagesList;
};

export default skipActivityFlow;