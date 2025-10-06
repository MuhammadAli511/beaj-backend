import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import { sendMessage, sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import azureBlobStorage from "../utils/azureBlobStorage.js";
import { sleep, getAudioBufferFromAudioFileUrl, topicSelection } from "../utils/utils.js";
import textToSpeech from "../utils/textToSpeech.js";
import speechToText from "../utils/speechToText.js";
import llmFeedback from "../utils/llmFeedback.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import waConstantsRepository from "../repositories/waConstantsRepository.js";
import { sendAliasAndStartingInstruction } from "../utils/aliasAndInstructionsUtils.js";
import course_languages from "../constants/language.js";
import submitResponseFlow from "../flows/submitResponseFlow.js";
import skipActivityFlow from "../flows/skipActivityFlow.js";
import skipButtonFlow from "../flows/skipButtonFlow.js";

const calculateStringSimilarity = (str1, str2) => {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    const len1 = s1.length;
    const len2 = s2.length;

    if (len1 === 0 && len2 === 0) return 1;
    if (len1 === 0 || len2 === 0) return 0;

    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
        for (let i = 1; i <= len1; i++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,
                matrix[j - 1][i] + 1,
                matrix[j - 1][i - 1] + cost
            );
        }
    }

    const distance = matrix[len2][len1];
    const maxLength = Math.max(len1, len2);
    return 1 - (distance / maxLength);
};

const conversationalQuestionsBotView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (currentUserState.dataValues.questionNumber === null) {
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                const topicsList = await speakActivityQuestionRepository.getTopicsByLessonId(currentUserState.dataValues.currentLessonId);
                const topicSelectionResult = await topicSelection(profileId, userMobileNumber, currentUserState, messageContent, topicsList);
                if (!topicSelectionResult) {
                    return;
                }

                await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

                const firstConversationBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel, currentUserState.dataValues.currentTopic);

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
                    let recordExists = await waQuestionResponsesRepository.checkRecordExistsForProfileIdAndQuestionId(profileId, currentConversationBotQuestion.dataValues.id);
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
                        let previousMessages = [];

                        // Append transcript
                        let systemPrompt = { role: "assistant", content: currentConversationBotQuestion.dataValues.prompt };
                        previousMessages.push(systemPrompt);
                        let currentMessage = { role: "user", content: "Question: " + currentConversationBotQuestion.dataValues.question + "\n\nUser Response: " + recognizedText };
                        previousMessages.push(currentMessage);

                        // OpenAI Feedback
                        openaiFeedbackTranscript = await llmFeedback.azureOpenaiFeedback(previousMessages);
                        initialFeedbackResponse = openaiFeedbackTranscript;

                        // Extract corrected version of the answer
                        const correctedVersion = openaiFeedbackTranscript.match(/\[IMPROVED\](.*?)\[\/IMPROVED\]/);
                        if (correctedVersion) {
                            openaiFeedbackTranscript = openaiFeedbackTranscript.replace(/\[IMPROVED\](.*?)\[\/IMPROVED\]/, '');
                        }

                        if (currentConversationBotQuestion?.dataValues?.correctAudioFeedback || currentConversationBotQuestion?.dataValues?.wrongAudioFeedback) {
                            openaiFeedbackAudio = await textToSpeech.azureOpenAITextToSpeech(openaiFeedbackTranscript);
                            await sendMediaMessage(userMobileNumber, openaiFeedbackAudio, 'audio');
                            await createActivityLog(userMobileNumber, "audio", "outbound", openaiFeedbackAudio, null);
                            await sleep(5000);
                        }

                        // Send corrected version of the answer
                        if (correctedVersion) {
                            let correctMessage = course_languages[startingLesson.dataValues.courseLanguage]["question_bot_correct_message_part_one"] + correctedVersion[1] + course_languages[startingLesson.dataValues.courseLanguage]["question_bot_correct_message_part_two"];
                            await sendMessage(userMobileNumber, correctMessage);
                            await createActivityLog(userMobileNumber, "text", "outbound", correctMessage, null);
                        }
                    } else {
                        let latestBotResponse = await waQuestionResponsesRepository.getLatestBotResponse(profileId, userMobileNumber, currentUserState.dataValues.currentLessonId);
                        let improvedVersionMatch = latestBotResponse.match(/\[IMPROVED\](.*?)\[\/IMPROVED\]/);

                        if (improvedVersionMatch && improvedVersionMatch[1]) {
                            const improvedText = improvedVersionMatch[1].trim();
                            const userText = recognizedText.trim();

                            const similarity = calculateStringSimilarity(userText, improvedText);
                            const mismatchPercentage = (1 - similarity) * 100;

                            initialFeedbackResponse = `Similarity: ${(similarity * 100).toFixed(2)}%, Mismatch: ${mismatchPercentage.toFixed(2)}%`;

                            if (mismatchPercentage < 15) {
                                const okAudio = await waConstantsRepository.getByKey("OK_AUDIO");
                                hardcodedFeedbackAudio = okAudio.dataValues.constantValue;
                            } else {
                                const betterAudio = await waConstantsRepository.getByKey("BETTER_AUDIO");
                                hardcodedFeedbackAudio = betterAudio.dataValues.constantValue;
                            }

                            if (hardcodedFeedbackAudio) {
                                await sendMediaMessage(userMobileNumber, hardcodedFeedbackAudio, 'audio');
                                await createActivityLog(userMobileNumber, "audio", "outbound", hardcodedFeedbackAudio, null);
                                await sleep(2000);
                            }
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

                    // recordExists = await waQuestionResponsesRepository.checkRecordExistsForProfileIdAndQuestionId(profileId, currentConversationBotQuestion.dataValues.id);
                    if (recordExists && recordExists[0]?.dataValues?.submittedAnswerText == null) {
                        let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], currentConversationBotQuestion);
                        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                        return;
                    } else {
                        const nextConversationBotQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel, currentUserState.dataValues.currentTopic);
                        if (nextConversationBotQuestion) {
                            await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextConversationBotQuestion.dataValues.questionNumber);
                            await sendMediaMessage(userMobileNumber, nextConversationBotQuestion.dataValues.mediaFile, 'audio', null, 0, "SpeakActivityQuestion", nextConversationBotQuestion.dataValues.id, nextConversationBotQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                            await createActivityLog(userMobileNumber, "audio", "outbound", nextConversationBotQuestion.dataValues.mediaFile, null);

                            let acceptableMessagesList = await skipActivityFlow(userMobileNumber, startingLesson, ["audio"], nextConversationBotQuestion);
                            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessagesList);
                            return;
                        } else {
                            await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null, null);
                            await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
                        }
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
        }
        return;
    } catch (error) {
        console.error('Error sending lesson to user:', error);
        error.fileName = 'conversationalQuestionsBotView.js';
        throw error;
    }
};

export { conversationalQuestionsBotView };