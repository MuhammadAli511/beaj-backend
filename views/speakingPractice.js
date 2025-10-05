import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import { sendMessage, sendButtonMessage, sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import azureBlobStorage from "../utils/azureBlobStorage.js";
import { sleep, extractMispronouncedWords, getAudioBufferFromAudioFileUrl } from "../utils/utils.js";
import textToSpeech from "../utils/textToSpeech.js";
import speechToText from "../utils/speechToText.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import { createAndUploadSpeakingPracticeScoreImage } from "../utils/imageGenerationUtils.js";
import courseRepository from "../repositories/courseRepository.js";
import { sendAliasAndStartingInstruction } from "../utils/aliasAndInstructionsUtils.js";
import course_languages from "../constants/language.js";
import submitResponseFlow from "../flows/submitResponseFlow.js";
import skipActivityFlow from "../flows/skipActivityFlow.js";

const speakingPracticeView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                // Send alias and starting instruction
                await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

                // Send first Speaking Practice question
                const firstSpeakingPracticeQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstSpeakingPracticeQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstSpeakingPracticeQuestion.dataValues.mediaFile, 'audio', null, 0, "SpeakActivityQuestion", firstSpeakingPracticeQuestion.dataValues.id, firstSpeakingPracticeQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, "audio", "outbound", firstSpeakingPracticeQuestion.dataValues.mediaFile, null);

                let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], firstSpeakingPracticeQuestion);
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
            }
            else if (messageType === 'audio') {
                // Get the current Speaking Practice question
                const currentSpeakingPracticeQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Upload audio
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio, "audio/ogg");
                const submissionDate = new Date();

                const existingAudioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(
                    profileId,
                    currentSpeakingPracticeQuestion.dataValues.id,
                    currentUserState.dataValues.currentLessonId
                );

                if (existingAudioUrl) {
                    // Update existing record with new audio
                    await waQuestionResponsesRepository.updateReplace(
                        profileId,
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentSpeakingPracticeQuestion.dataValues.id,
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
                        currentSpeakingPracticeQuestion.dataValues.id,
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
                // Get the current Speaking Practice question
                const currentSpeakingPracticeQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Get the uploaded audio
                const audioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(profileId, currentSpeakingPracticeQuestion.dataValues.id, currentUserState.dataValues.currentLessonId);

                // Get audio buffer for processing
                const audioBuffer = await getAudioBufferFromAudioFileUrl(audioUrl);

                // Extract user transcription
                const userTranscription = await speechToText.azureOpenAISpeechToText(audioBuffer);

                let disclaimerAndUserTranscriptionMessage = "This chatbot may not recognize some names accurately or may skip some words—please bear with us as we improve it.";
                disclaimerAndUserTranscriptionMessage += "\n\nYou said: " + userTranscription;
                await sendMessage(userMobileNumber, disclaimerAndUserTranscriptionMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", disclaimerAndUserTranscriptionMessage, null);

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await speechToText.azurePronunciationAssessment(audioBuffer, userTranscription);

                // Update user response to the database with processing results
                const submissionDate = new Date();
                await waQuestionResponsesRepository.updateReplace(
                    profileId,
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentSpeakingPracticeQuestion.dataValues.id,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    [userTranscription],
                    [audioUrl],
                    null,
                    null,
                    [pronunciationAssessment],
                    null,
                    1,
                    submissionDate
                );

                const nextSpeakingPracticeQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel);
                if (nextSpeakingPracticeQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextSpeakingPracticeQuestion.dataValues.questionNumber);

                    // Send question media file
                    await sendMediaMessage(userMobileNumber, nextSpeakingPracticeQuestion.dataValues.mediaFile, 'audio', null, 0, "SpeakActivityQuestion", nextSpeakingPracticeQuestion.dataValues.id, nextSpeakingPracticeQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                    await createActivityLog(userMobileNumber, "audio", "outbound", nextSpeakingPracticeQuestion.dataValues.mediaFile, null);

                    // Update acceptable messages list for the user
                    let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], nextSpeakingPracticeQuestion);
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                } else {
                    const pronunciationAssessments = await waQuestionResponsesRepository.getAllJsonFeedbacksForProfileIdAndLessonId(profileId, currentUserState.dataValues.currentLessonId);
                    const imageUrl = await createAndUploadSpeakingPracticeScoreImage(pronunciationAssessments, 70);

                    // Media message
                    const courseName = await courseRepository.getCourseNameById(currentUserState.dataValues.currentCourseId);
                    const level = courseName.split("-")[0].trim();
                    if (level == "Level 1" || level == "Level 2" || level == "Level 3") {
                        if (imageUrl) {
                            await sendMediaMessage(userMobileNumber, imageUrl, 'image');
                            await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null);
                            await sleep(5000);
                        }

                        let mispronouncedWords = [];
                        for (const assessment of pronunciationAssessments) {
                            const singleMispronouncedWords = extractMispronouncedWords(assessment);
                            mispronouncedWords.push(...singleMispronouncedWords);
                        }
                        mispronouncedWords = [...new Set(mispronouncedWords)];

                        let correctedAudio = "";
                        if (mispronouncedWords.length > 0) {
                            let modelResponse = "It looks like you've mispronounced a few words in your response. Here are the corrections:\n\n";
                            for (const word of mispronouncedWords) {
                                modelResponse += word.Word + (word === mispronouncedWords[mispronouncedWords.length - 1] ? "" : "...");
                            }
                            correctedAudio = await textToSpeech.azureOpenAITextToSpeech(modelResponse);
                            await sendMediaMessage(userMobileNumber, correctedAudio, 'audio');
                            await createActivityLog(userMobileNumber, "audio", "outbound", correctedAudio, null);
                            await sleep(5000);
                        }
                    }


                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

                    // ENDING MESSAGE
                    await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
                }
                return;
            }
            else if (messageContent == 'no, try again' || messageContent == 'no') {
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

                // Send first Speaking Practice question
                const firstSpeakingPracticeQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstSpeakingPracticeQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstSpeakingPracticeQuestion.dataValues.mediaFile, 'audio', null, 0, "SpeakActivityQuestion", firstSpeakingPracticeQuestion.dataValues.id, firstSpeakingPracticeQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, "audio", "outbound", firstSpeakingPracticeQuestion.dataValues.mediaFile, null);

                let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], firstSpeakingPracticeQuestion);
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
            }
            else if (messageType === 'audio') {
                // Get the current Speaking Practice question
                const currentSpeakingPracticeQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Upload audio
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio, "audio/ogg");
                const submissionDate = new Date();

                const existingAudioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(
                    profileId,
                    currentSpeakingPracticeQuestion.dataValues.id,
                    currentUserState.dataValues.currentLessonId
                );

                if (existingAudioUrl) {
                    // Update existing record with new audio
                    await waQuestionResponsesRepository.updateReplace(
                        profileId,
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentSpeakingPracticeQuestion.dataValues.id,
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
                        currentSpeakingPracticeQuestion.dataValues.id,
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
                // Get the current Speaking Practice question
                const currentSpeakingPracticeQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Get the uploaded audio
                const audioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(profileId, currentSpeakingPracticeQuestion.dataValues.id, currentUserState.dataValues.currentLessonId);

                // Get audio buffer for processing
                const audioBuffer = await getAudioBufferFromAudioFileUrl(audioUrl);

                // Extract user transcription
                const userTranscription = await speechToText.azureOpenAISpeechToText(audioBuffer);

                let disclaimerAndUserTranscriptionMessage = "Agar hamara chatbot aap ka naam ghalat likhay, ya kuch alfaaz skip karay, tau we are sorry! Hum iss ko roz behtar kar rahay hain!";
                disclaimerAndUserTranscriptionMessage += "\n\nYou said: " + userTranscription;
                await sendMessage(userMobileNumber, disclaimerAndUserTranscriptionMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", disclaimerAndUserTranscriptionMessage, null);

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await speechToText.azurePronunciationAssessment(audioBuffer, userTranscription);

                // Update user response to the database with processing results
                const submissionDate = new Date();
                await waQuestionResponsesRepository.updateReplace(
                    profileId,
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentSpeakingPracticeQuestion.dataValues.id,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    [userTranscription],
                    [audioUrl],
                    null,
                    null,
                    [pronunciationAssessment],
                    null,
                    1,
                    submissionDate
                );

                const nextSpeakingPracticeQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel);
                if (nextSpeakingPracticeQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextSpeakingPracticeQuestion.dataValues.questionNumber);

                    // Send question media file
                    await sendMediaMessage(userMobileNumber, nextSpeakingPracticeQuestion.dataValues.mediaFile, 'audio', null, 0, "SpeakActivityQuestion", nextSpeakingPracticeQuestion.dataValues.id, nextSpeakingPracticeQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                    await createActivityLog(userMobileNumber, "audio", "outbound", nextSpeakingPracticeQuestion.dataValues.mediaFile, null);

                    // Update acceptable messages list for the user
                    let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], nextSpeakingPracticeQuestion);
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
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
                        correctedAudio = await textToSpeech.azureOpenAITextToSpeech(modelResponse);
                        await sendMediaMessage(userMobileNumber, correctedAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", correctedAudio, null);
                        await sleep(5000);
                    }


                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

                    // ENDING MESSAGE
                    await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
                }
                return;
            }
            else if (messageContent == 'no, try again' || messageContent == 'no') {
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
        error.fileName = 'speakingPracticeView.js';
        throw error;
    }
};

export { speakingPracticeView };