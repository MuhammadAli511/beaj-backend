import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import { sendMessage, sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { sleep } from "../utils/utils.js";
import documentFileRepository from "../repositories/documentFileRepository.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";


const videoEndView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
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

            // Reset Question Number, Retry Counter, and Activity Type
            await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

            // Ending Message
            await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
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

            // Reset Question Number, Retry Counter, and Activity Type
            await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

            // Sleep
            await sleep(5000);

            // Ending Message
            await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
        }
        return;
    } catch (error) {
        console.log('Error sending lesson to user:', error);
        error.fileName = 'videoEndView.js';
        throw error;
    }
};

export { videoEndView };