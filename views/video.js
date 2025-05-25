import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import { sendMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { sendMediaMessage } from "../utils/whatsappUtils.js";
import { sleep } from "../utils/utils.js";
import { removeHTMLTags } from "../utils/utils.js";
import documentFileRepository from "../repositories/documentFileRepository.js";


const videoView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            // Lesson Started Record
            await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

            // Send lesson message
            let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
            let lessonText = startingLesson.dataValues.text;
            lessonText = lessonText.replace(/\\n/g, '\n');
            lessonMessage += "\n\n" + removeHTMLTags(lessonText);

            // Send video content
            const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
            let videoURL = documentFile[0].dataValues.video;

            // Media message
            await sendMediaMessage(userMobileNumber, videoURL, 'video', lessonMessage, 0, "DocumentFile", documentFile[0].dataValues.id, documentFile[0].dataValues.videoMediaId, "videoMediaId");
            await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null, lessonMessage);

            // Sleep
            await sleep(12000);
        }
        else if (persona == 'kid') {
            // Lesson Started Record
            await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

            // Send lesson message
            let lessonText = startingLesson.dataValues.text;
            lessonText = lessonText.replace(/\\n/g, '\n');
            let lessonMessage = startingLesson.dataValues.activityAlias.replace(/\\n/g, '\n') + "\n\n" + lessonText;
            lessonMessage += "\n\nThe video might take a few seconds to load.\nویڈیو کو لوڈ ہونے میں شاید چند سیکنڈ لگیں۔";

            await sendMessage(userMobileNumber, lessonMessage);
            await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

            // Send video content
            const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
            let videoURL = documentFile[0].dataValues.video;

            // Media message
            await sendMediaMessage(userMobileNumber, videoURL, 'video', null, 0, "DocumentFile", documentFile[0].dataValues.id, documentFile[0].dataValues.videoMediaId, "videoMediaId");
            await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null);

            // Sleep
            await sleep(12000);
        }
        return;
    } catch (error) {
        console.log('Error sending lesson to user:', error);
        error.fileName = 'videoView.js';
        throw error;
    }
};

export { videoView };