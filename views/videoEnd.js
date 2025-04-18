import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import { sendMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { sendMediaMessage } from "../utils/whatsappUtils.js";
import { sleep } from "../utils/utils.js";
import { removeHTMLTags } from "../utils/utils.js";
import documentFileRepository from "../repositories/documentFileRepository.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";


const videoEndView = async (userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            // Lesson Started Record
            await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date());

            // Send lesson message
            let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
            lessonMessage += "\n\n" + removeHTMLTags(startingLesson.dataValues.text);

            // Send video content
            const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
            let videoURL = documentFile[0].dataValues.video;

            // Media message
            await sendMediaMessage(userMobileNumber, videoURL, 'video', lessonMessage);
            await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null, lessonMessage);

            // Sleep
            await sleep(12000);

            // Reset Question Number, Retry Counter, and Activity Type
            await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

            // Ending Message
            await endingMessage(userMobileNumber, currentUserState, startingLesson);
        }
        else if (persona == 'kid') {
            // Lesson Started Record
            await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date());

            // Send lesson message
            let lessonMessage = startingLesson.dataValues.activityAlias + "\n\n" + startingLesson.dataValues.text;

            await sendMessage(userMobileNumber, lessonMessage);
            await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

            // Send video content
            const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
            let videoURL = documentFile[0].dataValues.video;

            // Media message
            await sendMediaMessage(userMobileNumber, videoURL, 'video');
            await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null);

            // Sleep
            await sleep(12000);

            // Reset Question Number, Retry Counter, and Activity Type
            await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

            // Ending Message
            await endingMessage(userMobileNumber, currentUserState, startingLesson);
        }
        return;
    } catch (error) {
        console.log('Error sending lesson to user:', error);
        error.fileName = 'videoEndView.js';
        throw error;
    }
};

export { videoEndView };