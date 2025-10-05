import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import { sendMessage, sendButtonMessage, sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import azureBlobStorage from "../utils/azureBlobStorage.js";
import { sleep, getAudioBufferFromAudioFileUrl } from "../utils/utils.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import textToSpeech from "../utils/textToSpeech.js";
import speechToText from "../utils/speechToText.js";
import llmFeedback from "../utils/llmFeedback.js";
import { sendAliasAndStartingInstruction } from "../utils/aliasAndInstructionsUtils.js";
import course_languages from "../constants/language.js";
import submitResponseFlow from "../flows/submitResponseFlow.js";
import skipActivityFlow from "../flows/skipActivityFlow.js";

const conversationalAgencyBotView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (currentUserState.dataValues.questionNumber == null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                // Send alias and starting instruction
                await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

                // Send first Conversational Agency Bot question
                const firstConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel);

                // Extract text between <question></question> tags from firstConversationalAgencyBotQuestion.question
                let match = firstConversationalAgencyBotQuestion.dataValues.question.match(/<question>(.*?)<\/question>/s);
                let questionText;
                if (match == null || match[1] == null) {
                    questionText = firstConversationalAgencyBotQuestion.dataValues.question;
                } else {
                    questionText = match[1].trim();
                }
                let questionAudio = "";
                if (firstConversationalAgencyBotQuestion?.dataValues?.mediaFile?.includes("http")) {
                    questionAudio = firstConversationalAgencyBotQuestion.dataValues.mediaFile;
                } else {
                    questionAudio = await textToSpeech.azureOpenAITextToSpeech(questionText);
                }

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstConversationalAgencyBotQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, questionAudio, 'audio');
                await createActivityLog(userMobileNumber, "audio", "outbound", questionAudio, null);

                let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], firstConversationalAgencyBotQuestion);
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
            }
            else if (messageType === 'audio') {
                // Get the current Conversational Agency Bot question
                const currentConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Upload audio
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio, "audio/ogg");
                const submissionDate = new Date();

                const existingAudioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(
                    profileId,
                    currentConversationalAgencyBotQuestion.dataValues.id,
                    currentUserState.dataValues.currentLessonId
                );

                if (existingAudioUrl) {
                    // Update existing record with new audio
                    await waQuestionResponsesRepository.updateReplace(
                        profileId,
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentConversationalAgencyBotQuestion.dataValues.id,
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
                        currentConversationalAgencyBotQuestion.dataValues.id,
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
                // Get the current Conversational Agency Bot question
                const currentConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Get the uploaded audio
                const audioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(profileId, currentConversationalAgencyBotQuestion.dataValues.id, currentUserState.dataValues.currentLessonId);

                // Get audio buffer for processing
                const audioBuffer = await getAudioBufferFromAudioFileUrl(audioUrl);

                let waitingMessage = "Please wait for an answer...";
                await sendMessage(userMobileNumber, waitingMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", waitingMessage, null);

                const recognizedText = await speechToText.azureSpeechToTextAnyLanguage(audioBuffer);
                if (recognizedText != null && recognizedText != "") {
                    if (currentUserState.dataValues.questionNumber == 1) {
                        // Language Detection
                        let modelLanguagePrompt = "Detect the majority of the language used in the provided text. Respond in one word only. The two options are: English or Urdu. You must respond with only one word."
                        const languageDetectionFeedback = await llmFeedback.azureOpenaiCustomFeedback(recognizedText, modelLanguagePrompt);
                        if (languageDetectionFeedback.toLowerCase().includes("english")) {
                            modelLanguagePrompt = "Respond in simple and easy-to-understand English within 100 words."
                        } else {
                            modelLanguagePrompt = "Use simple, easy-to-understand Urdu language, not jargon to respond within 100 words."
                        }
                        let firstPrompt = currentConversationalAgencyBotQuestion.dataValues.question + "\n\n\n" + modelLanguagePrompt;
                        firstPrompt += "\n\n\nMy response: " + recognizedText;

                        let messagesArray = [
                            {
                                role: "system",
                                content: "You are a Teacher-Coach working with teachers from low-resource backgrounds in Pakistan. Your approach is focused on the importance of nervous system regulation and relationship-based education."
                            },
                            {
                                role: "user",
                                content: firstPrompt
                            }
                        ]

                        let openaiFeedbackTranscript = await llmFeedback.azureOpenaiFeedback(messagesArray);
                        let initialFeedbackResponse = openaiFeedbackTranscript;

                        let openaiFeedbackAudio = await textToSpeech.azureOpenAITextToSpeech(initialFeedbackResponse);
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);

                        await sleep(5000);

                        // Update user response to the database with processing results
                        const submissionDate = new Date();
                        await waQuestionResponsesRepository.updateReplace(
                            profileId,
                            userMobileNumber,
                            currentUserState.dataValues.currentLessonId,
                            currentConversationalAgencyBotQuestion.dataValues.id,
                            activity,
                            startingLesson.dataValues.activityAlias,
                            [recognizedText],
                            [audioUrl],
                            [initialFeedbackResponse],
                            [openaiFeedbackAudio],
                            null,
                            null,
                            1,
                            submissionDate
                        );

                        const nextConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel);
                        if (nextConversationalAgencyBotQuestion) {
                            // Update question number
                            await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextConversationalAgencyBotQuestion.dataValues.questionNumber);

                            // Update acceptable messages list for the user
                            let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], nextConversationalAgencyBotQuestion);
                            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                            return;
                        } else {
                            // Reset Question Number, Retry Counter, and Activity Type
                            await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

                            // ENDING MESSAGE
                            await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
                        }
                    } else {
                        const previousConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber - 1);
                        // Language Detection
                        let modelLanguagePrompt = "Detect the majority of the language used in the provided text. Respond in one word only. The two options are: English or Urdu. You must respond with only one word."
                        const languageDetectionFeedback = await llmFeedback.azureOpenaiCustomFeedback(recognizedText, modelLanguagePrompt);
                        if (languageDetectionFeedback.toLowerCase().includes("english")) {
                            modelLanguagePrompt = "Respond in simple and easy-to-understand English."
                        } else {
                            modelLanguagePrompt = "Use simple, easy-to-understand Urdu language, not jargon to respond."
                        }
                        let secondPrompt = currentConversationalAgencyBotQuestion.dataValues.question + "\n\n\n" + modelLanguagePrompt;
                        secondPrompt += "\n\n\nMy response: " + recognizedText;

                        let previousMessages = await waQuestionResponsesRepository.getPreviousMessagesForAgencyBot(profileId, userMobileNumber, currentUserState.dataValues.currentLessonId, previousConversationalAgencyBotQuestion.dataValues.question);
                        previousMessages.push({
                            role: "user",
                            content: secondPrompt
                        });

                        let messagesArray = [
                            {
                                role: "system",
                                content: "You are a Teacher-Coach working with teachers from low-resource backgrounds in Pakistan. Your approach is focused on the importance of nervous system regulation and relationship-based education."
                            }
                        ]

                        previousMessages.forEach(message => {
                            messagesArray.push(message);
                        });

                        let openaiFeedbackTranscript = await llmFeedback.azureOpenaiFeedback(messagesArray);
                        let initialFeedbackResponse = openaiFeedbackTranscript;

                        let openaiFeedbackAudio = await textToSpeech.azureOpenAITextToSpeech(initialFeedbackResponse);
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);

                        await sleep(5000);

                        // Update user response to the database with processing results
                        const submissionDate = new Date();
                        await waQuestionResponsesRepository.updateReplace(
                            profileId,
                            userMobileNumber,
                            currentUserState.dataValues.currentLessonId,
                            currentConversationalAgencyBotQuestion.dataValues.id,
                            activity,
                            startingLesson.dataValues.activityAlias,
                            [recognizedText],
                            [audioUrl],
                            [initialFeedbackResponse],
                            [openaiFeedbackAudio],
                            null,
                            null,
                            1,
                            submissionDate
                        );

                        const nextConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel);
                        if (nextConversationalAgencyBotQuestion) {
                            // Update question number
                            await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextConversationalAgencyBotQuestion.dataValues.questionNumber);

                            // Update acceptable messages list for the user
                            let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], nextConversationalAgencyBotQuestion);
                            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                            return;
                        } else {
                            // Reset Question Number, Retry Counter, and Activity Type
                            await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

                            // ENDING MESSAGE
                            await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
                        }
                    }
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
        error.fileName = 'conversationalAgencyBotView.js';
        throw error;
    }
};

export { conversationalAgencyBotView };
