import { default_starting_instruction, audio_activities } from "../constants/constants.js";
import { sendMessage, sendMediaMessage, sendButtonMessage } from "./whatsappUtils.js";
import { createActivityLog } from "./createActivityLogUtils.js";
import lessonInstructionsService from "../services/lessonInstructionsService.js";

const sendAliasAndStartingInstruction = async (userMobileNumber, startingLesson) => {
    // Activity Alias
    let alias = startingLesson.dataValues.activityAlias;
    let lessonMessage = "";
    if (alias != null && alias != "") {
        lessonMessage = "Activity: " + alias.replace(/\\n/g, '\n') + "\n\n";
    }

    // INSTRUCTIONS
    const instructions = await lessonInstructionsService.getLessonInstructionsService(startingLesson.dataValues.LessonId);


    // Starting Text Instruction
    let textInstruction = instructions.find(
        inst => inst.instructionType === 'text' && inst.position === 'start'
    );
    let lessonTextInstruction = textInstruction?.url;
    if (lessonTextInstruction == null || lessonTextInstruction == "") {
        lessonTextInstruction = default_starting_instruction[startingLesson.dataValues.activity];
    }
    lessonTextInstruction = lessonTextInstruction.replace(/\\n/g, '\n');
    lessonMessage += lessonTextInstruction;
    if (audio_activities.includes(startingLesson.dataValues.activity) && startingLesson.dataValues.skipOnFirstQuestion == true) {
        lessonMessage += "\n\nOR\n\n👇 Click on *'Skip'* to start next activity";
        await sendButtonMessage(userMobileNumber, lessonMessage, [{ id: "skip", title: "Skip" }]);
        await createActivityLog(userMobileNumber, "button", "outbound", lessonMessage, null);
    }
    else {
        await sendMessage(userMobileNumber, lessonMessage);
        await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);
    }

    // Starting Video Instruction
    const videoInstruction = instructions.find(
        inst => inst.instructionType === 'video' && inst.position === 'start'
    );
    if (videoInstruction && videoInstruction.url) {
        let lessonVideoInstruction = videoInstruction.url;
        await sendMediaMessage(userMobileNumber, lessonVideoInstruction, 'video', videoInstruction.caption, 0, "LessonInstructions", videoInstruction.id, videoInstruction.mediaId, "mediaId");
        await createActivityLog(userMobileNumber, "video", "outbound", lessonVideoInstruction, null);
    }

    // Starting Image Instruction
    const imageInstruction = instructions.find(
        inst => inst.instructionType === 'image' && inst.position === 'start'
    );
    if (imageInstruction && imageInstruction.url) {
        let lessonImageInstruction = imageInstruction.url;
        await sendMediaMessage(userMobileNumber, lessonImageInstruction, 'image', imageInstruction.caption, 0, "LessonInstructions", imageInstruction.id, imageInstruction.mediaId, "mediaId");
        await createActivityLog(userMobileNumber, "image", "outbound", lessonImageInstruction, null);
    }

    // Starting PDF Instruction
    const pdfInstruction = instructions.find(
        inst => inst.instructionType === 'pdf' && inst.position === 'start'
    );
    if (pdfInstruction && pdfInstruction.url) {
        let lessonPdfInstruction = pdfInstruction.url;
        await sendMediaMessage(userMobileNumber, lessonPdfInstruction, 'pdf', pdfInstruction.caption, 0, "LessonInstructions", pdfInstruction.id, pdfInstruction.mediaId, "mediaId");
        await createActivityLog(userMobileNumber, "pdf", "outbound", lessonPdfInstruction, null);
    }

    // Starting Audio Instruction
    const audioInstruction = instructions.find(
        inst => inst.instructionType === 'audio' && inst.position === 'start'
    );
    if (audioInstruction && audioInstruction.url) {
        let lessonAudioInstruction = audioInstruction.url;
        await sendMediaMessage(userMobileNumber, lessonAudioInstruction, 'audio', null, 0, "LessonInstructions", audioInstruction.id, audioInstruction.mediaId, "mediaId");
        await createActivityLog(userMobileNumber, "audio", "outbound", lessonAudioInstruction, null);
    }
};

const sendEndingInstruction = async (userMobileNumber, startingLesson) => {
    // INSTRUCTIONS
    const instructions = await lessonInstructionsService.getLessonInstructionsService(startingLesson.dataValues.LessonId);

    // Ending Text Instruction
    let textInstruction = instructions.find(
        inst => inst.instructionType === 'text' && inst.position === 'end'
    );
    let lessonTextInstruction = textInstruction?.url;
    if (lessonTextInstruction != null && lessonTextInstruction != "") {
        lessonTextInstruction = lessonTextInstruction.replace(/\\n/g, '\n');
        await sendMessage(userMobileNumber, lessonTextInstruction);
        await createActivityLog(userMobileNumber, "text", "outbound", lessonTextInstruction, null);
    }


    // Starting Video Instruction
    const videoInstruction = instructions.find(
        inst => inst.instructionType === 'video' && inst.position === 'end'
    );
    if (videoInstruction && videoInstruction.url) {
        let lessonVideoInstruction = videoInstruction.url;
        await sendMediaMessage(userMobileNumber, lessonVideoInstruction, 'video', videoInstruction.caption, 0, "LessonInstructions", videoInstruction.id, videoInstruction.mediaId, "mediaId");
        await createActivityLog(userMobileNumber, "video", "outbound", lessonVideoInstruction, null);
    }

    // Starting Image Instruction
    const imageInstruction = instructions.find(
        inst => inst.instructionType === 'image' && inst.position === 'end'
    );
    if (imageInstruction && imageInstruction.url) {
        let lessonImageInstruction = imageInstruction.url;
        await sendMediaMessage(userMobileNumber, lessonImageInstruction, 'image', imageInstruction.caption, 0, "LessonInstructions", imageInstruction.id, imageInstruction.mediaId, "mediaId");
        await createActivityLog(userMobileNumber, "image", "outbound", lessonImageInstruction, null);
    }

    // Starting PDF Instruction
    const pdfInstruction = instructions.find(
        inst => inst.instructionType === 'pdf' && inst.position === 'end'
    );
    if (pdfInstruction && pdfInstruction.url) {
        let lessonPdfInstruction = pdfInstruction.url;
        await sendMediaMessage(userMobileNumber, lessonPdfInstruction, 'pdf', pdfInstruction.caption, 0, "LessonInstructions", pdfInstruction.id, pdfInstruction.mediaId, "mediaId");
        await createActivityLog(userMobileNumber, "pdf", "outbound", lessonPdfInstruction, null);
    }

    // Starting Audio Instruction
    const audioInstruction = instructions.find(
        inst => inst.instructionType === 'audio' && inst.position === 'end'
    );
    if (audioInstruction && audioInstruction.url) {
        let lessonAudioInstruction = audioInstruction.url;
        await sendMediaMessage(userMobileNumber, lessonAudioInstruction, 'audio', null, 0, "LessonInstructions", audioInstruction.id, audioInstruction.mediaId, "mediaId");
        await createActivityLog(userMobileNumber, "audio", "outbound", lessonAudioInstruction, null);
    }
};

export { sendAliasAndStartingInstruction, sendEndingInstruction };