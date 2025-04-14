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
import { question_bot_prompt, wrapup_prompt } from "../utils/prompts.js";

const conversationalQuestionsBotView = async (userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\n\nListen to the audio and send your answer as a voice message.";

                // Text message
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send Conversation Bot Question
                const firstConversationBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstConversationBotQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstConversationBotQuestion.dataValues.mediaFile, 'audio');
                await createActivityLog(userMobileNumber, "audio", "outbound", firstConversationBotQuestion.dataValues.mediaFile, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                return;
            }
            else if (messageType === 'audio') {
                // Get the current Conversation Bot question
                const currentConversationBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // OpenAI Speech to Text
                const recognizedText = await AIServices.elevenLabsSpeechToText(messageContent.data);
                if (recognizedText) {
                    const recordExists = await waQuestionResponsesRepository.checkRecordExistsForPhoneNumberAndLessonId(userMobileNumber, currentUserState.dataValues.currentLessonId);
                    let openaiFeedbackTranscript = null;
                    let openaiFeedbackAudio = null;
                    let initialFeedbackResponse = null;
                    if (recordExists) {
                        const message = `Please wait for an answer. \n\nYou said: ${recognizedText}`;
                        await sendMessage(userMobileNumber, message);
                        await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                        // Get all previous messages
                        let previousMessages = await waQuestionResponsesRepository.getPreviousMessages(userMobileNumber, currentUserState.dataValues.currentLessonId);

                        // Append transcript
                        let currentMessage = { role: "user", content: await question_bot_prompt() + "\n\nQuestion: " + currentConversationBotQuestion.dataValues.question + "\n\nUser Response: " + recognizedText };
                        previousMessages.push(currentMessage);

                        // OpenAI Feedback
                        openaiFeedbackTranscript = await AIServices.openaiFeedback(previousMessages);
                        initialFeedbackResponse = openaiFeedbackTranscript;

                        // Extract corrected version of the answer
                        const correctedVersion = openaiFeedbackTranscript.match(/\[IMPROVED\](.*?)\[\/IMPROVED\]/);
                        if (correctedVersion) {
                            openaiFeedbackTranscript = openaiFeedbackTranscript.replace(/\[IMPROVED\](.*?)\[\/IMPROVED\]/, '');
                        }

                        // ElevenLabs Text to Speech
                        openaiFeedbackAudio = await AIServices.openaiTextToSpeechAndUpload(openaiFeedbackTranscript);

                        // Media message
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);
                        await sleep(5000);

                        // Send corrected version of the answer
                        if (correctedVersion) {
                            let correctMessage = "A corrected version of your answer is: " + correctedVersion[1] + "\n\n\n*Now try speaking the improved version by sending a voice message* 💬";
                            await sendMessage(userMobileNumber, correctMessage);
                            await createActivityLog(userMobileNumber, "text", "outbound", correctMessage, null);
                        }
                    } else {
                        let finalMessages = null;
                        let latestBotResponse = await waQuestionResponsesRepository.getLatestBotResponse(userMobileNumber, currentUserState.dataValues.currentLessonId);
                        let improvedVersion = latestBotResponse.match(/\[IMPROVED\](.*?)\[\/IMPROVED\]/);
                        let userResponse = "[USER_RESPONSE]" + recognizedText + "[/USER_RESPONSE]\n\n\n" + improvedVersion + "[/IMPROVED]";

                        // OpenAI Feedback
                        openaiFeedbackTranscript = await AIServices.openaiCustomFeedback(await wrapup_prompt(), userResponse);
                        initialFeedbackResponse = openaiFeedbackTranscript;

                        if (openaiFeedbackTranscript.toLowerCase().includes("can be improved")) {
                            openaiFeedbackAudio = "https://beajbloblive.blob.core.windows.net/beajdocuments/better.mp3";
                        } else if (openaiFeedbackTranscript.toLowerCase().includes("it was great")) {
                            openaiFeedbackAudio = "https://beajbloblive.blob.core.windows.net/beajdocuments/ok.mp3";
                        }

                        // Media message
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);
                        await sleep(5000);
                    }

                    // Save user response to the database
                    const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                    const uniqueID = uuidv4();
                    const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                    const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                    const submissionDate = new Date();
                    await waQuestionResponsesRepository.create(
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentConversationBotQuestion.dataValues.id,
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

                    if (recordExists) {
                        return;
                    } else {
                        // Reset Question Number, Retry Counter, and Activity Type
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                        // ENDING MESSAGE
                        await endingMessage(userMobileNumber, currentUserState, startingLesson);
                    }
                }
            }
        }
        else if (persona == 'kid') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\n\nListen to the audio and send your answer as a voice message.";

                // Text message
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send Conversation Bot Question
                const firstConversationBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstConversationBotQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstConversationBotQuestion.dataValues.mediaFile, 'audio');
                await createActivityLog(userMobileNumber, "audio", "outbound", firstConversationBotQuestion.dataValues.mediaFile, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                return;
            }
            else if (messageType === 'audio') {
                // Get the current Conversation Bot question
                const currentConversationBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // OpenAI Speech to Text
                const recognizedText = await AIServices.elevenLabsSpeechToText(messageContent.data);
                if (recognizedText) {
                    const recordExists = await waQuestionResponsesRepository.checkRecordExistsForPhoneNumberAndLessonId(userMobileNumber, currentUserState.dataValues.currentLessonId);
                    let openaiFeedbackTranscript = null;
                    let openaiFeedbackAudio = null;
                    let initialFeedbackResponse = null;
                    if (recordExists) {
                        const message = `Please wait for an answer. \n\nYou said: ${recognizedText}`;
                        await sendMessage(userMobileNumber, message);
                        await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                        // Get all previous messages
                        let previousMessages = await waQuestionResponsesRepository.getPreviousMessages(userMobileNumber, currentUserState.dataValues.currentLessonId);

                        // Append transcript
                        let currentMessage = { role: "user", content: await question_bot_prompt() + "\n\nQuestion: " + currentConversationBotQuestion.dataValues.question + "\n\nUser Response: " + recognizedText };
                        previousMessages.push(currentMessage);

                        // OpenAI Feedback
                        openaiFeedbackTranscript = await AIServices.openaiFeedback(previousMessages);
                        initialFeedbackResponse = openaiFeedbackTranscript;

                        // Extract corrected version of the answer
                        const correctedVersion = openaiFeedbackTranscript.match(/\[IMPROVED\](.*?)\[\/IMPROVED\]/);
                        if (correctedVersion) {
                            openaiFeedbackTranscript = openaiFeedbackTranscript.replace(/\[IMPROVED\](.*?)\[\/IMPROVED\]/, '');
                        }

                        // ElevenLabs Text to Speech
                        openaiFeedbackAudio = await AIServices.openaiTextToSpeechAndUpload(openaiFeedbackTranscript);

                        // Media message
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);
                        await sleep(5000);

                        // Send corrected version of the answer
                        if (correctedVersion) {
                            let correctMessage = "A corrected version of your answer is: " + correctedVersion[1] + "\n\n\n*Now try speaking the improved version by sending a voice message* 💬";
                            await sendMessage(userMobileNumber, correctMessage);
                            await createActivityLog(userMobileNumber, "text", "outbound", correctMessage, null);
                        }
                    } else {
                        let finalMessages = null;
                        let latestBotResponse = await waQuestionResponsesRepository.getLatestBotResponse(userMobileNumber, currentUserState.dataValues.currentLessonId);
                        let improvedVersion = latestBotResponse.match(/\[IMPROVED\](.*?)\[\/IMPROVED\]/);
                        let userResponse = "[USER_RESPONSE]" + recognizedText + "[/USER_RESPONSE]\n\n\n" + improvedVersion + "[/IMPROVED]";

                        // OpenAI Feedback
                        openaiFeedbackTranscript = await AIServices.openaiCustomFeedback(await wrapup_prompt(), userResponse);
                        initialFeedbackResponse = openaiFeedbackTranscript;

                        if (openaiFeedbackTranscript.toLowerCase().includes("can be improved")) {
                            openaiFeedbackAudio = "https://beajbloblive.blob.core.windows.net/beajdocuments/better.mp3";
                        } else if (openaiFeedbackTranscript.toLowerCase().includes("it was great")) {
                            openaiFeedbackAudio = "https://beajbloblive.blob.core.windows.net/beajdocuments/ok.mp3";
                        }

                        // Media message
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);
                        await sleep(5000);
                    }

                    // Save user response to the database
                    const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                    const uniqueID = uuidv4();
                    const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                    const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
                    const submissionDate = new Date();
                    await waQuestionResponsesRepository.create(
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentConversationBotQuestion.dataValues.id,
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

                    if (recordExists) {
                        return;
                    } else {
                        // Reset Question Number, Retry Counter, and Activity Type
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                        // ENDING MESSAGE
                        await endingMessage(userMobileNumber, currentUserState, startingLesson);
                    }
                }
            }
        }
        return;
    } catch (error) {
        console.log('Error sending lesson to user:', error);
        error.fileName = 'conversationalQuestionsBotView.js';
        throw error;
    }
};

export { conversationalQuestionsBotView };