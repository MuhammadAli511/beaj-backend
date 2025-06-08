import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import { sendMessage, sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { sleep } from "../utils/utils.js";
import documentFileRepository from "../repositories/documentFileRepository.js";


const videoView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        if (persona == 'teacher') {
            // Lesson Started Record
            await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

            // Send lesson message
            let defaultTextInstruction = "Watch the video.";
            const lessonTextInstruction = startingLesson.dataValues.textInstruction;
            let finalTextInstruction = defaultTextInstruction;
            if (lessonTextInstruction != null && lessonTextInstruction != "") {
                finalTextInstruction = lessonTextInstruction.replace(/\\n/g, '\n');
            }
            const lessonAudioInstruction = startingLesson.dataValues.audioInstructionUrl;
            if (lessonAudioInstruction != null && lessonAudioInstruction != "") {
                await sendMediaMessage(userMobileNumber, lessonAudioInstruction, 'audio', null, 0, "Lesson", startingLesson.dataValues.LessonId, startingLesson.dataValues.audioInstructionMediaId, "audioInstructionMediaId");
                await createActivityLog(userMobileNumber, "audio", "outbound", lessonAudioInstruction, null);
            }

            let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias.replace(/\\n/g, '\n');;
            lessonMessage += "\n\n" + finalTextInstruction;
            await sendMessage(userMobileNumber, lessonMessage);
            await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

            // Send video content
            const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
            let videoURL = documentFile[0].dataValues.video;

            // Media message
            await sendMediaMessage(userMobileNumber, videoURL, 'video', null, 0, "DocumentFile", documentFile[0].dataValues.id, documentFile[0].dataValues.videoMediaId, "videoMediaId");
            await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null);

            // Sleep
            await sleep(5000);
        }
        else if (persona == 'kid') {
            // Lesson Started Record
            await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);


            let defaultTextInstruction = "Watch the video.";
            const lessonTextInstruction = startingLesson.dataValues.textInstruction;
            let finalTextInstruction = defaultTextInstruction;
            if (lessonTextInstruction != null && lessonTextInstruction != "") {
                finalTextInstruction = lessonTextInstruction.replace(/\\n/g, '\n');
            }
            const lessonAudioInstruction = startingLesson.dataValues.audioInstructionUrl;
            if (lessonAudioInstruction != null && lessonAudioInstruction != "") {
                await sendMediaMessage(userMobileNumber, lessonAudioInstruction, 'audio', null, 0, "Lesson", startingLesson.dataValues.LessonId, startingLesson.dataValues.audioInstructionMediaId, "audioInstructionMediaId");
                await createActivityLog(userMobileNumber, "audio", "outbound", lessonAudioInstruction, null);
            }
            finalTextInstruction += "\n\nThe video might take a few seconds to load.\nویڈیو کو لوڈ ہونے میں شاید چند سیکنڈ لگیں۔";

            let lessonMessage = startingLesson.dataValues.activityAlias;
            lessonMessage += "\n\n" + finalTextInstruction;
            await sendMessage(userMobileNumber, lessonMessage);
            await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

            // Send video content
            const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
            let videoURL = documentFile[0].dataValues.video;

            // Media message
            await sendMediaMessage(userMobileNumber, videoURL, 'video', null, 0, "DocumentFile", documentFile[0].dataValues.id, documentFile[0].dataValues.videoMediaId, "videoMediaId");
            await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null);

            // Sleep
            await sleep(5000);
        }
        return;
    } catch (error) {
        console.log('Error sending lesson to user:', error);
        error.fileName = 'videoView.js';
        throw error;
    }
};

export { videoView };