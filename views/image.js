import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import { sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { sleep } from "../utils/utils.js";
import documentFileRepository from "../repositories/documentFileRepository.js";
import { sendAliasAndStartingInstruction } from "../utils/aliasAndInstructionsUtils.js";

const imageView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
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

            // Sleep
            await sleep(5000);
        }
        return;
    } catch (error) {
        console.error('Error sending lesson to user:', error);
        error.fileName = 'imageView.js';
        throw error;
    }
};

export { imageView };