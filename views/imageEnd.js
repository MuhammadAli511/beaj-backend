import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import { sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { sleep } from "../utils/utils.js";
import documentFileRepository from "../repositories/documentFileRepository.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import { sendAliasAndStartingInstruction } from "../utils/aliasAndInstructionsUtils.js";

const imageEndView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        if (persona == 'teacher') {
            // Lesson Started Record
            await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

            // Send alias and starting instruction
            await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

            // Send image content
            const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
            let imageURL = documentFile[0].dataValues.image;

            // Media message
            await sendMediaMessage(userMobileNumber, imageURL, 'image', null, 0, "DocumentFile", documentFile[0].dataValues.id, documentFile[0].dataValues.imageMediaId, "imageMediaId");
            await createActivityLog(userMobileNumber, "image", "outbound", imageURL, null);

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

            // Send alias and starting instruction
            await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

            // Send image content
            const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
            let imageURL = documentFile[0].dataValues.image;

            // Media message
            await sendMediaMessage(userMobileNumber, imageURL, 'image', null, 0, "DocumentFile", documentFile[0].dataValues.id, documentFile[0].dataValues.imageMediaId, "imageMediaId");
            await createActivityLog(userMobileNumber, "image", "outbound", imageURL, null);

            // Reset Question Number, Retry Counter, and Activity Type
            await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

            // Sleep
            await sleep(5000);

            // Ending Message
            await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
        }
        return;
    } catch (error) {
        console.error('Error sending lesson to user:', error);
        error.fileName = 'imageEndView.js';
        throw error;
    }
};

export { imageEndView };