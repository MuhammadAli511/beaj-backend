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
import textToSpeech from "../utils/textToSpeech.js";
import speechToText from "../utils/speechToText.js";
import llmFeedback from "../utils/llmFeedback.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import { question_bot_prompt, wrapup_prompt } from "../utils/prompts.js";
import waConstantsRepository from "../repositories/waConstantsRepository.js";
import { sendAliasAndStartingInstruction } from "../utils/aliasAndInstructionsUtils.js";

const conversationalQuestionsBotView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
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


                if (startingLesson.dataValues.skipOnEveryQuestion == true) {
                    await sendButtonMessage(userMobileNumber, "👇 Click here to skip:", [{ id: "skip", title: "Skip" }]);
                    await createActivityLog(userMobileNumber, "template", "outbound", "👇 Click here to skip:", null);
                }

                // Update acceptable messages list for the user
                if (startingLesson.dataValues.skipOnFirstQuestion == true && firstConversationBotQuestion.dataValues.questionNumber == 1) {
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio", "skip"]);
                } else if (startingLesson.dataValues.skipOnEveryQuestion == true){
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio", "skip"]);
                } else {
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                }
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

                await sendButtonMessage(userMobileNumber, "Submit response? 🧐", [{ id: "yes", title: "Yes" }, { id: "no", title: "No, try again" }]);
                await createActivityLog(userMobileNumber, "template", "outbound", "Submit response? 🧐", null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["yes", "no", "no, try again"]);
                await sleep(2000);
                return;
            }
            else if (messageContent == 'yes') {
                // Get the current Conversation Bot question
                const currentConversationBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                const audioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(profileId, currentConversationBotQuestion.dataValues.id, currentUserState.dataValues.currentLessonId);

                if (!audioUrl) {
                    await sendMessage(userMobileNumber, "Audio not found. Please try recording again.");
                    if (startingLesson.dataValues.skipOnEveryQuestion == true) {
                        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio", "skip"]);
                    } else {
                        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                    }
                    return;
                }

                // Get audio buffer for processing
                const audioBuffer = await getAudioBufferFromAudioFileUrl(audioUrl);

                // OpenAI Speech to Text
                const recognizedText = await speechToText.elevenLabsSpeechToText(audioBuffer);
                if (recognizedText) {
                    const recordExists = await waQuestionResponsesRepository.checkRecordExistsForProfileIdAndLessonId(profileId, currentUserState.dataValues.currentLessonId);
                    let openaiFeedbackTranscript = null;
                    let openaiFeedbackAudio = null;
                    let initialFeedbackResponse = null;
                    let hardcodedFeedbackAudio = null;
                    if (recordExists && recordExists[0]?.dataValues?.submittedAnswerText == null) {
                        const message = `Please wait for an answer. \n\nYou said: ${recognizedText}`;
                        await sendMessage(userMobileNumber, message);
                        await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                        // Get all previous messages
                        let previousMessages = await waQuestionResponsesRepository.getPreviousMessages(profileId, userMobileNumber, currentUserState.dataValues.currentLessonId);

                        // Append transcript
                        let currentMessage = { role: "user", content: await question_bot_prompt() + "\n\nQuestion: " + currentConversationBotQuestion.dataValues.question + "\n\nUser Response: " + recognizedText };
                        previousMessages.push(currentMessage);

                        // OpenAI Feedback
                        openaiFeedbackTranscript = await llmFeedback.azureOpenaiFeedback(previousMessages);
                        initialFeedbackResponse = openaiFeedbackTranscript;

                        // Extract corrected version of the answer
                        const correctedVersion = openaiFeedbackTranscript.match(/\<IMPROVED\>(.*?)\<\/IMPROVED\>/);
                        if (correctedVersion) {
                            openaiFeedbackTranscript = openaiFeedbackTranscript.replace(/\<IMPROVED\>(.*?)\<\/IMPROVED\>/, '');
                        }

                        // ElevenLabs Text to Speech
                        openaiFeedbackAudio = await textToSpeech.azureOpenAITextToSpeech(openaiFeedbackTranscript);

                        // Media message
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);
                        await sleep(5000);

                        // Send corrected version of the answer
                        if (correctedVersion) {
                            let correctMessage = "A corrected version of your answer is: " + correctedVersion[1] + "\n\n\n*👉 Now try speaking the improved version by sending a voice message* 💬";
                            await sendMessage(userMobileNumber, correctMessage);
                            await createActivityLog(userMobileNumber, "text", "outbound", correctMessage, null);
                        }
                    } else {
                        let latestBotResponse = await waQuestionResponsesRepository.getLatestBotResponse(profileId, userMobileNumber, currentUserState.dataValues.currentLessonId);
                        let improvedVersion = latestBotResponse.match(/\<IMPROVED\>(.*?)\<\/IMPROVED\>/);
                        let userResponse = "<USER_RESPONSE>" + recognizedText + "<\/USER_RESPONSE>\n\n\n" + improvedVersion + "<\/IMPROVED>";

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
                        if (startingLesson.dataValues.skipOnEveryQuestion == true) {
                            await sendButtonMessage(userMobileNumber, "👇 Click here to skip:", [{ id: "skip", title: "Skip" }]);
                            await createActivityLog(userMobileNumber, "template", "outbound", "👇 Click here to skip:", null);
                            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio", "skip"]);
                        } else {
                            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                        }
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
            else if (messageContent == 'no, try again' || messageContent == 'no') {
                // Send message to try again
                await sendMessage(userMobileNumber, "Okay record your voice message again.");
                await createActivityLog(userMobileNumber, "text", "outbound", "Okay record your voice message again.", null);

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

                // Send Conversation Bot Question
                const firstConversationBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstConversationBotQuestion.dataValues.questionNumber);

                // Send question media file
                await sendMediaMessage(userMobileNumber, firstConversationBotQuestion.dataValues.mediaFile, 'audio', null, 0, "SpeakActivityQuestion", firstConversationBotQuestion.dataValues.id, firstConversationBotQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, "audio", "outbound", firstConversationBotQuestion.dataValues.mediaFile, null);

                if (startingLesson.dataValues.skipOnEveryQuestion == true) {
                    await sendButtonMessage(userMobileNumber, "👇 Click here to skip:", [{ id: "skip", title: "Skip" }]);
                    await createActivityLog(userMobileNumber, "template", "outbound", "👇 Click here to skip:", null);
                }

                // Update acceptable messages list for the user
                if (startingLesson.dataValues.skipOnFirstQuestion == true && firstConversationBotQuestion.dataValues.questionNumber == 1) {
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio", "skip"]);
                } else if (startingLesson.dataValues.skipOnEveryQuestion == true){
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio", "skip"]);
                } else {
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                }
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

                await sendButtonMessage(userMobileNumber, "Submit response? 🧐", [{ id: "yes", title: "Yes" }, { id: "no", title: "No, try again" }]);
                await createActivityLog(userMobileNumber, "template", "outbound", "Submit response? 🧐", null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["yes", "no", "no, try again"]);
                await sleep(2000);
                return;
            }
            else if (messageContent == 'yes') {
                // Get the current Conversation Bot question
                const currentConversationBotQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                const audioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(profileId, currentConversationBotQuestion.dataValues.id, currentUserState.dataValues.currentLessonId);

                if (!audioUrl) {
                    await sendMessage(userMobileNumber, "Audio not found. Please try recording again.");
                    if (startingLesson.dataValues.skipOnEveryQuestion == true) {
                        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio", "skip"]);
                    } else {
                        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                    }
                    return;
                }

                // Get audio buffer for processing
                const audioBuffer = await getAudioBufferFromAudioFileUrl(audioUrl);

                // OpenAI Speech to Text
                const recognizedText = await speechToText.elevenLabsSpeechToText(audioBuffer);
                if (recognizedText) {
                    const recordExists = await waQuestionResponsesRepository.checkRecordExistsForProfileIdAndLessonId(profileId, currentUserState.dataValues.currentLessonId);
                    let openaiFeedbackTranscript = null;
                    let openaiFeedbackAudio = null;
                    let initialFeedbackResponse = null;
                    let hardcodedFeedbackAudio = null;
                    if (recordExists && recordExists[0]?.dataValues?.submittedAnswerText == null) {
                        const message = `Please wait for an answer. \n\nYou said: ${recognizedText}`;
                        await sendMessage(userMobileNumber, message);
                        await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                        // Get all previous messages
                        let previousMessages = await waQuestionResponsesRepository.getPreviousMessages(profileId, userMobileNumber, currentUserState.dataValues.currentLessonId);

                        // Append transcript
                        let currentMessage = { role: "user", content: await question_bot_prompt() + "\n\nQuestion: " + currentConversationBotQuestion.dataValues.question + "\n\nUser Response: " + recognizedText };
                        previousMessages.push(currentMessage);

                        // OpenAI Feedback
                        openaiFeedbackTranscript = await llmFeedback.azureOpenaiFeedback(previousMessages);
                        initialFeedbackResponse = openaiFeedbackTranscript;

                        // Extract corrected version of the answer
                        const correctedVersion = openaiFeedbackTranscript.match(/\<IMPROVED\>(.*?)\<\/IMPROVED\>/);
                        if (correctedVersion) {
                            openaiFeedbackTranscript = openaiFeedbackTranscript.replace(/\<IMPROVED\>(.*?)\<\/IMPROVED\>/, '');
                        }

                        // ElevenLabs Text to Speech
                        openaiFeedbackAudio = await textToSpeech.azureOpenAITextToSpeech(openaiFeedbackTranscript);

                        // Media message
                        await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);
                        await sleep(5000);

                        // Send corrected version of the answer
                        if (correctedVersion) {
                            let correctMessage = "A corrected version of your answer is: " + correctedVersion[1] + "\n\n\n*👉 Now try speaking the improved version by sending a voice message* 💬";
                            await sendMessage(userMobileNumber, correctMessage);
                            await createActivityLog(userMobileNumber, "text", "outbound", correctMessage, null);
                        }
                    } else {
                        let latestBotResponse = await waQuestionResponsesRepository.getLatestBotResponse(profileId, userMobileNumber, currentUserState.dataValues.currentLessonId);
                        let improvedVersion = latestBotResponse.match(/\<IMPROVED\>(.*?)\<\/IMPROVED\>/);
                        let userResponse = "<USER_RESPONSE>" + recognizedText + "<\/USER_RESPONSE>\n\n\n" + improvedVersion + "<\/IMPROVED>";

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
                        if (startingLesson.dataValues.skipOnEveryQuestion == true) {
                            await sendButtonMessage(userMobileNumber, "👇 Click here to skip:", [{ id: "skip", title: "Skip" }]);
                            await createActivityLog(userMobileNumber, "template", "outbound", "👇 Click here to skip:", null);
                            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio", "skip"]);
                        } else {
                            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                        }
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
            else if (messageContent == 'no, try again' || messageContent == 'no') {
                // Send message to try again
                await sendMessage(userMobileNumber, "Okay record your voice message again.");
                await createActivityLog(userMobileNumber, "text", "outbound", "Okay record your voice message again.", null);

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
        error.fileName = 'conversationalQuestionsBotView.js';
        throw error;
    }
};

export { conversationalQuestionsBotView };