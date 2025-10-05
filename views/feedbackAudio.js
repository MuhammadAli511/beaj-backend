import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import { sendMessage, sendButtonMessage, sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import azureBlobStorage from "../utils/azureBlobStorage.js";
import { sleep } from "../utils/utils.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import { sendAliasAndStartingInstruction } from "../utils/aliasAndInstructionsUtils.js";
import course_languages from "../constants/language.js";
import submitResponseFlow from "../flows/submitResponseFlow.js";
import skipActivityFlow from "../flows/skipActivityFlow.js";

const feedbackAudioView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                // Send alias and starting instruction
                await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

                // Send first Listen and Speak question
                const firstListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstListenAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                const mediaType = firstListenAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';
                await sendMediaMessage(userMobileNumber, firstListenAndSpeakQuestion.dataValues.mediaFile, mediaType, null, 0, "SpeakActivityQuestion", firstListenAndSpeakQuestion.dataValues.id, firstListenAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, mediaType, "outbound", firstListenAndSpeakQuestion.dataValues.mediaFile, null);

                let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], firstListenAndSpeakQuestion);
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                return;
            }
            else if (messageType === 'audio') {
                // Get the current Listen and Speak question
                const currentListenAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Uploading user audio to Azure Blob Storage
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio, "audio/ogg");

                // Save user response to the database
                const submissionDate = new Date();
                const retryCounter = currentUserState.dataValues.retryCounter;

                const existingAudioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(
                    profileId,
                    currentListenAndSpeakQuestion.dataValues.id,
                    currentUserState.dataValues.currentLessonId
                );

                if (existingAudioUrl) {
                    // Update existing record with new audio
                    await waQuestionResponsesRepository.updateReplace(
                        profileId,
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentListenAndSpeakQuestion.dataValues.id,
                        activity,
                        startingLesson.dataValues.activityAlias,
                        null,
                        [userAudioFileUrl],
                        null,
                        null,
                        null,
                        null,
                        retryCounter + 1,
                        submissionDate
                    );
                } else {
                    // Create new record if none exists
                    const response = await waQuestionResponsesRepository.create(
                        profileId,
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentListenAndSpeakQuestion.dataValues.id,
                        activity,
                        startingLesson.dataValues.activityAlias,
                        null,
                        [userAudioFileUrl],
                        null,
                        null,
                        null,
                        null,
                        retryCounter + 1,
                        submissionDate
                    );
                    if (!response) {
                        return;
                    }
                }

                await submitResponseFlow(profileId, userMobileNumber, startingLesson);
                return;
            }
            else if (messageContent == 'yes') {
                const nextListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel);
                if (nextListenAndSpeakQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextListenAndSpeakQuestion.dataValues.questionNumber);

                    const mediaType = nextListenAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';

                    await sendMediaMessage(userMobileNumber, nextListenAndSpeakQuestion.dataValues.mediaFile, mediaType, null, 0, "SpeakActivityQuestion", nextListenAndSpeakQuestion.dataValues.id, nextListenAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                    await createActivityLog(userMobileNumber, mediaType, "outbound", nextListenAndSpeakQuestion.dataValues.mediaFile, null);

                    // Update acceptable messages list for the user
                    let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], nextListenAndSpeakQuestion);
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                } else {
                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

                    // ENDING MESSAGE
                    await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
                }
                return;
            }
            else if (messageContent == 'no, try again' || messageContent == 'no') {
                // Send message to try again
                let recordAgainMessage = course_languages[startingLesson.dataValues.courseLanguage]["record_again_message"];
                await sendMessage(userMobileNumber, recordAgainMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", recordAgainMessage, null);

                // Update acceptable messages list for the user
                if (startingLesson.dataValues.skipOnEveryQuestion == true) {
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio", "skip"]);
                } else {
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                }
                return;
            }
        }
        else if (persona == 'kid') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                // Send alias and starting instruction
                await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

                // Send first Listen and Speak question
                const firstListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstListenAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                const mediaType = firstListenAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';
                await sendMediaMessage(userMobileNumber, firstListenAndSpeakQuestion.dataValues.mediaFile, mediaType, null, 0, "SpeakActivityQuestion", firstListenAndSpeakQuestion.dataValues.id, firstListenAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, mediaType, "outbound", firstListenAndSpeakQuestion.dataValues.mediaFile, null);

                let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], firstListenAndSpeakQuestion);
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                return;
            }
            else if (messageType === 'audio') {
                // Get the current Listen and Speak question
                const currentListenAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Uploading user audio to Azure Blob Storage
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio, "audio/ogg");

                // Save user response to the database
                const submissionDate = new Date();
                const retryCounter = currentUserState.dataValues.retryCounter;

                const existingAudioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(
                    profileId,
                    currentListenAndSpeakQuestion.dataValues.id,
                    currentUserState.dataValues.currentLessonId
                );

                if (existingAudioUrl) {
                    // Update existing record with new audio
                    await waQuestionResponsesRepository.updateReplace(
                        profileId,
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentListenAndSpeakQuestion.dataValues.id,
                        activity,
                        startingLesson.dataValues.activityAlias,
                        null,
                        [userAudioFileUrl],
                        null,
                        null,
                        null,
                        null,
                        retryCounter + 1,
                        submissionDate
                    );
                } else {
                    // Create new record if none exists
                    const response = await waQuestionResponsesRepository.create(
                        profileId,
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentListenAndSpeakQuestion.dataValues.id,
                        activity,
                        startingLesson.dataValues.activityAlias,
                        null,
                        [userAudioFileUrl],
                        null,
                        null,
                        null,
                        null,
                        retryCounter + 1,
                        submissionDate
                    );
                    if (!response) {
                        return;
                    }
                }

                await submitResponseFlow(profileId, userMobileNumber, startingLesson);
                return;
            }
            else if (messageContent == 'yes') {
                const nextListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel);
                if (nextListenAndSpeakQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextListenAndSpeakQuestion.dataValues.questionNumber);

                    const mediaType = nextListenAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';

                    await sendMediaMessage(userMobileNumber, nextListenAndSpeakQuestion.dataValues.mediaFile, mediaType, null, 0, "SpeakActivityQuestion", nextListenAndSpeakQuestion.dataValues.id, nextListenAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                    await createActivityLog(userMobileNumber, mediaType, "outbound", nextListenAndSpeakQuestion.dataValues.mediaFile, null);

                    // Update acceptable messages list for the user
                    let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], nextListenAndSpeakQuestion);
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                } else {
                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

                    // ENDING MESSAGE
                    await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
                }
                return;
            }
            else if (messageContent == 'no, try again' || messageContent == 'no') {
                // Send message to try again
                let recordAgainMessage = course_languages[startingLesson.dataValues.courseLanguage]["record_again_message"];
                await sendMessage(userMobileNumber, recordAgainMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", recordAgainMessage, null);

                // Update acceptable messages list for the user
                if (startingLesson.dataValues.skipOnEveryQuestion == true) {
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio", "skip"]);
                } else {
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                }
                return;
            }
        }
    } catch (error) {
        console.error('Error sending lesson to user:', error);
        error.fileName = 'feedbackAudioView.js';
        throw error;
    }
};

export { feedbackAudioView };