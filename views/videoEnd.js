import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import { sendMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { sendMediaMessage } from "../utils/whatsappUtils.js";
import { sleep } from "../utils/utils.js";
import { removeHTMLTags } from "../utils/utils.js";
import documentFileRepository from "../repositories/documentFileRepository.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";


const videoEndView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
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
            await sleep(5000);

            // Reset Question Number, Retry Counter, and Activity Type
            await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null);

            // Ending Message
            await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
        }
        else if (persona == 'kid') {
            // Lesson Started Record
            await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

            // Send lesson message
            let lessonText = startingLesson.dataValues.text;
            lessonText = lessonText.replace(/\\n/g, '\n');
            let lessonMessage = startingLesson.dataValues.activityAlias;
            if (lessonText != null && lessonText != "") {
                lessonMessage += "\n\n" + lessonText;
            }
            lessonMessage += "\n\nThe video might take a few seconds to load.\nویڈیو کو لوڈ ہونے میں شاید چند سیکنڈ لگیں۔";

            await sendMessage(userMobileNumber, lessonMessage);
            await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

            // Send video content
            const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
            let videoURL = documentFile[0].dataValues.video;

            // Media message
            await sendMediaMessage(userMobileNumber, videoURL, 'video', null, 0, "DocumentFile", documentFile[0].dataValues.id, documentFile[0].dataValues.videoMediaId, "videoMediaId");
            await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null);

            // Reset Question Number, Retry Counter, and Activity Type
            await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null);

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