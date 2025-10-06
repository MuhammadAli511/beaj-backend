import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import { sendMessage, sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import azureBlobStorage from "../utils/azureBlobStorage.js";
import { sleep, getAudioBufferFromAudioFileUrl } from "../utils/utils.js";
import textToSpeech from "../utils/textToSpeech.js";
import speechToText from "../utils/speechToText.js";
import llmFeedback from "../utils/llmFeedback.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import { wrapup_prompt } from "../utils/prompts.js";
import waConstantsRepository from "../repositories/waConstantsRepository.js";
import { sendAliasAndStartingInstruction } from "../utils/aliasAndInstructionsUtils.js";
import course_languages from "../constants/language.js";
import submitResponseFlow from "../flows/submitResponseFlow.js";
import skipActivityFlow from "../flows/skipActivityFlow.js";
import skipButtonFlow from "../flows/skipButtonFlow.js";


const conversationalQuestionsBotView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (currentUserState.dataValues.questionNumber === null) {
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

                const firstConversationBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel);

                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstConversationBotQuestion.dataValues.questionNumber);

                await sendMediaMessage(userMobileNumber, firstConversationBotQuestion.dataValues.mediaFile, 'audio', null, 0, "SpeakActivityQuestion", firstConversationBotQuestion.dataValues.id, firstConversationBotQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, "audio", "outbound", firstConversationBotQuestion.dataValues.mediaFile, null);

                let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], firstConversationBotQuestion);
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                return;
            }
            else if (messageType === 'audio') {
                const currentConversationBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio, "audio/ogg");
                const submissionDate = new Date();

                const existingAudioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(
                    profileId,
                    currentConversationBotQuestion.dataValues.id,
                    currentUserState.dataValues.currentLessonId
                );

                if (existingAudioUrl) {
                    await waQuestionResponsesRepository.updateReplace(
                        profileId,
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentConversationBotQuestion.dataValues.id,
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
                        currentConversationBotQuestion.dataValues.id,
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

                await submitResponseFlow(profileId, userMobileNumber, startingLesson);
                return;
            }
            else if (messageContent == 'yes' || messageContent == 'oui') {
                const currentConversationBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                const audioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(profileId, currentConversationBotQuestion.dataValues.id, currentUserState.dataValues.currentLessonId);

                if (!audioUrl) {
                    let question_bot_audio_not_found = course_languages[startingLesson.dataValues.courseLanguage]["question_bot_audio_not_found"];
                    await sendMessage(userMobileNumber, question_bot_audio_not_found);
                    await skipButtonFlow(profileId, userMobileNumber, startingLesson, currentConversationBotQuestion);
                    return;
                }

                // Get audio buffer for processing
                const audioBuffer = await getAudioBufferFromAudioFileUrl(audioUrl);

                // OpenAI Speech to Text
                const recognizedText = await speechToText.azureOpenAISpeechToText(audioBuffer, "Transcribe the audio exactly as it is, if it is empty return nothing, don't add anything extra or fix any errors");
                if (recognizedText) {
                    const recordExists = await waQuestionResponsesRepository.checkRecordExistsForProfileIdAndLessonId(profileId, currentUserState.dataValues.currentLessonId);
                    let openaiFeedbackTranscript = null;
                    let openaiFeedbackAudio = null;
                    let initialFeedbackResponse = null;
                    let hardcodedFeedbackAudio = null;
                    if (recordExists && recordExists[0]?.dataValues?.submittedAnswerText == null) {
                        let question_bot_you_said = course_languages[startingLesson.dataValues.courseLanguage]["question_bot_you_said"];
                        const message = `${question_bot_you_said} ${recognizedText}`;
                        await sendMessage(userMobileNumber, message);
                        await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                        // Get all previous messages
                        let previousMessages = await waQuestionResponsesRepository.getPreviousMessages(profileId, userMobileNumber, currentUserState.dataValues.currentLessonId, currentConversationBotQuestion.dataValues.prompt);

                        // Append transcript
                        let currentMessage = { role: "user", content: currentConversationBotQuestion.dataValues.prompt + "\n\nQuestion: " + currentConversationBotQuestion.dataValues.question + "\n\nUser Response: " + recognizedText };
                        previousMessages.push(currentMessage);

                        // OpenAI Feedback
                        openaiFeedbackTranscript = await llmFeedback.azureOpenaiFeedback(previousMessages);
                        initialFeedbackResponse = openaiFeedbackTranscript;

                        // Extract corrected version of the answer
                        const correctedVersion = openaiFeedbackTranscript.match(/\[IMPROVED\](.*?)\[\/IMPROVED\]/);
                        if (correctedVersion) {
                            openaiFeedbackTranscript = openaiFeedbackTranscript.replace(/\[IMPROVED\](.*?)\[\/IMPROVED\]/, '');
                        }

                        openaiFeedbackAudio = await textToSpeech.azureOpenAITextToSpeech(openaiFeedbackTranscript);

                        // Media message
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);
                        await sleep(5000);

                        // Send corrected version of the answer
                        if (correctedVersion) {
                            let correctMessage = course_languages[startingLesson.dataValues.courseLanguage]["question_bot_correct_message_part_one"] + correctedVersion[1] + course_languages[startingLesson.dataValues.courseLanguage]["question_bot_correct_message_part_two"];
                            await sendMessage(userMobileNumber, correctMessage);
                            await createActivityLog(userMobileNumber, "text", "outbound", correctMessage, null);
                        }
                    } else {
                        let latestBotResponse = await waQuestionResponsesRepository.getLatestBotResponse(profileId, userMobileNumber, currentUserState.dataValues.currentLessonId);
                        let improvedVersion = latestBotResponse.match(/\[IMPROVED\](.*?)\[\/IMPROVED\]/);
                        let userResponse = "[USER_RESPONSE]" + recognizedText + "[/USER_RESPONSE]\n\n\n" + improvedVersion + "[/IMPROVED]";

                        // OpenAI Feedback
                        openaiFeedbackTranscript = await llmFeedback.azureOpenaiCustomFeedback(await wrapup_prompt(), userResponse);
                        initialFeedbackResponse = openaiFeedbackTranscript;

                        if (openaiFeedbackTranscript.toLowerCase().includes("can be improved")) {
                            const betterAudio = await waConstantsRepository.getByKey("BETTER_AUDIO");
                            hardcodedFeedbackAudio = betterAudio.dataValues.constantValue;
                        } else if (openaiFeedbackTranscript.toLowerCase().includes("it was great")) {
                            const okAudio = await waConstantsRepository.getByKey("OK_AUDIO");
                            hardcodedFeedbackAudio = okAudio.dataValues.constantValue;
                        }

                        // Media message
                        if (hardcodedFeedbackAudio) {
                            await sendMediaMessage(userMobileNumber, hardcodedFeedbackAudio, 'audio');
                            await createActivityLog(userMobileNumber, "audio", "outbound", hardcodedFeedbackAudio, null);
                            await sleep(2000);
                        }
                    }

                    // Update user response to the database with processing results
                    const submissionDate = new Date();
                    await waQuestionResponsesRepository.updateReplace(
                        profileId,
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentConversationBotQuestion.dataValues.id,
                        activity,
                        startingLesson.dataValues.activityAlias,
                        [recognizedText],
                        [audioUrl],
                        [initialFeedbackResponse],
                        [hardcodedFeedbackAudio],
                        null,
                        null,
                        1,
                        submissionDate
                    );

                    if (recordExists && recordExists[0]?.dataValues?.submittedAnswerText == null) {
                        // Update acceptable messages list for the user
                        let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], nextConversationBotQuestion);
                        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                        return;
                    } else {
                        // Reset Question Number, Retry Counter, and Activity Type
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

                        // ENDING MESSAGE
                        await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
                    }
                }
                return;
            }
            else if (messageContent == 'no, try again' || messageContent == 'no' || messageContent == 'enregistrez encore') {
                // Send message to try again
                let recordAgainMessage = course_languages[startingLesson.dataValues.courseLanguage]["record_again_message"];
                await sendMessage(userMobileNumber, recordAgainMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", recordAgainMessage, null);

                // Update acceptable messages list for the user
                await skipButtonFlow(profileId, userMobileNumber, startingLesson);
                return;
            }
        }
        else if (persona == 'kid') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                // Send alias and starting instruction
                await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

                // Send Conversation Bot Question
                const firstConversationBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstConversationBotQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstConversationBotQuestion.dataValues.mediaFile, 'audio', null, 0, "SpeakActivityQuestion", firstConversationBotQuestion.dataValues.id, firstConversationBotQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, "audio", "outbound", firstConversationBotQuestion.dataValues.mediaFile, null);

                let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], firstConversationBotQuestion);
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                return;
            }
            else if (messageType === 'audio') {
                // Get the current Conversation Bot question
                const currentConversationBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Upload audio
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio, "audio/ogg");
                const submissionDate = new Date();

                const existingAudioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(
                    profileId,
                    currentConversationBotQuestion.dataValues.id,
                    currentUserState.dataValues.currentLessonId
                );

                if (existingAudioUrl) {
                    // Update existing record with new audio
                    await waQuestionResponsesRepository.updateReplace(
                        profileId,
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentConversationBotQuestion.dataValues.id,
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
                        currentConversationBotQuestion.dataValues.id,
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
                // Get the current Conversation Bot question
                const currentConversationBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                const audioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(profileId, currentConversationBotQuestion.dataValues.id, currentUserState.dataValues.currentLessonId);

                if (!audioUrl) {
                    let question_bot_audio_not_found = course_languages[startingLesson.dataValues.courseLanguage]["question_bot_audio_not_found"];
                    await sendMessage(userMobileNumber, question_bot_audio_not_found);
                    await skipButtonFlow(profileId, userMobileNumber, startingLesson, currentConversationBotQuestion);
                    return;
                }

                // Get audio buffer for processing
                const audioBuffer = await getAudioBufferFromAudioFileUrl(audioUrl);

                // OpenAI Speech to Text
                const recognizedText = await speechToText.azureOpenAISpeechToText(audioBuffer, "Transcribe the audio exactly as it is, if it is empty return nothing, don't add anything extra or fix any errors");
                if (recognizedText) {
                    const recordExists = await waQuestionResponsesRepository.checkRecordExistsForProfileIdAndLessonId(profileId, currentUserState.dataValues.currentLessonId);
                    let openaiFeedbackTranscript = null;
                    let openaiFeedbackAudio = null;
                    let initialFeedbackResponse = null;
                    let hardcodedFeedbackAudio = null;
                    if (recordExists && recordExists[0]?.dataValues?.submittedAnswerText == null) {
                        let question_bot_you_said = course_languages[startingLesson.dataValues.courseLanguage]["question_bot_you_said"];
                        const message = `${question_bot_you_said} ${recognizedText}`;
                        await sendMessage(userMobileNumber, message);
                        await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                        // Get all previous messages
                        let previousMessages = await waQuestionResponsesRepository.getPreviousMessages(profileId, userMobileNumber, currentUserState.dataValues.currentLessonId, currentConversationBotQuestion.dataValues.prompt);

                        // Append transcript
                        let currentMessage = { role: "user", content: currentConversationBotQuestion.dataValues.prompt + "\n\nQuestion: " + currentConversationBotQuestion.dataValues.question + "\n\nUser Response: " + recognizedText };
                        previousMessages.push(currentMessage);

                        // OpenAI Feedback
                        openaiFeedbackTranscript = await llmFeedback.azureOpenaiFeedback(previousMessages);
                        initialFeedbackResponse = openaiFeedbackTranscript;

                        // Extract corrected version of the answer
                        const correctedVersion = openaiFeedbackTranscript.match(/\[IMPROVED\](.*?)\[\/IMPROVED\]/);
                        if (correctedVersion) {
                            openaiFeedbackTranscript = openaiFeedbackTranscript.replace(/\[IMPROVED\](.*?)\[\/IMPROVED\]/, '');
                        }

                        openaiFeedbackAudio = await textToSpeech.azureOpenAITextToSpeech(openaiFeedbackTranscript);

                        // Media message
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);
                        await sleep(5000);

                        // Send corrected version of the answer
                        if (correctedVersion) {
                            let correctMessage = course_languages[startingLesson.dataValues.courseLanguage]["question_bot_correct_message_part_one"] + correctedVersion[1] + course_languages[startingLesson.dataValues.courseLanguage]["question_bot_correct_message_part_two"];
                            await sendMessage(userMobileNumber, correctMessage);
                            await createActivityLog(userMobileNumber, "text", "outbound", correctMessage, null);
                        }
                    } else {
                        let latestBotResponse = await waQuestionResponsesRepository.getLatestBotResponse(profileId, userMobileNumber, currentUserState.dataValues.currentLessonId);
                        let improvedVersion = latestBotResponse.match(/\[IMPROVED\](.*?)\[\/IMPROVED\]/);
                        let userResponse = "[USER_RESPONSE]" + recognizedText + "[/USER_RESPONSE]\n\n\n" + improvedVersion + "[/IMPROVED]";

                        // OpenAI Feedback
                        openaiFeedbackTranscript = await llmFeedback.azureOpenaiCustomFeedback(await wrapup_prompt(), userResponse);
                        initialFeedbackResponse = openaiFeedbackTranscript;

                        if (openaiFeedbackTranscript.toLowerCase().includes("can be improved")) {
                            const betterAudio = await waConstantsRepository.getByKey("BETTER_AUDIO");
                            hardcodedFeedbackAudio = betterAudio;
                        } else {
                            const okAudio = await waConstantsRepository.getByKey("OK_AUDIO");
                            hardcodedFeedbackAudio = okAudio;
                        }

                        // Media message
                        if (hardcodedFeedbackAudio) {
                            await sendMediaMessage(userMobileNumber, hardcodedFeedbackAudio.dataValues.constantValue, 'audio', null, 0, "WA_Constants", hardcodedFeedbackAudio.dataValues.id, hardcodedFeedbackAudio.dataValues.constantMediaId, "constantMediaId");
                            await createActivityLog(userMobileNumber, "audio", "outbound", hardcodedFeedbackAudio.dataValues.constantValue, null);
                            await sleep(2000);
                        }
                    }

                    // Update user response to the database with processing results
                    const submissionDate = new Date();
                    await waQuestionResponsesRepository.updateReplace(
                        profileId,
                        userMobileNumber,
                        currentUserState.dataValues.currentLessonId,
                        currentConversationBotQuestion.dataValues.id,
                        activity,
                        startingLesson.dataValues.activityAlias,
                        [recognizedText],
                        [audioUrl],
                        [initialFeedbackResponse],
                        [hardcodedFeedbackAudio],
                        null,
                        null,
                        1,
                        submissionDate
                    );

                    if (recordExists && recordExists[0]?.dataValues?.submittedAnswerText == null) {
                        // Update acceptable messages list for the user
                        let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], nextConversationBotQuestion);
                        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                        return;
                    } else {
                        // Reset Question Number, Retry Counter, and Activity Type
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

                        // ENDING MESSAGE
                        await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
                    }
                }
                return;
            }
            else if (messageContent == 'no, try again' || messageContent == 'no' || messageContent == 'enregistrez encore') {
                // Send message to try again
                let recordAgainMessage = course_languages[startingLesson.dataValues.courseLanguage]["record_again_message"];
                await sendMessage(userMobileNumber, recordAgainMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", recordAgainMessage, null);

                // Update acceptable messages list for the user
                await skipButtonFlow(profileId, userMobileNumber, startingLesson);
                return;
            }
        }
        return;
    } catch (error) {
        console.error('Error sending lesson to user:', error);
        error.fileName = 'conversationalQuestionsBotView.js';
        throw error;
    }
};

export { conversationalQuestionsBotView };