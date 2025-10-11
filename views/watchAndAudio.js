import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import { sendMessage, sendButtonMessage, sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import azureBlobStorage from "../utils/azureBlobStorage.js";
import { sleep, difficultyLevelSelection } from "../utils/utils.js";
import { sendAliasAndStartingInstruction } from "../utils/aliasAndInstructionsUtils.js";
import course_languages from "../constants/language.js";
import submitResponseFlow from "../flows/submitResponseFlow.js";
import skipActivityFlow from "../flows/skipActivityFlow.js";
import skipButtonFlow from "../flows/skipButtonFlow.js";

const watchAndAudioView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                // Difficulty Level Calculation
                const difficultyLevelSelectionResult = await difficultyLevelSelection(profileId, userMobileNumber, currentUserState, messageContent);
                if (!difficultyLevelSelectionResult) {
                    return;
                }

                // Send alias and starting instruction
                await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

                // Send first Watch and Speak question
                const firstWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstWatchAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                const mediaType = firstWatchAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';
                await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFile, mediaType, null, 0, "SpeakActivityQuestion", firstWatchAndSpeakQuestion.dataValues.id, firstWatchAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, mediaType, "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFile, null);

                let secondMediaType = null;
                if (firstWatchAndSpeakQuestion?.dataValues?.mediaFileSecond) {
                    secondMediaType = firstWatchAndSpeakQuestion?.dataValues?.mediaFileSecond?.endsWith('.mp4') ? 'video' : 'audio';
                }

                if (mediaType == 'video' && (secondMediaType != null && secondMediaType != "null" && secondMediaType != "")) {
                    await sleep(5000);
                } else {
                    await sleep(2000);
                }

                if (secondMediaType != null && secondMediaType != "null" && secondMediaType != "") {
                    await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFileSecond, secondMediaType, null, 0, "SpeakActivityQuestion", firstWatchAndSpeakQuestion.dataValues.id, firstWatchAndSpeakQuestion.dataValues.mediaFileSecondMediaId, "mediaFileSecondMediaId");
                    await createActivityLog(userMobileNumber, secondMediaType, "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFileSecond, null);
                }

                let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], firstWatchAndSpeakQuestion);
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
            }
            else if (messageType === 'audio') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel, currentUserState.dataValues.currentTopic);

                // Save user response to the database
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio, "audio/ogg");
                const submissionDate = new Date();

                const existingAudioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(
                    profileId,
                    currentWatchAndSpeakQuestion.dataValues.id,
                    currentUserState.dataValues.currentLessonId
                );

                if (existingAudioUrl) {
                    // Update existing record with new audio
                    await waQuestionResponsesRepository.updateReplace(
                        profileId,
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentWatchAndSpeakQuestion.dataValues.id,
                        activity,
                        startingLesson.dataValues.activityAlias,
                        null,
                        [userAudioFileUrl],
                        null,
                        null,
                        null,
                        null,
                        1,
                        submissionDate
                    );
                } else {
                    // Create new record if none exists
                    const response = await waQuestionResponsesRepository.create(
                        profileId,
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentWatchAndSpeakQuestion.dataValues.id,
                        activity,
                        startingLesson.dataValues.activityAlias,
                        null,
                        [userAudioFileUrl],
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
                }

                await submitResponseFlow(profileId, userMobileNumber, startingLesson);
                return;
            }
            else if (messageContent == 'yes' || messageContent == 'oui') {
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel, currentUserState.dataValues.currentTopic);
                const customFeedbackAudio = currentWatchAndSpeakQuestion?.dataValues?.customFeedbackAudio;
                const customFeedbackText = currentWatchAndSpeakQuestion?.dataValues?.customFeedbackText;
                const customFeedbackImage = currentWatchAndSpeakQuestion?.dataValues?.customFeedbackImage;
                if (customFeedbackAudio) {
                    await sendMediaMessage(userMobileNumber, customFeedbackAudio, 'audio', null, 0, "SpeakActivityQuestion", currentWatchAndSpeakQuestion.dataValues.id, currentWatchAndSpeakQuestion.dataValues.customFeedbackAudioMediaId, "customFeedbackAudioMediaId");
                    await createActivityLog(userMobileNumber, "audio", "outbound", customFeedbackAudio, null);
                    await sleep(2000);
                }
                if (customFeedbackText) {
                    await sendMessage(userMobileNumber, customFeedbackText);
                    await createActivityLog(userMobileNumber, "text", "outbound", customFeedbackText, null);
                    await sleep(1000);
                }
                if (customFeedbackImage && (
                    customFeedbackImage.includes('.png') ||
                    customFeedbackImage.includes('.jpg') ||
                    customFeedbackImage.includes('.jpeg')
                )) {
                    await sendMediaMessage(userMobileNumber, customFeedbackImage, 'image', null, 0, "SpeakActivityQuestion", currentWatchAndSpeakQuestion.dataValues.id, currentWatchAndSpeakQuestion.dataValues.customFeedbackImageMediaId, "customFeedbackImageMediaId");
                    await createActivityLog(userMobileNumber, "image", "outbound", customFeedbackImage, null);
                    await sleep(2000);
                } else if (customFeedbackImage && customFeedbackImage.includes('.webp')) {
                    await sendMediaMessage(userMobileNumber, customFeedbackImage, 'sticker');
                    await createActivityLog(userMobileNumber, "sticker", "outbound", customFeedbackImage);
                    await sleep(1000);
                }

                const nextWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel);
                if (nextWatchAndSpeakQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextWatchAndSpeakQuestion.dataValues.questionNumber);

                    // Send question media file
                    const mediaType = nextWatchAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';
                    await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFile, mediaType, null, 0, "SpeakActivityQuestion", nextWatchAndSpeakQuestion.dataValues.id, nextWatchAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                    await createActivityLog(userMobileNumber, mediaType, "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFile, null);

                    let secondMediaType = null;
                    if (nextWatchAndSpeakQuestion?.dataValues?.mediaFileSecond) {
                        secondMediaType = nextWatchAndSpeakQuestion?.dataValues?.mediaFileSecond?.endsWith('.mp4') ? 'video' : 'audio';
                    }
                    if (mediaType == 'video' && (secondMediaType != null && secondMediaType != "null" && secondMediaType != "")) {
                        await sleep(5000);
                    } else {
                        await sleep(2000);
                    }

                    if (secondMediaType != null && secondMediaType != "null" && secondMediaType != "") {
                        await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFileSecond, secondMediaType, null, 0, "SpeakActivityQuestion", nextWatchAndSpeakQuestion.dataValues.id, nextWatchAndSpeakQuestion.dataValues.mediaFileSecondMediaId, "mediaFileSecondMediaId");
                        await createActivityLog(userMobileNumber, secondMediaType, "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFileSecond, null);
                    }

                    // Update acceptable messages list for the user
                    let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], nextWatchAndSpeakQuestion);
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                } else {
                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null, null);

                    // ENDING MESSAGE
                    await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
                }
                return;
            }
            else if (messageContent == 'no, try again' || messageContent == 'no' || messageContent == 'enregistrez encore') {
                // Send message to try again
                let recordAgainMessage = course_languages[startingLesson.dataValues.courseLanguage]["record_again_message"];
                await sendMessage(userMobileNumber, recordAgainMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", recordAgainMessage, null);

                // Update acceptable messages list for the user
                await skipButtonFlow(profileId, userMobileNumber, startingLesson);
                return;
            }
        }
        else if (persona == 'kid') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                let difficultyList = ["easy", "medium", "hard"];
                if (!difficultyList.includes(messageContent.toLowerCase())) {
                    // Send alias and starting instruction
                    await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);
                }

                // Difficulty Level Calculation
                const difficultyLevelSelectionResult = await difficultyLevelSelection(profileId, userMobileNumber, currentUserState, messageContent);
                if (!difficultyLevelSelectionResult) {
                    return;
                }

                currentUserState = await waUserProgressRepository.getByProfileId(profileId);

                // Send first Watch and Speak question
                const firstWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstWatchAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                const mediaType = firstWatchAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';
                await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFile, mediaType, null, 0, "SpeakActivityQuestion", firstWatchAndSpeakQuestion.dataValues.id, firstWatchAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, mediaType, "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFile, null);

                let secondMediaType = null;
                if (firstWatchAndSpeakQuestion?.dataValues?.mediaFileSecond) {
                    secondMediaType = firstWatchAndSpeakQuestion?.dataValues?.mediaFileSecond?.endsWith('.mp4') ? 'video' : 'audio';
                }
                if (mediaType == 'video' && (secondMediaType != null && secondMediaType != "null" && secondMediaType != "")) {
                    await sleep(5000);
                } else {
                    await sleep(2000);
                }

                if (secondMediaType != null && secondMediaType != "null" && secondMediaType != "") {
                    await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFileSecond, secondMediaType, null, 0, "SpeakActivityQuestion", firstWatchAndSpeakQuestion.dataValues.id, firstWatchAndSpeakQuestion.dataValues.mediaFileSecondMediaId, "mediaFileSecondMediaId");
                    await createActivityLog(userMobileNumber, secondMediaType, "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFileSecond, null);
                }

                let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], firstWatchAndSpeakQuestion);
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
            }
            else if (messageType === 'audio') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel, currentUserState.dataValues.currentTopic);

                // Save user response to the database
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio, "audio/ogg");
                const submissionDate = new Date();

                const existingAudioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(
                    profileId,
                    currentWatchAndSpeakQuestion.dataValues.id,
                    currentUserState.dataValues.currentLessonId
                );

                if (existingAudioUrl) {
                    // Update existing record with new audio
                    await waQuestionResponsesRepository.updateReplace(
                        profileId,
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentWatchAndSpeakQuestion.dataValues.id,
                        activity,
                        startingLesson.dataValues.activityAlias,
                        null,
                        [userAudioFileUrl],
                        null,
                        null,
                        null,
                        null,
                        1,
                        submissionDate
                    );
                } else {
                    // Create new record if none exists
                    const response = await waQuestionResponsesRepository.create(
                        profileId,
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentWatchAndSpeakQuestion.dataValues.id,
                        activity,
                        startingLesson.dataValues.activityAlias,
                        null,
                        [userAudioFileUrl],
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
                }

                await submitResponseFlow(profileId, userMobileNumber, startingLesson);
                return;
            }
            else if (messageContent == 'yes' || messageContent == 'oui') {
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel, currentUserState.dataValues.currentTopic);
                const customFeedbackAudio = currentWatchAndSpeakQuestion?.dataValues?.customFeedbackAudio;
                const customFeedbackText = currentWatchAndSpeakQuestion?.dataValues?.customFeedbackText;
                const customFeedbackImage = currentWatchAndSpeakQuestion?.dataValues?.customFeedbackImage;
                if (customFeedbackAudio) {
                    await sendMediaMessage(userMobileNumber, customFeedbackAudio, 'audio', null, 0, "SpeakActivityQuestion", currentWatchAndSpeakQuestion.dataValues.id, currentWatchAndSpeakQuestion.dataValues.customFeedbackAudioMediaId, "customFeedbackAudioMediaId");
                    await createActivityLog(userMobileNumber, "audio", "outbound", customFeedbackAudio, null);
                    await sleep(2000);
                }
                if (customFeedbackImage && (
                    customFeedbackImage.includes('.png') ||
                    customFeedbackImage.includes('.jpg') ||
                    customFeedbackImage.includes('.jpeg')
                )) {
                    await sendMediaMessage(userMobileNumber, customFeedbackImage, 'image', null, 0, "SpeakActivityQuestion", currentWatchAndSpeakQuestion.dataValues.id, currentWatchAndSpeakQuestion.dataValues.customFeedbackImageMediaId, "customFeedbackImageMediaId");
                    await createActivityLog(userMobileNumber, "image", "outbound", customFeedbackImage, null);
                    await sleep(2000);
                } else if (customFeedbackImage && customFeedbackImage.includes('.webp')) {
                    await sendMediaMessage(userMobileNumber, customFeedbackImage, 'sticker');
                    await createActivityLog(userMobileNumber, "sticker", "outbound", customFeedbackImage);
                    await sleep(1000);
                }
                if (customFeedbackText) {
                    await sendMessage(userMobileNumber, customFeedbackText);
                    await createActivityLog(userMobileNumber, "text", "outbound", customFeedbackText, null);
                    await sleep(1000);
                }

                const nextWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel);
                if (nextWatchAndSpeakQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextWatchAndSpeakQuestion.dataValues.questionNumber);

                    if (currentUserState.dataValues.currentCourseId == 119 || currentUserState.dataValues.currentCourseId == 120) {
                        if (
                            (currentUserState.dataValues.currentWeek == 3 && currentUserState.dataValues.currentDay == 3) ||
                            (currentUserState.dataValues.currentWeek == 3 && currentUserState.dataValues.currentDay == 4) ||
                            (currentUserState.dataValues.currentWeek == 4 && currentUserState.dataValues.currentDay == 3) ||
                            (currentUserState.dataValues.currentWeek == 4 && currentUserState.dataValues.currentDay == 4)
                        ) {
                            if (nextWatchAndSpeakQuestion.dataValues.questionNumber == 9) {
                                // Voice message here
                                let audioMessage = "https://beajbloblive.blob.core.windows.net/beajdocuments/final_instruction_audio1.mp3";
                                await sendMediaMessage(userMobileNumber, audioMessage, 'audio');
                                await createActivityLog(userMobileNumber, "audio", "outbound", audioMessage, null);
                                await sleep(4000);
                            }
                        }
                    }
                    else if (currentUserState.dataValues.currentCourseId != 119 && currentUserState.dataValues.currentCourseId != 120) {
                        if (nextWatchAndSpeakQuestion.dataValues.questionNumber == 7) {
                            // Voice message here
                            let audioMessage = "https://beajbloblive.blob.core.windows.net/beajdocuments/final_instruction_audio1.mp3";
                            await sendMediaMessage(userMobileNumber, audioMessage, 'audio');
                            await createActivityLog(userMobileNumber, "audio", "outbound", audioMessage, null);
                            await sleep(4000);
                        }
                    }

                    // Send question media file
                    const mediaType = nextWatchAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';
                    await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFile, mediaType, null, 0, "SpeakActivityQuestion", nextWatchAndSpeakQuestion.dataValues.id, nextWatchAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                    await createActivityLog(userMobileNumber, mediaType, "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFile, null);

                    let secondMediaType = null;
                    if (nextWatchAndSpeakQuestion?.dataValues?.mediaFileSecond) {
                        secondMediaType = nextWatchAndSpeakQuestion?.dataValues?.mediaFileSecond?.endsWith('.mp4') ? 'video' : 'audio';
                    }
                    if (mediaType == 'video' && (secondMediaType != null && secondMediaType != "null" && secondMediaType != "")) {
                        await sleep(5000);
                    } else {
                        await sleep(2000);
                    }

                    if (secondMediaType != null && secondMediaType != "null" && secondMediaType != "") {
                        await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFileSecond, secondMediaType, null, 0, "SpeakActivityQuestion", nextWatchAndSpeakQuestion.dataValues.id, nextWatchAndSpeakQuestion.dataValues.mediaFileSecondMediaId, "mediaFileSecondMediaId");
                        await createActivityLog(userMobileNumber, secondMediaType, "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFileSecond, null);
                    }

                    if (currentUserState.dataValues.currentCourseId == 119 || currentUserState.dataValues.currentCourseId == 120) {
                        if (
                            (currentUserState.dataValues.currentWeek == 3 && currentUserState.dataValues.currentDay == 3) ||
                            (currentUserState.dataValues.currentWeek == 3 && currentUserState.dataValues.currentDay == 4) ||
                            (currentUserState.dataValues.currentWeek == 4 && currentUserState.dataValues.currentDay == 3) ||
                            (currentUserState.dataValues.currentWeek == 4 && currentUserState.dataValues.currentDay == 4)
                        ) {
                            if (nextWatchAndSpeakQuestion.dataValues.questionNumber == 9) {
                                // Button message
                                await sleep(3000);
                                let skipButtonMessage = "👇 Click on the button below to start the next activity!";
                                await sendButtonMessage(userMobileNumber, skipButtonMessage, [{ id: "next_activity", title: "Next Activity" }]);
                                await createActivityLog(userMobileNumber, "template", "outbound", skipButtonMessage, null);
                            }
                        }
                    } else if (currentUserState.dataValues.currentCourseId != 119 && currentUserState.dataValues.currentCourseId != 120) {
                        if (nextWatchAndSpeakQuestion.dataValues.questionNumber == 7) {
                            // Button message
                            await sleep(3000);
                            let skipButtonMessage = "👇 Click on the button below to start the next activity!";
                            await sendButtonMessage(userMobileNumber, skipButtonMessage, [{ id: "next_activity", title: "Next Activity" }]);
                            await createActivityLog(userMobileNumber, "template", "outbound", skipButtonMessage, null);
                        }
                    }


                    // Update acceptable messages list for the user
                    let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], nextWatchAndSpeakQuestion);
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                } else {
                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null, null);

                    // ENDING MESSAGE
                    await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
                }
                return;
            }
            else if (messageContent == 'no, try again' || messageContent == 'no' || messageContent == 'enregistrez encore') {
                // Send message to try again
                let recordAgainMessage = course_languages[startingLesson.dataValues.courseLanguage]["record_again_message"];
                await sendMessage(userMobileNumber, recordAgainMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", recordAgainMessage, null);

                // Update acceptable messages list for the user
                await skipButtonFlow(profileId, userMobileNumber, startingLesson);
                return;
            }
        }
        return;
    } catch (error) {
        console.error('Error sending lesson to user:', error);
        error.fileName = 'watchAndAudioView.js';
        throw error;
    }
};

export { watchAndAudioView };