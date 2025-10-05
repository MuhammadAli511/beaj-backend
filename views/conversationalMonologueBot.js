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
import speechToText from "../utils/speechToText.js";
import textToSpeech from "../utils/textToSpeech.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import { createAndUploadMonologueScoreImage } from "../utils/imageGenerationUtils.js";
import { sendAliasAndStartingInstruction } from "../utils/aliasAndInstructionsUtils.js";
import course_languages from "../constants/language.js";
import submitResponseFlow from "../flows/submitResponseFlow.js";
import skipActivityFlow from "../flows/skipActivityFlow.js";
import skipButtonFlow from "../flows/skipButtonFlow.js";

const conversationalMonologueBotView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.dataValues.currentCourseId, 'Started', new Date(), profileId);

                // Send alias and starting instruction
                await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

                // Send first Conversational Monologue Bot question
                const firstConversationalMonologueBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstConversationalMonologueBotQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstConversationalMonologueBotQuestion.dataValues.mediaFile, 'video', null, 0, "SpeakActivityQuestion", firstConversationalMonologueBotQuestion.dataValues.id, firstConversationalMonologueBotQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, "video", "outbound", firstConversationalMonologueBotQuestion.dataValues.mediaFile, null);

                let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], firstConversationalMonologueBotQuestion);
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
            }
            else if (messageType === 'audio') {
                // Get the current Conversational Monologue Bot question
                const currentConversationalMonologueBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Upload audio
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio, "audio/ogg");
                const submissionDate = new Date();

                const existingAudioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(
                    profileId,
                    currentConversationalMonologueBotQuestion.dataValues.id,
                    currentUserState.dataValues.currentLessonId
                );

                if (existingAudioUrl) {
                    // Update existing record with new audio
                    await waQuestionResponsesRepository.updateReplace(
                        profileId,
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentConversationalMonologueBotQuestion.dataValues.id,
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
                        currentConversationalMonologueBotQuestion.dataValues.id,
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
                // Get the current Conversational Monologue Bot question
                const currentConversationalMonologueBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Get the uploaded audio
                const audioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(profileId, currentConversationalMonologueBotQuestion.dataValues.id, currentUserState.dataValues.currentLessonId);

                // Get audio buffer for processing
                const audioBuffer = await getAudioBufferFromAudioFileUrl(audioUrl);

                // Extract user transcription
                const userTranscription = await speechToText.azureOpenAISpeechToText(audioBuffer);

                let disclaimerAndUserTranscriptionMessage = "This chatbot's speech-to-text may not recognize proper nouns accurately or may skip some words—please bear with us while we improve it.";

                // Text message
                disclaimerAndUserTranscriptionMessage += "\n\nYou said: " + userTranscription;
                await sendMessage(userMobileNumber, disclaimerAndUserTranscriptionMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", disclaimerAndUserTranscriptionMessage, null);

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await speechToText.azurePronunciationAssessment(audioBuffer, userTranscription);

                // Extract mispronounced words
                const mispronouncedWords = extractMispronouncedWords(pronunciationAssessment);

                // Generate pronunciation assessment message
                const imageUrl = await createAndUploadMonologueScoreImage(pronunciationAssessment, 70);

                // Media message
                if (imageUrl) {
                    await sendMediaMessage(userMobileNumber, imageUrl, 'image');
                    await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null);
                    await sleep(5000);
                }

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

                // Update user response to the database with processing results
                const submissionDate = new Date();
                await waQuestionResponsesRepository.updateReplace(
                    profileId,
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentConversationalMonologueBotQuestion.dataValues.id,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    [userTranscription],
                    [audioUrl],
                    [imageUrl],
                    [correctedAudio],
                    [pronunciationAssessment],
                    null,
                    1,
                    submissionDate
                );

                const nextConversationalMonologueBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel);
                if (nextConversationalMonologueBotQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextConversationalMonologueBotQuestion.dataValues.questionNumber);

                    // Send question media file
                    await sendMediaMessage(userMobileNumber, nextConversationalMonologueBotQuestion.dataValues.mediaFile, 'video', null, 0, "SpeakActivityQuestion", nextConversationalMonologueBotQuestion.dataValues.id, nextConversationalMonologueBotQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                    await createActivityLog(userMobileNumber, "video", "outbound", nextConversationalMonologueBotQuestion.dataValues.mediaFile, null);

                    let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], nextConversationalMonologueBotQuestion);
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                } else {
                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

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
                await skipButtonFlow(userMobileNumber, startingLesson);
                return;
            }
        }
        else if (persona == 'kid') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                // Send alias and starting instruction
                await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

                // Send first Conversational Monologue Bot question
                const firstConversationalMonologueBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstConversationalMonologueBotQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstConversationalMonologueBotQuestion.dataValues.mediaFile, 'video', null, 0, "SpeakActivityQuestion", firstConversationalMonologueBotQuestion.dataValues.id, firstConversationalMonologueBotQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, "video", "outbound", firstConversationalMonologueBotQuestion.dataValues.mediaFile, null);

                let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], firstConversationalMonologueBotQuestion);
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
            }
            else if (messageType === 'audio') {
                // Get the current Conversational Monologue Bot question
                const currentConversationalMonologueBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Upload audio
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio, "audio/ogg");
                const submissionDate = new Date();

                const existingAudioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(
                    profileId,
                    currentConversationalMonologueBotQuestion.dataValues.id,
                    currentUserState.dataValues.currentLessonId
                );

                if (existingAudioUrl) {
                    // Update existing record with new audio
                    await waQuestionResponsesRepository.updateReplace(
                        profileId,
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentConversationalMonologueBotQuestion.dataValues.id,
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
                        currentConversationalMonologueBotQuestion.dataValues.id,
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
                // Get the current Conversational Monologue Bot question
                const currentConversationalMonologueBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Get the uploaded audio
                const audioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(profileId, currentConversationalMonologueBotQuestion.dataValues.id, currentUserState.dataValues.currentLessonId);

                // Get audio buffer for processing
                const audioBuffer = await getAudioBufferFromAudioFileUrl(audioUrl);

                // Extract user transcription
                const userTranscription = await speechToText.azureOpenAISpeechToText(audioBuffer);

                let disclaimerAndUserTranscriptionMessage = "This chatbot's speech-to-text may not recognize proper nouns accurately or may skip some words—please bear with us while we improve it.";

                // Text message
                disclaimerAndUserTranscriptionMessage += "\n\nYou said: " + userTranscription;
                await sendMessage(userMobileNumber, disclaimerAndUserTranscriptionMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", disclaimerAndUserTranscriptionMessage, null);

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await speechToText.azurePronunciationAssessment(audioBuffer, userTranscription);

                // Extract mispronounced words
                const mispronouncedWords = extractMispronouncedWords(pronunciationAssessment);

                // Generate pronunciation assessment message
                const imageUrl = await createAndUploadMonologueScoreImage(pronunciationAssessment, 80);

                // Media message
                if (imageUrl) {
                    await sendMediaMessage(userMobileNumber, imageUrl, 'image');
                    await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null);
                    await sleep(5000);
                }

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

                // Update user response to the database with processing results
                const submissionDate = new Date();
                await waQuestionResponsesRepository.updateReplace(
                    profileId,
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentConversationalMonologueBotQuestion.dataValues.id,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    [userTranscription],
                    [audioUrl],
                    [imageUrl],
                    [correctedAudio],
                    [pronunciationAssessment],
                    null,
                    1,
                    submissionDate
                );

                const nextConversationalMonologueBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel);
                if (nextConversationalMonologueBotQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextConversationalMonologueBotQuestion.dataValues.questionNumber);

                    // Send question media file
                    await sendMediaMessage(userMobileNumber, nextConversationalMonologueBotQuestion.dataValues.mediaFile, 'video', null, 0, "SpeakActivityQuestion", nextConversationalMonologueBotQuestion.dataValues.id, nextConversationalMonologueBotQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                    await createActivityLog(userMobileNumber, "video", "outbound", nextConversationalMonologueBotQuestion.dataValues.mediaFile, null);

                    // Update acceptable messages list for the user
                    let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], nextConversationalMonologueBotQuestion);
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                } else {
                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

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
                await skipButtonFlow(userMobileNumber, startingLesson);
                return;
            }
        }
        return;
    } catch (error) {
        console.error('Error sending lesson to user:', error);
        error.fileName = 'conversationalMonologueBotView.js';
        throw error;
    }
};

export { conversationalMonologueBotView };

