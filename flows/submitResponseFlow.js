import { sendButtonMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import { sleep } from "../utils/utils.js";
import course_languages from "../constants/language.js";


const submitResponseFlow = async (profileId, userMobileNumber, startingLesson) => {
    let submitResponseMessage = course_languages[startingLesson.dataValues.courseLanguage]["submit_response_message"];
    let yes = course_languages[startingLesson.dataValues.courseLanguage]["yes"];
    let no = course_languages[startingLesson.dataValues.courseLanguage]["no"];


    await sendButtonMessage(userMobileNumber, submitResponseMessage, [{ id: "yes", title: yes }, { id: "no", title: no }]);
    await createActivityLog(userMobileNumber, "template", "outbound", submitResponseMessage, null);

    // Update acceptable messages list for the user
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, [yes.toLowerCase(), no.toLowerCase()]);
    await sleep(2000);
};

export default submitResponseFlow;