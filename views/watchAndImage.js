import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import { sendMessage, sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import azureBlobStorage from "../utils/azureBlobStorage.js";
import { sendAliasAndStartingInstruction } from "../utils/aliasAndInstructionsUtils.js";

const watchAndImageView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                // Send alias and starting instruction
                await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

                // Send first Watch and Image question
                const firstWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstWatchAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFile, 'video', null, 0, "SpeakActivityQuestion", firstWatchAndSpeakQuestion.dataValues.id, firstWatchAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, "video", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFile, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["image"]);
            }
            else if (messageType === 'image') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Save user response to the database
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userImage = `${timestamp}-${uniqueID}-` + "imageFile.jpg";
                const userImageFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userImage, "image/jpeg");
                const submissionDate = new Date();
                const response = await waQuestionResponsesRepository.create(
                    profileId,
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentWatchAndSpeakQuestion.dataValues.id,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    null,
                    [userImageFileUrl],
                    null,
                    null,
                    null,
                    null,
                    1,
                    submissionDate
                );
                if (!response) {
                    return;
                }

                const nextWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel);
                if (nextWatchAndSpeakQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextWatchAndSpeakQuestion.dataValues.questionNumber);

                    // Send question media file
                    await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFile, 'video', null, 0, "SpeakActivityQuestion", nextWatchAndSpeakQuestion.dataValues.id, nextWatchAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                    await createActivityLog(userMobileNumber, "video", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFile, null);
                } else {
                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

                    // ENDING MESSAGE
                    await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
                }
            }
        }
        else if (persona == 'kid') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                // Send alias and starting instruction
                await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

                // Send first Watch and Speak question
                const firstWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstWatchAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFile, 'video', null, 0, "SpeakActivityQuestion", firstWatchAndSpeakQuestion.dataValues.id, firstWatchAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, "video", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFile, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["image"]);
            }
            else if (messageType === 'image') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Save user response to the database
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userImage = `${timestamp}-${uniqueID}-` + "imageFile.jpg";
                const userImageFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userImage, "image/jpeg");
                const submissionDate = new Date();
                const response = await waQuestionResponsesRepository.create(
                    profileId,
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentWatchAndSpeakQuestion.dataValues.id,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    null,
                    [userImageFileUrl],
                    null,
                    null,
                    null,
                    null,
                    1,
                    submissionDate
                );
                if (!response) {
                    return;
                }

                const nextWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel);
                if (nextWatchAndSpeakQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextWatchAndSpeakQuestion.dataValues.questionNumber);

                    // Send question media file
                    await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFile, 'video', null, 0, "SpeakActivityQuestion", nextWatchAndSpeakQuestion.dataValues.id, nextWatchAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                    await createActivityLog(userMobileNumber, "video", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFile, null);
                } else {
                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

                    // ENDING MESSAGE
                    await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
                }
            }
        }
        return;
    } catch (error) {
        console.error('Error sending lesson to user:', error);
        error.fileName = 'watchAndImageView.js';
        throw error;
    }
};


export { watchAndImageView };
