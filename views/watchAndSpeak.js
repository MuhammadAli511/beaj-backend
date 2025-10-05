import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import { sendMessage, sendButtonMessage, sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import azureBlobStorage from "../utils/azureBlobStorage.js";
import { sleep, extractTranscript, convertNumberToEmoji, getAudioBufferFromAudioFileUrl, getLevelFromCourseName } from "../utils/utils.js";
import speechToText from "../utils/speechToText.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import { createAndUploadScoreImage, createAndUploadScoreImageNoAnswer, createAndUploadKidsScoreImage } from "../utils/imageGenerationUtils.js";
import courseRepository from "../repositories/courseRepository.js";
import { sendAliasAndStartingInstruction } from "../utils/aliasAndInstructionsUtils.js";
import course_languages from "../constants/language.js";
import submitResponseFlow from "../flows/submitResponseFlow.js";
import skipActivityFlow from "../flows/skipActivityFlow.js";

const watchAndSpeakView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                // Send alias and starting instruction
                await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

                // Send first Watch and Speak question
                const firstWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstWatchAndSpeakQuestion.dataValues.questionNumber);

                const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);
                let videoCaptionText = "Q" + firstWatchAndSpeakQuestion.dataValues.questionNumber + " of " + totalQuestions + ":\n\nPuri video dekhein👆🏽. Phir video ke akhri jumley ko ek voice message mein bol kar bhejhein.💬"

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFile, 'video', videoCaptionText, 0, "SpeakActivityQuestion", firstWatchAndSpeakQuestion.dataValues.id, firstWatchAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, "video", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFile, null, videoCaptionText);

                if (firstWatchAndSpeakQuestion.dataValues.mediaFileSecond && firstWatchAndSpeakQuestion.dataValues.mediaFileSecond != null && firstWatchAndSpeakQuestion.dataValues.mediaFileSecond != "" && firstWatchAndSpeakQuestion.dataValues.mediaFileSecond != "null") {
                    await sleep(5000);
                    await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFileSecond, 'image', null, 0, "SpeakActivityQuestion", firstWatchAndSpeakQuestion.dataValues.id, firstWatchAndSpeakQuestion.dataValues.mediaFileSecondMediaId, "mediaFileSecondMediaId");
                    await createActivityLog(userMobileNumber, "image", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFileSecond, null);
                }

                let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], firstWatchAndSpeakQuestion);
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
            }
            else if (messageType === 'audio') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Upload audio
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
            else if (messageContent == 'yes') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                const audioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(profileId, currentWatchAndSpeakQuestion.dataValues.id, currentUserState.dataValues.currentLessonId);
                const audioBuffer = await getAudioBufferFromAudioFileUrl(audioUrl);

                // Azure Pronunciation Assessment
                let pronunciationAssessment = null;
                if (!currentWatchAndSpeakQuestion?.dataValues?.answer?.[0]) {
                    const userTranscription = await speechToText.azureOpenAISpeechToText(audioBuffer);
                    pronunciationAssessment = await speechToText.azurePronunciationAssessment(audioBuffer, userTranscription);
                } else {
                    pronunciationAssessment = await speechToText.azurePronunciationAssessment(audioBuffer, currentWatchAndSpeakQuestion.dataValues.answer[0]);
                }

                // Extract user transcription from words
                const userTranscription = extractTranscript(pronunciationAssessment);

                // Generate pronunciation assessment message
                let imageUrl = null;
                if (!currentWatchAndSpeakQuestion?.dataValues?.answer?.[0]) {
                    imageUrl = await createAndUploadScoreImageNoAnswer(pronunciationAssessment, 70);
                } else {
                    imageUrl = await createAndUploadScoreImage(pronunciationAssessment, 70);
                }

                if (imageUrl) {
                    // Media message
                    await sendMediaMessage(userMobileNumber, imageUrl, 'image', "You said: " + userTranscription);
                    await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null, "You said: " + userTranscription);
                    await sleep(5000);
                }
                const submissionDate = new Date();

                // Update user response to the database
                await waQuestionResponsesRepository.updateReplace(
                    profileId,
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
                    1,
                    submissionDate
                );

                const nextWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel);
                if (nextWatchAndSpeakQuestion) {

                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextWatchAndSpeakQuestion.dataValues.questionNumber);

                    const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);
                    let videoCaptionText = "Q" + nextWatchAndSpeakQuestion.dataValues.questionNumber + " of " + totalQuestions + ":\n\nPuri video dekhein👆🏽. Phir video ke akhri jumley ko ek voice message mein bol kar bhejhein.💬"

                    // Send question media file
                    await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFile, 'video', videoCaptionText, 0, "SpeakActivityQuestion", nextWatchAndSpeakQuestion.dataValues.id, nextWatchAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                    await createActivityLog(userMobileNumber, "video", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFile, null, videoCaptionText);

                    let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], nextWatchAndSpeakQuestion);
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);

                    return;
                } else {
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

                // Send first Watch and Speak question
                const firstWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstWatchAndSpeakQuestion.dataValues.questionNumber);

                const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);

                // Send question media file
                let instructions = "👉 *Question " + await convertNumberToEmoji(firstWatchAndSpeakQuestion.dataValues.questionNumber) + " of " + totalQuestions + "*\n\n";
                instructions += "Record a voice message.";
                await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFile, 'video', instructions, 0, "SpeakActivityQuestion", firstWatchAndSpeakQuestion.dataValues.id, firstWatchAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, "video", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFile, null);

                if (firstWatchAndSpeakQuestion.dataValues.mediaFileSecond && firstWatchAndSpeakQuestion.dataValues.mediaFileSecond != null && firstWatchAndSpeakQuestion.dataValues.mediaFileSecond != "" && firstWatchAndSpeakQuestion.dataValues.mediaFileSecond != "null") {
                    await sleep(5000);
                    await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFileSecond, 'image', null, 0, "SpeakActivityQuestion", firstWatchAndSpeakQuestion.dataValues.id, firstWatchAndSpeakQuestion.dataValues.mediaFileSecondMediaId, "mediaFileSecondMediaId");
                    await createActivityLog(userMobileNumber, "image", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFileSecond, null);
                }

                let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], firstWatchAndSpeakQuestion);
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                return;
            }
            else if (messageType === 'audio') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Upload audio
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio, "audio/ogg");
                const submissionDate = new Date();

                // Check if record already exists for this question

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
            else if (messageContent == 'yes') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                const audioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(profileId, currentWatchAndSpeakQuestion.dataValues.id, currentUserState.dataValues.currentLessonId);
                const audioBuffer = await getAudioBufferFromAudioFileUrl(audioUrl);

                // Azure Pronunciation Assessment
                let pronunciationAssessment = null;
                if (!currentWatchAndSpeakQuestion?.dataValues?.answer?.[0]) {
                    const userTranscription = await speechToText.azureOpenAISpeechToText(audioBuffer);
                    pronunciationAssessment = await speechToText.azurePronunciationAssessment(audioBuffer, userTranscription);
                } else {
                    pronunciationAssessment = await speechToText.azurePronunciationAssessment(audioBuffer, currentWatchAndSpeakQuestion.dataValues.answer[0]);
                }

                // Extract user transcription from words
                const userTranscription = extractTranscript(pronunciationAssessment);

                // Generate pronunciation assessment message
                const courseName = await courseRepository.getCourseNameById(currentUserState.dataValues.currentCourseId);
                let level = getLevelFromCourseName(courseName);
                if (level == 4) {
                    level = 3;
                }

                let imageUrl = await createAndUploadKidsScoreImage(pronunciationAssessment, 70, level);

                if (imageUrl) {
                    // Media message
                    await sendMediaMessage(userMobileNumber, imageUrl, 'image', "You said: " + userTranscription);
                    await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null, "You said: " + userTranscription);
                    await sleep(5000);
                }
                const submissionDate = new Date();

                // Update user response to the database
                await waQuestionResponsesRepository.updateReplace(
                    profileId,
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
                    1,
                    submissionDate
                );

                const nextWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel);
                if (nextWatchAndSpeakQuestion) {

                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextWatchAndSpeakQuestion.dataValues.questionNumber);

                    const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);

                    // Send question media file
                    let instructions = "👉 *Question " + await convertNumberToEmoji(nextWatchAndSpeakQuestion.dataValues.questionNumber) + " of " + totalQuestions + "*\n\n";
                    instructions += "Record a voice message.";
                    await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFile, 'video', instructions, 0, "SpeakActivityQuestion", nextWatchAndSpeakQuestion.dataValues.id, nextWatchAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                    await createActivityLog(userMobileNumber, "video", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFile, null);

                    if (nextWatchAndSpeakQuestion.dataValues.mediaFileSecond && nextWatchAndSpeakQuestion.dataValues.mediaFileSecond != null && nextWatchAndSpeakQuestion.dataValues.mediaFileSecond != "" && nextWatchAndSpeakQuestion.dataValues.mediaFileSecond != "null") {
                        await sleep(5000);
                        await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFileSecond, 'image', null, 0, "SpeakActivityQuestion", nextWatchAndSpeakQuestion.dataValues.id, nextWatchAndSpeakQuestion.dataValues.mediaFileSecondMediaId, "mediaFileSecondMediaId");
                        await createActivityLog(userMobileNumber, "image", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFileSecond, null);
                    }

                    let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], nextWatchAndSpeakQuestion);
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                    return;
                } else {
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
        return;
    } catch (error) {
        console.error('Error sending lesson to user:', error);
        error.fileName = 'watchAndSpeakView.js';
        throw error;
    }
};

export { watchAndSpeakView };
