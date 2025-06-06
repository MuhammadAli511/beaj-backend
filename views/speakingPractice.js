import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import { sendMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { sendMediaMessage } from "../utils/whatsappUtils.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import azureBlobStorage from "../utils/azureBlobStorage.js";
import { sleep } from "../utils/utils.js";
import AIServices from "../utils/AIServices.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import { createAndUploadSpeakingPracticeScoreImage } from "../utils/imageGenerationUtils.js";
import { extractMispronouncedWords } from "../utils/utils.js";

const speakingPracticeView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\n\nListen to the audio and respond to the question by sending a voice message.💬";
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Speaking Practice question
                const firstSpeakingPracticeQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstSpeakingPracticeQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstSpeakingPracticeQuestion.dataValues.mediaFile, 'audio', null, 0, "SpeakActivityQuestion", firstSpeakingPracticeQuestion.dataValues.id, firstSpeakingPracticeQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, "audio", "outbound", firstSpeakingPracticeQuestion.dataValues.mediaFile, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
            }
            else if (messageType === 'audio') {
                // Get the current Speaking Practice question
                const currentSpeakingPracticeQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Extract user transcription
                const userTranscription = await AIServices.openaiSpeechToText(messageContent.data);

                let disclaimerAndUserTranscriptionMessage = "This chatbot's speech-to-text may not recognize proper nouns accurately or may skip some words—please bear with us while we improve it.";
                disclaimerAndUserTranscriptionMessage += "\n\nYou said: " + userTranscription;
                await sendMessage(userMobileNumber, disclaimerAndUserTranscriptionMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", disclaimerAndUserTranscriptionMessage, null);

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await AIServices.azurePronunciationAssessment(messageContent.data, userTranscription);

                // Save user response to the database
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                const submissionDate = new Date();
                await waQuestionResponsesRepository.create(
                    profileId,
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentSpeakingPracticeQuestion.dataValues.id,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    [userTranscription],
                    [userAudioFileUrl],
                    null,
                    null,
                    [pronunciationAssessment],
                    null,
                    1,
                    submissionDate
                );

                const nextSpeakingPracticeQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                if (nextSpeakingPracticeQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextSpeakingPracticeQuestion.dataValues.questionNumber);

                    // Send question media file
                    await sendMediaMessage(userMobileNumber, nextSpeakingPracticeQuestion.dataValues.mediaFile, 'audio', null, 0, "SpeakActivityQuestion", nextSpeakingPracticeQuestion.dataValues.id, nextSpeakingPracticeQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                    await createActivityLog(userMobileNumber, "audio", "outbound", nextSpeakingPracticeQuestion.dataValues.mediaFile, null);
                } else {
                    const pronunciationAssessments = await waQuestionResponsesRepository.getAllJsonFeedbacksForProfileIdAndLessonId(profileId, currentUserState.dataValues.currentLessonId);
                    const imageUrl = await createAndUploadSpeakingPracticeScoreImage(pronunciationAssessments, 70);

                    // Media message
                    if (imageUrl) {
                        await sendMediaMessage(userMobileNumber, imageUrl, 'image');
                        await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null);
                        await sleep(5000);
                    }

                    // Extract mispronounced words in a loop using pronunciationAssessments and extractMispronouncedWords function
                    let mispronouncedWords = [];
                    for (const assessment of pronunciationAssessments) {
                        const singleMispronouncedWords = extractMispronouncedWords(assessment);
                        mispronouncedWords.push(...singleMispronouncedWords);
                    }

                    // Remove duplicates from mispronouncedWords
                    mispronouncedWords = [...new Set(mispronouncedWords)];


                    let correctedAudio = "";
                    if (mispronouncedWords.length > 0) {
                        let modelResponse = "It looks like you've mispronounced a few words in your response. Here are the corrections:\n\n";
                        for (const word of mispronouncedWords) {
                            modelResponse += word.Word + (word === mispronouncedWords[mispronouncedWords.length - 1] ? "" : "...");
                        }
                        correctedAudio = await AIServices.openaiTextToSpeechAndUpload(modelResponse);
                        await sendMediaMessage(userMobileNumber, correctedAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", correctedAudio, null);
                        await sleep(5000);
                    }


                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null);

                    // ENDING MESSAGE
                    await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
                }
            }
        }
        else if (persona == 'kid') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\n\nListen to the audio and respond to the question by sending a voice message.💬";
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Speaking Practice question
                const firstSpeakingPracticeQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstSpeakingPracticeQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstSpeakingPracticeQuestion.dataValues.mediaFile, 'audio', null, 0, "SpeakActivityQuestion", firstSpeakingPracticeQuestion.dataValues.id, firstSpeakingPracticeQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, "audio", "outbound", firstSpeakingPracticeQuestion.dataValues.mediaFile, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
            }
            else if (messageType === 'audio') {
                // Get the current Speaking Practice question
                const currentSpeakingPracticeQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Extract user transcription
                const userTranscription = await AIServices.openaiSpeechToText(messageContent.data);

                let disclaimerAndUserTranscriptionMessage = "This chatbot's speech-to-text may not recognize proper nouns accurately or may skip some words—please bear with us while we improve it.";
                disclaimerAndUserTranscriptionMessage += "\n\nYou said: " + userTranscription;
                await sendMessage(userMobileNumber, disclaimerAndUserTranscriptionMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", disclaimerAndUserTranscriptionMessage, null);

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await AIServices.azurePronunciationAssessment(messageContent.data, userTranscription);

                // Save user response to the database
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                const submissionDate = new Date();
                await waQuestionResponsesRepository.create(
                    profileId,
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentSpeakingPracticeQuestion.dataValues.id,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    [userTranscription],
                    [userAudioFileUrl],
                    null,
                    null,
                    [pronunciationAssessment],
                    null,
                    1,
                    submissionDate
                );

                const nextSpeakingPracticeQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                if (nextSpeakingPracticeQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextSpeakingPracticeQuestion.dataValues.questionNumber);

                    // Send question media file
                    await sendMediaMessage(userMobileNumber, nextSpeakingPracticeQuestion.dataValues.mediaFile, 'audio', null, 0, "SpeakActivityQuestion", nextSpeakingPracticeQuestion.dataValues.id, nextSpeakingPracticeQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                    await createActivityLog(userMobileNumber, "audio", "outbound", nextSpeakingPracticeQuestion.dataValues.mediaFile, null);
                } else {
                    const pronunciationAssessments = await waQuestionResponsesRepository.getAllJsonFeedbacksForProfileIdAndLessonId(profileId, currentUserState.dataValues.currentLessonId);
                    const imageUrl = await createAndUploadSpeakingPracticeScoreImage(pronunciationAssessments, 80);

                    // Media message
                    if (imageUrl) {
                        await sendMediaMessage(userMobileNumber, imageUrl, 'image');
                        await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null);
                        await sleep(5000);
                    }

                    // Extract mispronounced words in a loop using pronunciationAssessments and extractMispronouncedWords function
                    let mispronouncedWords = [];
                    for (const assessment of pronunciationAssessments) {
                        const singleMispronouncedWords = extractMispronouncedWords(assessment);
                        mispronouncedWords.push(...singleMispronouncedWords);
                    }

                    // Remove duplicates from mispronouncedWords
                    mispronouncedWords = [...new Set(mispronouncedWords)];


                    let correctedAudio = "";
                    if (mispronouncedWords.length > 0) {
                        let modelResponse = "It looks like you've mispronounced a few words in your response. Here are the corrections:\n\n";
                        for (const word of mispronouncedWords) {
                            modelResponse += word.Word + (word === mispronouncedWords[mispronouncedWords.length - 1] ? "" : "...");
                        }
                        correctedAudio = await AIServices.openaiTextToSpeechAndUpload(modelResponse);
                        await sendMediaMessage(userMobileNumber, correctedAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", correctedAudio, null);
                        await sleep(5000);
                    }


                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null);

                    // ENDING MESSAGE
                    await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
                }
            }
        }
        return;
    } catch (error) {
        console.log('Error sending lesson to user:', error);
        error.fileName = 'speakingPracticeView.js';
        throw error;
    }
};

export { speakingPracticeView };