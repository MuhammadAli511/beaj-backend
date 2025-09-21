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
import { sleep, difficultyLevelCalculation } from "../utils/utils.js";
import { sendAliasAndStartingInstruction } from "../utils/aliasAndInstructionsUtils.js";

const watchAndAudioView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                // Difficulty Level Calculation
                const difficultyLevelCalculationResult = await difficultyLevelCalculation(profileId, userMobileNumber, currentUserState, messageContent);
                if (!difficultyLevelCalculationResult) {
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

                // Update acceptable messages list for the user
                if (startingLesson.dataValues.skipOnFirstQuestion == true && firstWatchAndSpeakQuestion.dataValues.questionNumber == 1) {
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio", "skip"]);
                } else {
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                }
            }
            else if (messageType === 'audio') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

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

                await sendButtonMessage(userMobileNumber, "Submit response? 🧐", [{ id: "yes", title: "Yes" }, { id: "no", title: "No, try again" }]);
                await createActivityLog(userMobileNumber, "template", "outbound", "Submit response? 🧐", null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["yes", "no", "no, try again"]);
                await sleep(2000);
                return;
            }
            else if (messageContent == 'yes') {
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                const customFeedbackAudio = currentWatchAndSpeakQuestion.dataValues.customFeedbackAudio;
                if (customFeedbackAudio) {
                    await sendMediaMessage(userMobileNumber, customFeedbackAudio, 'audio', null, 0, "SpeakActivityQuestion", currentWatchAndSpeakQuestion.dataValues.id, currentWatchAndSpeakQuestion.dataValues.customFeedbackAudioMediaId, "customFeedbackAudioMediaId");
                    await createActivityLog(userMobileNumber, "audio", "outbound", customFeedbackAudio, null);
                    await sleep(2000);
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
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
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
                await sendMessage(userMobileNumber, "Okay record your voice message again.");
                await createActivityLog(userMobileNumber, "text", "outbound", "Okay record your voice message again.", null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
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
                const difficultyLevelCalculationResult = await difficultyLevelCalculation(profileId, userMobileNumber, currentUserState, messageContent);
                if (!difficultyLevelCalculationResult) {
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

                // Update acceptable messages list for the user
                if (startingLesson.dataValues.skipOnFirstQuestion == true && firstWatchAndSpeakQuestion.dataValues.questionNumber == 1) {
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio", "skip"]);
                } else {
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                }
            }
            else if (messageType === 'audio') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

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

                await sendButtonMessage(userMobileNumber, "Submit response? 🧐", [{ id: "yes", title: "Yes" }, { id: "no", title: "No, try again" }]);
                await createActivityLog(userMobileNumber, "template", "outbound", "Submit response? 🧐", null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["yes", "no", "no, try again"]);
                await sleep(2000);
                return;
            }
            else if (messageContent == 'yes') {
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                const customFeedbackAudio = currentWatchAndSpeakQuestion.dataValues.customFeedbackAudio;
                if (customFeedbackAudio) {
                    await sendMediaMessage(userMobileNumber, customFeedbackAudio, 'audio', null, 0, "SpeakActivityQuestion", currentWatchAndSpeakQuestion.dataValues.id, currentWatchAndSpeakQuestion.dataValues.customFeedbackAudioMediaId, "customFeedbackAudioMediaId");
                    await createActivityLog(userMobileNumber, "audio", "outbound", customFeedbackAudio, null);
                    await sleep(2000);
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
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
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
                await sendMessage(userMobileNumber, "Okay record your voice message again.");
                await createActivityLog(userMobileNumber, "text", "outbound", "Okay record your voice message again.", null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
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