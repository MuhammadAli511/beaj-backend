import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import { sendMessage, sendButtonMessage, sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import azureBlobStorage from "../utils/azureBlobStorage.js";
import { sleep, extractTranscript, convertNumberToEmoji, getAudioBufferFromAudioFileUrl } from "../utils/utils.js";
import AIServices from "../utils/AIServices.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import { createAndUploadScoreImage, createAndUploadScoreImageNoAnswer } from "../utils/imageGenerationUtils.js";


const assessmentWatchAndSpeakView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                let defaultTextInstruction = "Watch the videos. Then practice speaking by sending voice messages. 💬";
                const lessonTextInstruction = startingLesson.dataValues.textInstruction;
                let finalTextInstruction = defaultTextInstruction;
                if (lessonTextInstruction != null && lessonTextInstruction != "") {
                    finalTextInstruction = lessonTextInstruction.replace(/\\n/g, '\n');
                }
                const lessonAudioInstruction = startingLesson.dataValues.audioInstructionUrl;
                if (lessonAudioInstruction != null && lessonAudioInstruction != "") {
                    await sendMediaMessage(userMobileNumber, lessonAudioInstruction, 'audio', null, 0, "Lesson", startingLesson.dataValues.LessonId, startingLesson.dataValues.audioInstructionMediaId, "audioInstructionMediaId");
                    await createActivityLog(userMobileNumber, "audio", "outbound", lessonAudioInstruction, null);
                }

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias.replace(/\\n/g, '\n');
                lessonMessage += "\n\n" + finalTextInstruction;
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Watch and Speak question
                const firstWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstWatchAndSpeakQuestion.dataValues.questionNumber);

                const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);
                let videoCaptionText = "Question " + firstWatchAndSpeakQuestion.dataValues.questionNumber + " of " + totalQuestions + ":\n\nPuri video dekhein👆🏽. Phir video ke akhri jumley ko ek voice message mein bol kar bhejhein.💬"

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFile, 'video', videoCaptionText, 0, "SpeakActivityQuestion", firstWatchAndSpeakQuestion.dataValues.id, firstWatchAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, "video", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFile, null, videoCaptionText);

                if (firstWatchAndSpeakQuestion.dataValues.mediaFileSecond && firstWatchAndSpeakQuestion.dataValues.mediaFileSecond != null && firstWatchAndSpeakQuestion.dataValues.mediaFileSecond != "" && firstWatchAndSpeakQuestion.dataValues.mediaFileSecond != "null") {
                    await sleep(4000);
                    await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFileSecond, 'image', null, 0, "SpeakActivityQuestion", firstWatchAndSpeakQuestion.dataValues.id, firstWatchAndSpeakQuestion.dataValues.mediaFileSecondMediaId, "mediaFileSecondMediaId");
                    await createActivityLog(userMobileNumber, "image", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFileSecond, null);
                }

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
            }
            else if (messageType === 'audio') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Upload audio
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
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
                    await waQuestionResponsesRepository.create(
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
                }

                await sendButtonMessage(userMobileNumber, "Submit response? 🧐", [{ id: "yes", title: "Yes" }, { id: "no", title: "No, try again" }]);
                await createActivityLog(userMobileNumber, "template", "outbound", "Submit response? 🧐", null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["yes", "no", "no, try again"]);
                await sleep(2000);
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
                    const userTranscription = await AIServices.azureOpenAISpeechToText(audioBuffer);
                    pronunciationAssessment = await AIServices.azurePronunciationAssessment(audioBuffer, userTranscription);
                } else {
                    pronunciationAssessment = await AIServices.azurePronunciationAssessment(audioBuffer, currentWatchAndSpeakQuestion.dataValues.answer[0]);
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
                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);

                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextWatchAndSpeakQuestion.dataValues.questionNumber);

                    const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);
                    let videoCaptionText = "Question " + nextWatchAndSpeakQuestion.dataValues.questionNumber + " of " + totalQuestions + ":\n\nPuri video dekhein👆🏽. Phir video ke akhri jumley ko ek voice message mein bol kar bhejhein.💬"

                    // Send question media file
                    await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFile, 'video', videoCaptionText, 0, "SpeakActivityQuestion", nextWatchAndSpeakQuestion.dataValues.id, nextWatchAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                    await createActivityLog(userMobileNumber, "video", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFile, null, videoCaptionText);

                    if (nextWatchAndSpeakQuestion.dataValues.mediaFileSecond && nextWatchAndSpeakQuestion.dataValues.mediaFileSecond != null && nextWatchAndSpeakQuestion.dataValues.mediaFileSecond != "" && nextWatchAndSpeakQuestion.dataValues.mediaFileSecond != "null") {
                        await sleep(4000);
                        await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFileSecond, 'image', null, 0, "SpeakActivityQuestion", nextWatchAndSpeakQuestion.dataValues.id, nextWatchAndSpeakQuestion.dataValues.mediaFileSecondMediaId, "mediaFileSecondMediaId");
                        await createActivityLog(userMobileNumber, "image", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFileSecond, null);
                    }

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

                let defaultTextInstruction = "Listen to the audio and respond to the question by sending a voice message.💬";
                const lessonTextInstruction = startingLesson.dataValues.textInstruction;
                let finalTextInstruction = defaultTextInstruction;
                if (lessonTextInstruction != null && lessonTextInstruction != "") {
                    finalTextInstruction = lessonTextInstruction.replace(/\\n/g, '\n');
                }
                const lessonAudioInstruction = startingLesson.dataValues.audioInstructionUrl;
                if (lessonAudioInstruction != null && lessonAudioInstruction != "") {
                    await sendMediaMessage(userMobileNumber, lessonAudioInstruction, 'audio', null, 0, "Lesson", startingLesson.dataValues.LessonId, startingLesson.dataValues.audioInstructionMediaId, "audioInstructionMediaId");
                    await createActivityLog(userMobileNumber, "audio", "outbound", lessonAudioInstruction, null);
                }

                // Send lesson message
                let lessonMessage = startingLesson.dataValues.activityAlias.replace(/\\n/g, '\n');;
                lessonMessage += "\n\n" + finalTextInstruction;
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Watch and Speak question
                const firstWatchAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstWatchAndSpeakQuestion.dataValues.questionNumber);

                const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);

                // Send question media file
                let instructions = "👉 *Question " + await convertNumberToEmoji(firstWatchAndSpeakQuestion.dataValues.questionNumber) + " of " + totalQuestions + "*\n\n";
                instructions += "Record a voice message.";
                if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                    instructions += "\nOR\n" + "Type *next* to skip this activity!";
                }
                await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFile, 'video', instructions, 0, "SpeakActivityQuestion", firstWatchAndSpeakQuestion.dataValues.id, firstWatchAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, "video", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFile, null);

                if (firstWatchAndSpeakQuestion.dataValues.mediaFileSecond && firstWatchAndSpeakQuestion.dataValues.mediaFileSecond != null && firstWatchAndSpeakQuestion.dataValues.mediaFileSecond != "" && firstWatchAndSpeakQuestion.dataValues.mediaFileSecond != "null") {
                    await sleep(4000);
                    await sendMediaMessage(userMobileNumber, firstWatchAndSpeakQuestion.dataValues.mediaFileSecond, 'image', null, 0, "SpeakActivityQuestion", firstWatchAndSpeakQuestion.dataValues.id, firstWatchAndSpeakQuestion.dataValues.mediaFileSecondMediaId, "mediaFileSecondMediaId");
                    await createActivityLog(userMobileNumber, "image", "outbound", firstWatchAndSpeakQuestion.dataValues.mediaFileSecond, null);
                }

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                return;
            }
            else if (messageType === 'audio') {
                // Get the current Watch And Speak question
                const currentWatchAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Upload audio
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
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
                    await waQuestionResponsesRepository.create(
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
                }

                await sendButtonMessage(userMobileNumber, "Submit response? 🧐", [{ id: "yes", title: "Yes" }, { id: "no", title: "No, try again" }]);
                await createActivityLog(userMobileNumber, "template", "outbound", "Submit response? 🧐", null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["yes", "no", "no, try again"]);
                await sleep(2000);
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
                    const userTranscription = await AIServices.azureOpenAISpeechToText(audioBuffer);
                    pronunciationAssessment = await AIServices.azurePronunciationAssessment(audioBuffer, userTranscription);
                } else {
                    pronunciationAssessment = await AIServices.azurePronunciationAssessment(audioBuffer, currentWatchAndSpeakQuestion.dataValues.answer[0]);
                }

                // Extract user transcription from words
                const userTranscription = extractTranscript(pronunciationAssessment);

                // Generate pronunciation assessment message
                let imageUrl = null;
                if (!currentWatchAndSpeakQuestion?.dataValues?.answer?.[0]) {
                    imageUrl = await createAndUploadScoreImageNoAnswer(pronunciationAssessment, 80);
                } else {
                    imageUrl = await createAndUploadScoreImage(pronunciationAssessment, 80);
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
                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);

                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextWatchAndSpeakQuestion.dataValues.questionNumber);

                    const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);

                    // Send question media file
                    let instructions = "👉 *Question " + await convertNumberToEmoji(nextWatchAndSpeakQuestion.dataValues.questionNumber) + " of " + totalQuestions + "*\n\n";
                    instructions += "Record a voice message.";
                    if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                        instructions += "\nOR\n" + "Type *next* to skip this activity!";
                    }
                    await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFile, 'video', instructions, 0, "SpeakActivityQuestion", nextWatchAndSpeakQuestion.dataValues.id, nextWatchAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                    await createActivityLog(userMobileNumber, "video", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFile, null);

                    if (nextWatchAndSpeakQuestion.dataValues.mediaFileSecond && nextWatchAndSpeakQuestion.dataValues.mediaFileSecond != null && nextWatchAndSpeakQuestion.dataValues.mediaFileSecond != "" && nextWatchAndSpeakQuestion.dataValues.mediaFileSecond != "null") {
                        await sleep(4000);
                        await sendMediaMessage(userMobileNumber, nextWatchAndSpeakQuestion.dataValues.mediaFileSecond, 'image', null, 0, "SpeakActivityQuestion", nextWatchAndSpeakQuestion.dataValues.id, nextWatchAndSpeakQuestion.dataValues.mediaFileSecondMediaId, "mediaFileSecondMediaId");
                        await createActivityLog(userMobileNumber, "image", "outbound", nextWatchAndSpeakQuestion.dataValues.mediaFileSecond, null);
                    }
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
                await sendMessage(userMobileNumber, "Okay record your voice message again.");
                await createActivityLog(userMobileNumber, "text", "outbound", "Okay record your voice message again.", null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                return;
            }
        }
        return;
    } catch (error) {
        console.log('Error sending lesson to user:', error);
        error.fileName = 'assessmentWatchAndSpeak.js';
        throw error;
    }
};

export { assessmentWatchAndSpeakView };
