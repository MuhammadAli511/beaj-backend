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

const conversationalAgencyBotView = async (userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (currentUserState.dataValues.questionNumber == null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\n\nListen to the audio and send your answer as a voice message.";
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Conversational Agency Bot question
                const firstConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Extract text between <question></question> tags from firstConversationalAgencyBotQuestion.question
                const questionText = firstConversationalAgencyBotQuestion.dataValues.question.match(/<question>(.*?)<\/question>/s)[1].trim();
                let questionAudio = "";
                if (firstConversationalAgencyBotQuestion.dataValues.mediaFile != null && firstConversationalAgencyBotQuestion.dataValues.mediaFile.includes("http")) {
                    questionAudio = firstConversationalAgencyBotQuestion.dataValues.mediaFile;
                } else {
                    questionAudio = await AIServices.elevenLabsTextToSpeechAndUpload(questionText);
                }

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstConversationalAgencyBotQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, questionAudio, 'audio');
                await createActivityLog(userMobileNumber, "audio", "outbound", questionAudio, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
            }
            else if (messageType === 'audio') {
                // Get the current Conversational Agency Bot question
                const currentConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                let waitingMessage = "Please wait for an answer...";
                await sendMessage(userMobileNumber, waitingMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", waitingMessage, null);
                const recognizedText = await AIServices.azureSpeechToTextAnyLanguage(messageContent.data);
                if (recognizedText != null && recognizedText != "") {
                    if (currentUserState.dataValues.questionNumber == 1) {
                        // Language Detection
                        let modelLanguagePrompt = "Detect the majority of the language used in the provided text. Respond in one word only. The two options are: English or Urdu. You must respond with only one word."
                        const languageDetectionFeedback = await AIServices.openaiCustomFeedback(recognizedText, modelLanguagePrompt);
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

                        let openaiFeedbackTranscript = await AIServices.openaiFeedback(messagesArray);
                        let initialFeedbackResponse = openaiFeedbackTranscript;

                        let openaiFeedbackAudio = await AIServices.elevenLabsTextToSpeechAndUpload(initialFeedbackResponse);
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);

                        await sleep(5000);

                        // Save to question responses
                        const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                        const uniqueID = uuidv4();
                        const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                        const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                        const submissionDate = new Date();
                        await waQuestionResponsesRepository.create(
                            userMobileNumber,
                            currentUserState.dataValues.currentLessonId,
                            currentConversationalAgencyBotQuestion.dataValues.id,
                            activity,
                            startingLesson.dataValues.activityAlias,
                            [recognizedText],
                            [userAudioFileUrl],
                            [initialFeedbackResponse],
                            [openaiFeedbackAudio],
                            null,
                            null,
                            1,
                            submissionDate
                        );

                        const nextConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                        if (nextConversationalAgencyBotQuestion) {
                            // Update question number
                            await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextConversationalAgencyBotQuestion.dataValues.questionNumber);
                        } else {
                            // Reset Question Number, Retry Counter, and Activity Type
                            await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                            // ENDING MESSAGE
                            await endingMessage(userMobileNumber, currentUserState, startingLesson);
                        }
                    } else {
                        const previousConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber - 1);
                        // Language Detection
                        let modelLanguagePrompt = "Detect the majority of the language used in the provided text. Respond in one word only. The two options are: English or Urdu. You must respond with only one word."
                        const languageDetectionFeedback = await AIServices.openaiCustomFeedback(recognizedText, modelLanguagePrompt);
                        if (languageDetectionFeedback.toLowerCase().includes("english")) {
                            modelLanguagePrompt = "Respond in simple and easy-to-understand English."
                        } else {
                            modelLanguagePrompt = "Use simple, easy-to-understand Urdu language, not jargon to respond."
                        }
                        let secondPrompt = currentConversationalAgencyBotQuestion.dataValues.question + "\n\n\n" + modelLanguagePrompt;
                        secondPrompt += "\n\n\nMy response: " + recognizedText;

                        let previousMessages = await waQuestionResponsesRepository.getPreviousMessagesForAgencyBot(userMobileNumber, currentUserState.dataValues.currentLessonId, previousConversationalAgencyBotQuestion.dataValues.question);
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

                        let openaiFeedbackTranscript = await AIServices.openaiFeedback(messagesArray);
                        let initialFeedbackResponse = openaiFeedbackTranscript;

                        let openaiFeedbackAudio = await AIServices.elevenLabsTextToSpeechAndUpload(initialFeedbackResponse);
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);

                        await sleep(5000);

                        // Save to question responses
                        const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                        const uniqueID = uuidv4();
                        const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                        const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                        const submissionDate = new Date();
                        await waQuestionResponsesRepository.create(
                            userMobileNumber,
                            currentUserState.dataValues.currentLessonId,
                            currentConversationalAgencyBotQuestion.dataValues.id,
                            activity,
                            startingLesson.dataValues.activityAlias,
                            [recognizedText],
                            [userAudioFileUrl],
                            [initialFeedbackResponse],
                            [openaiFeedbackAudio],
                            null,
                            null,
                            1,
                            submissionDate
                        );

                        const nextConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                        if (nextConversationalAgencyBotQuestion) {
                            // Update question number
                            await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextConversationalAgencyBotQuestion.dataValues.questionNumber);
                        } else {
                            // Reset Question Number, Retry Counter, and Activity Type
                            await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                            // ENDING MESSAGE
                            await endingMessage(userMobileNumber, currentUserState, startingLesson);
                        }
                    }
                }
            }
        }
        else if (persona == 'kid') {
            if (currentUserState.dataValues.questionNumber == null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\n\nListen to the audio and send your answer as a voice message.";
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Conversational Agency Bot question
                const firstConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Extract text between <question></question> tags from firstConversationalAgencyBotQuestion.question
                const questionText = firstConversationalAgencyBotQuestion.dataValues.question.match(/<question>(.*?)<\/question>/s)[1].trim();
                let questionAudio = "";
                if (firstConversationalAgencyBotQuestion.dataValues.mediaFile != null && firstConversationalAgencyBotQuestion.dataValues.mediaFile.includes("http")) {
                    questionAudio = firstConversationalAgencyBotQuestion.dataValues.mediaFile;
                } else {
                    questionAudio = await AIServices.elevenLabsTextToSpeechAndUpload(questionText);
                }

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstConversationalAgencyBotQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, questionAudio, 'audio');
                await createActivityLog(userMobileNumber, "audio", "outbound", questionAudio, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
            }
            else if (messageType === 'audio') {
                // Get the current Conversational Agency Bot question
                const currentConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                let waitingMessage = "Please wait for an answer...";
                await sendMessage(userMobileNumber, waitingMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", waitingMessage, null);
                const recognizedText = await AIServices.azureSpeechToTextAnyLanguage(messageContent.data);
                if (recognizedText != null && recognizedText != "") {
                    if (currentUserState.dataValues.questionNumber == 1) {
                        // Language Detection
                        let modelLanguagePrompt = "Detect the majority of the language used in the provided text. Respond in one word only. The two options are: English or Urdu. You must respond with only one word."
                        const languageDetectionFeedback = await AIServices.openaiCustomFeedback(recognizedText, modelLanguagePrompt);
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

                        let openaiFeedbackTranscript = await AIServices.openaiFeedback(messagesArray);
                        let initialFeedbackResponse = openaiFeedbackTranscript;

                        let openaiFeedbackAudio = await AIServices.elevenLabsTextToSpeechAndUpload(initialFeedbackResponse);
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);

                        await sleep(5000);

                        // Save to question responses
                        const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                        const uniqueID = uuidv4();
                        const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                        const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                        const submissionDate = new Date();
                        await waQuestionResponsesRepository.create(
                            userMobileNumber,
                            currentUserState.dataValues.currentLessonId,
                            currentConversationalAgencyBotQuestion.dataValues.id,
                            activity,
                            startingLesson.dataValues.activityAlias,
                            [recognizedText],
                            [userAudioFileUrl],
                            [initialFeedbackResponse],
                            [openaiFeedbackAudio],
                            null,
                            null,
                            1,
                            submissionDate
                        );

                        const nextConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                        if (nextConversationalAgencyBotQuestion) {
                            // Update question number
                            await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextConversationalAgencyBotQuestion.dataValues.questionNumber);
                        } else {
                            // Reset Question Number, Retry Counter, and Activity Type
                            await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                            // ENDING MESSAGE
                            await endingMessage(userMobileNumber, currentUserState, startingLesson);
                        }
                    } else {
                        const previousConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber - 1);
                        // Language Detection
                        let modelLanguagePrompt = "Detect the majority of the language used in the provided text. Respond in one word only. The two options are: English or Urdu. You must respond with only one word."
                        const languageDetectionFeedback = await AIServices.openaiCustomFeedback(recognizedText, modelLanguagePrompt);
                        if (languageDetectionFeedback.toLowerCase().includes("english")) {
                            modelLanguagePrompt = "Respond in simple and easy-to-understand English."
                        } else {
                            modelLanguagePrompt = "Use simple, easy-to-understand Urdu language, not jargon to respond."
                        }
                        let secondPrompt = currentConversationalAgencyBotQuestion.dataValues.question + "\n\n\n" + modelLanguagePrompt;
                        secondPrompt += "\n\n\nMy response: " + recognizedText;

                        let previousMessages = await waQuestionResponsesRepository.getPreviousMessagesForAgencyBot(userMobileNumber, currentUserState.dataValues.currentLessonId, previousConversationalAgencyBotQuestion.dataValues.question);
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

                        let openaiFeedbackTranscript = await AIServices.openaiFeedback(messagesArray);
                        let initialFeedbackResponse = openaiFeedbackTranscript;

                        let openaiFeedbackAudio = await AIServices.elevenLabsTextToSpeechAndUpload(initialFeedbackResponse);
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);

                        await sleep(5000);

                        // Save to question responses
                        const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                        const uniqueID = uuidv4();
                        const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                        const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                        const submissionDate = new Date();
                        await waQuestionResponsesRepository.create(
                            userMobileNumber,
                            currentUserState.dataValues.currentLessonId,
                            currentConversationalAgencyBotQuestion.dataValues.id,
                            activity,
                            startingLesson.dataValues.activityAlias,
                            [recognizedText],
                            [userAudioFileUrl],
                            [initialFeedbackResponse],
                            [openaiFeedbackAudio],
                            null,
                            null,
                            1,
                            submissionDate
                        );

                        const nextConversationalAgencyBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                        if (nextConversationalAgencyBotQuestion) {
                            // Update question number
                            await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextConversationalAgencyBotQuestion.dataValues.questionNumber);
                        } else {
                            // Reset Question Number, Retry Counter, and Activity Type
                            await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                            // ENDING MESSAGE
                            await endingMessage(userMobileNumber, currentUserState, startingLesson);
                        }
                    }
                }
            }
        }
        return;
    } catch (error) {
        console.log('Error sending lesson to user:', error);
        error.fileName = 'conversationalAgencyBotView.js';
        throw error;
    }
};

export { conversationalAgencyBotView };
