import { default_starting_instruction } from "../constants/constants.js";
import { sendMessage, sendMediaMessage } from "./whatsappUtils.js";
import { createActivityLog } from "./createActivityLogUtils.js";


const sendAliasAndStartingInstruction = async (userMobileNumber, startingLesson) => {
    // Activity Alias and Starting Text Instruction
    let alias = startingLesson.dataValues.activityAlias;
    let lessonMessage = "";
    if (alias != null && alias != "") {
        if (startingLesson.dataValues.courseId == 100) {
            lessonMessage = "Activité: " + alias.replace(/\\n/g, '\n') + "\n\n";
        } else {
            lessonMessage = "Activity: " + alias.replace(/\\n/g, '\n') + "\n\n";
        }
    }

    let lessonTextInstruction = startingLesson.dataValues.textInstruction;
    if (lessonTextInstruction == null || lessonTextInstruction == "") {
        lessonTextInstruction = default_starting_instruction[startingLesson.dataValues.activity];
    }
    lessonTextInstruction = lessonTextInstruction.replace(/\\n/g, '\n');
    lessonMessage += lessonTextInstruction;
    await sendMessage(userMobileNumber, lessonMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

    // Starting Audio Instruction
    let lessonAudioInstruction = startingLesson.dataValues.audioInstructionUrl;
    if (lessonAudioInstruction != null && lessonAudioInstruction != "") {
        await sendMediaMessage(userMobileNumber, lessonAudioInstruction, 'audio', null, 0, "Lesson", startingLesson.dataValues.LessonId, startingLesson.dataValues.audioInstructionMediaId, "audioInstructionMediaId");
        await createActivityLog(userMobileNumber, "audio", "outbound", lessonAudioInstruction, null);
    }
};

export { sendAliasAndStartingInstruction };