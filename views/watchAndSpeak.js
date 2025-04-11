import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import { sendMessage, sendButtonMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { sendMediaMessage } from "../utils/whatsappUtils.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import azureBlobStorage from "../utils/azureBlobStorage.js";
import { sleep, extractTranscript, convertNumberToEmoji, getAudioBufferFromAudioFileUrl } from "../utils/utils.js";
import AIServices from "../utils/AIServices.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import { createAndUploadScoreImage } from "../utils/imageGenerationUtils.js";


const watchAndSpeakView = async (userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\n\nWatch the videos. Then practice speaking by sending voice messages. 💬";
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Watch and Speak question
                const firstWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.questionNumber);

                const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);
                let videoCaptionText = "Question " + firstWatchAndSpeakQuestion.dataValues.questionNumber + " of " + totalQuestions + ":\n\nPuri video dekhein👆🏽. Phir video ke akhri jumley ko ek voice message mein bol kar bhejhein.💬"

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFile, 'video', videoCaptionText);
                await createActivityLog(userMobileNumber, "video", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFile, null, videoCaptionText);

                if (firstWatchAndSpeakQuestion.dataValues.mediaFileSecond) {
                    await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFileSecond, 'image');
                    await createActivityLog(userMobileNumber, "image", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFileSecond, null);
                }

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
            }
            else if (messageType === 'audio') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                const retryCounter = currentUserState.dataValues.retryCounter;
                if (retryCounter == 0 || retryCounter == null) {
                    const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                    const uniqueID = uuidv4();
                    const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                    const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                    const submissionDate = new Date();
                    await waQuestionResponsesRepository.create(
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

                    // Confirmation message asking to retry with yes and no buttons
                    await sendButtonMessage(userMobileNumber, "Submit response? 🧐", [{ id: "yes", title: "Yes" }, { id: "no", title: "No, try again" }]);
                    await createActivityLog(userMobileNumber, "template", "outbound", "Submit response? 🧐", null);

                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["yes", "no", "no, try again"]);
                    return;
                }
                else {
                    // Get the current Watch And Speak question
                    const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                    // Azure Pronunciation Assessment
                    const pronunciationAssessment = await AIServices.azurePronunciationAssessment(messageContent.data, currentWatchAndSpeakQuestion.dataValues.answer[0]);

                    // Extract user transcription from words
                    const userTranscription = extractTranscript(pronunciationAssessment);

                    // Generate pronunciation assessment message
                    const imageUrl = await createAndUploadScoreImage(pronunciationAssessment);

                    if (imageUrl) {
                        // Media message
                        await sendMediaMessage(userMobileNumber, imageUrl, 'image', "You said: " + userTranscription);
                        await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null, "You said: " + userTranscription);
                        await sleep(5000);
                    }

                    const submissionDate = new Date();
                    const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                    const uniqueID = uuidv4();
                    const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                    const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                    // Update user response to the database
                    await waQuestionResponsesRepository.updateReplace(
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentWatchAndSpeakQuestion.dataValues.id,
                        activity,
                        startingLesson.dataValues.activityAlias,
                        [userTranscription],
                        [userAudioFileUrl],
                        [imageUrl],
                        null,
                        [pronunciationAssessment],
                        null,
                        retryCounter + 1,
                        submissionDate
                    );

                    const nextWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                    if (nextWatchAndSpeakQuestion) {
                        // Update acceptable messages list for the user
                        await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                        await waUserProgressRepository.updateRetryCounter(userMobileNumber, 0);

                        // Update question number
                        await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.questionNumber);

                        const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);
                        let videoCaptionText = "Question " + nextWatchAndSpeakQuestion.dataValues.questionNumber + " of " + totalQuestions + ":\n\nPuri video dekhein👆🏽. Phir video ke akhri jumley ko ek voice message mein bol kar bhejhein.💬"

                        // Send question media file
                        await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFile, 'video', videoCaptionText);
                        await createActivityLog(userMobileNumber, "video", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFile, null, videoCaptionText);

                        if (nextWatchAndSpeakQuestion.dataValues.mediaFileSecond) {
                            await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFileSecond, 'image');
                            await createActivityLog(userMobileNumber, "image", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFileSecond, null);
                        }

                    } else {
                        // Reset Question Number, Retry Counter, and Activity Type
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                        // ENDING MESSAGE
                        await endingMessage(userMobileNumber, currentUserState, startingLesson);
                    }
                    return;
                }
            }
            else if (messageContent == 'yes') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                const audioUrl = await waQuestionResponsesRepository.getAudioUrlForPhoneNumberQuestionIdAndLessonId(userMobileNumber, currentWatchAndSpeakQuestion.dataValues.id, currentUserState.dataValues.currentLessonId);
                const audioBuffer = await getAudioBufferFromAudioFileUrl(audioUrl);

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await AIServices.azurePronunciationAssessment(audioBuffer, currentWatchAndSpeakQuestion.dataValues.answer[0]);

                // Extract user transcription from words
                const userTranscription = extractTranscript(pronunciationAssessment);

                // Generate pronunciation assessment message
                const imageUrl = await createAndUploadScoreImage(pronunciationAssessment);

                if (imageUrl) {
                    // Media message
                    await sendMediaMessage(userMobileNumber, imageUrl, 'image', "You said: " + userTranscription);
                    await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null, "You said: " + userTranscription);
                    await sleep(5000);
                }
                const submissionDate = new Date();
                const retryCounter = currentUserState.dataValues.retryCounter;

                // Update user response to the database
                await waQuestionResponsesRepository.updateReplace(
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentWatchAndSpeakQuestion.dataValues.id,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    [userTranscription],
                    [audioUrl],
                    [imageUrl],
                    null,
                    [pronunciationAssessment],
                    null,
                    retryCounter + 1,
                    submissionDate
                );

                const nextWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                if (nextWatchAndSpeakQuestion) {
                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                    await waUserProgressRepository.updateRetryCounter(userMobileNumber, 0);

                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.questionNumber);

                    const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);
                    let videoCaptionText = "Question " + nextWatchAndSpeakQuestion.dataValues.questionNumber + " of " + totalQuestions + ":\n\nPuri video dekhein👆🏽. Phir video ke akhri jumley ko ek voice message mein bol kar bhejhein.💬"

                    // Send question media file
                    await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFile, 'video', videoCaptionText);
                    await createActivityLog(userMobileNumber, "video", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFile, null, videoCaptionText);

                    if (nextWatchAndSpeakQuestion.dataValues.mediaFileSecond) {
                        await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFileSecond, 'image');
                        await createActivityLog(userMobileNumber, "image", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFileSecond, null);
                    }

                    return;
                } else {
                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                    // ENDING MESSAGE
                    await endingMessage(userMobileNumber, currentUserState, startingLesson);
                }
                return;
            }
            else if (messageContent == 'no, try again' || messageContent == 'no') {
                // Send message to try again
                await sendMessage(userMobileNumber, "Okay record your voice message again.");
                await createActivityLog(userMobileNumber, "text", "outbound", "Okay record your voice message again.", null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);

                // Update retry counter
                await waUserProgressRepository.updateRetryCounter(userMobileNumber, currentUserState.dataValues.retryCounter + 1);
                return;
            }
        }
        else if (persona == 'kid') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = startingLesson.dataValues.activityAlias + "\n\n" + startingLesson.dataValues.text;
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Watch and Speak question
                const firstWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.questionNumber);

                const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);

                // Send question media file
                let instructions = "👉 *Question " + await convertNumberToEmoji(firstWatchAndSpeakQuestion.dataValues.questionNumber) + " of " + totalQuestions + "*\n\n";
                instructions += "Record your answer as a voice message";
                if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                    instructions += "\nOR\n" + "Type “next” to skip challenge";
                }
                await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFile, 'video', instructions);
                await createActivityLog(userMobileNumber, "video", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFile, null);

                if (firstWatchAndSpeakQuestion.dataValues.mediaFileSecond) {
                    await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFileSecond, 'image');
                    await createActivityLog(userMobileNumber, "image", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFileSecond, null);
                }

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                return;
            }
            else if (messageType === 'audio') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                const retryCounter = currentUserState.dataValues.retryCounter;
                if (retryCounter == 0 || retryCounter == null) {
                    const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                    const uniqueID = uuidv4();
                    const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                    const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                    const submissionDate = new Date();
                    await waQuestionResponsesRepository.create(
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

                    // Confirmation message asking to retry with yes and no buttons
                    await sendButtonMessage(userMobileNumber, "Submit response? 🧐", [{ id: "yes", title: "Yes" }, { id: "no", title: "No, try again" }]);
                    await createActivityLog(userMobileNumber, "template", "outbound", "Submit response? 🧐", null);

                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["yes", "no", "no, try again"]);
                    return;
                }
                else {
                    // Get the current Watch And Speak question
                    const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                    // Azure Pronunciation Assessment
                    const pronunciationAssessment = await AIServices.azurePronunciationAssessment(messageContent.data, currentWatchAndSpeakQuestion.dataValues.answer[0]);

                    // Extract user transcription from words
                    const userTranscription = extractTranscript(pronunciationAssessment);

                    // Generate pronunciation assessment message
                    const imageUrl = await createAndUploadScoreImage(pronunciationAssessment);

                    if (imageUrl) {
                        // Media message
                        await sendMediaMessage(userMobileNumber, imageUrl, 'image', "You said: " + userTranscription);
                        await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null, "You said: " + userTranscription);
                        await sleep(5000);
                    }

                    const submissionDate = new Date();
                    const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                    const uniqueID = uuidv4();
                    const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                    const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                    // Update user response to the database
                    await waQuestionResponsesRepository.updateReplace(
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentWatchAndSpeakQuestion.dataValues.id,
                        activity,
                        startingLesson.dataValues.activityAlias,
                        [userTranscription],
                        [userAudioFileUrl],
                        [imageUrl],
                        null,
                        [pronunciationAssessment],
                        null,
                        retryCounter + 1,
                        submissionDate
                    );

                    const nextWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                    if (nextWatchAndSpeakQuestion) {
                        // Update acceptable messages list for the user
                        await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                        await waUserProgressRepository.updateRetryCounter(userMobileNumber, 0);

                        // Update question number
                        await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.questionNumber);

                        const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);

                        // Send question media file
                        let instructions = "👉 *Question " + await convertNumberToEmoji(nextWatchAndSpeakQuestion.dataValues.questionNumber) + " of " + totalQuestions + "*\n\n";
                        instructions += "Record your answer as a voice message";
                        if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                            instructions += "\nOR\n" + "Type “next” to skip challenge";
                        }
                        await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFile, 'video', instructions);
                        await createActivityLog(userMobileNumber, "video", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFile, null);

                        if (nextWatchAndSpeakQuestion.dataValues.mediaFileSecond) {
                            await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFileSecond, 'image');
                            await createActivityLog(userMobileNumber, "image", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFileSecond, null);
                        }
                    } else {
                        // Reset Question Number, Retry Counter, and Activity Type
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                        // ENDING MESSAGE
                        await endingMessage(userMobileNumber, currentUserState, startingLesson);
                    }
                    return;
                }
            }
            else if (messageContent == 'yes') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                const audioUrl = await waQuestionResponsesRepository.getAudioUrlForPhoneNumberQuestionIdAndLessonId(userMobileNumber, currentWatchAndSpeakQuestion.dataValues.id, currentUserState.dataValues.currentLessonId);
                const audioBuffer = await getAudioBufferFromAudioFileUrl(audioUrl);

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await AIServices.azurePronunciationAssessment(audioBuffer, currentWatchAndSpeakQuestion.dataValues.answer[0]);

                // Extract user transcription from words
                const userTranscription = extractTranscript(pronunciationAssessment);

                // Generate pronunciation assessment message
                const imageUrl = await createAndUploadScoreImage(pronunciationAssessment);

                if (imageUrl) {
                    // Media message
                    await sendMediaMessage(userMobileNumber, imageUrl, 'image', "You said: " + userTranscription);
                    await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null, "You said: " + userTranscription);
                    await sleep(5000);
                }
                const submissionDate = new Date();
                const retryCounter = currentUserState.dataValues.retryCounter;

                // Update user response to the database
                await waQuestionResponsesRepository.updateReplace(
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentWatchAndSpeakQuestion.dataValues.id,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    [userTranscription],
                    [audioUrl],
                    [imageUrl],
                    null,
                    [pronunciationAssessment],
                    null,
                    retryCounter + 1,
                    submissionDate
                );

                const nextWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                if (nextWatchAndSpeakQuestion) {
                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                    await waUserProgressRepository.updateRetryCounter(userMobileNumber, 0);

                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.questionNumber);

                    const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);

                    // Send question media file
                    let instructions = "👉 *Question " + await convertNumberToEmoji(nextWatchAndSpeakQuestion.dataValues.questionNumber) + " of " + totalQuestions + "*\n\n";
                    instructions += "Record your answer as a voice message";
                    if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                        instructions += "\nOR\n" + "Type “next” to skip challenge";
                    }
                    await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFile, 'video', instructions);
                    await createActivityLog(userMobileNumber, "video", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFile, null);

                    if (nextWatchAndSpeakQuestion.dataValues.mediaFileSecond) {
                        await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFileSecond, 'image');
                        await createActivityLog(userMobileNumber, "image", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFileSecond, null);
                    }
                    return;
                } else {
                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                    // ENDING MESSAGE
                    await endingMessage(userMobileNumber, currentUserState, startingLesson);
                }
                return;
            }
            else if (messageContent == 'no, try again' || messageContent == 'no') {
                // Send message to try again
                await sendMessage(userMobileNumber, "Okay record your voice message again.");
                await createActivityLog(userMobileNumber, "text", "outbound", "Okay record your voice message again.", null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);

                // Update retry counter
                await waUserProgressRepository.updateRetryCounter(userMobileNumber, currentUserState.dataValues.retryCounter + 1);
                return;
            }
        }
        return;
    } catch (error) {
        console.log('Error sending lesson to user:', error);
        error.fileName = 'watchAndSpeakView.js';
        throw error;
    }
};

export { watchAndSpeakView };
