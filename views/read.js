import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import documentFileRepository from "../repositories/documentFileRepository.js";
import { sendMessage, sendButtonMessage, sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import azureBlobStorage from "../utils/azureBlobStorage.js";
import { sleep, extractTranscript, getAudioBufferFromAudioFileUrl, getLevelFromCourseName } from "../utils/utils.js";
import speechToText from "../utils/speechToText.js";
import { createAndUploadScoreImage, createAndUploadKidsScoreImage } from "../utils/imageGenerationUtils.js";
import courseRepository from "../repositories/courseRepository.js";
import { sendAliasAndStartingInstruction } from "../utils/aliasAndInstructionsUtils.js";

const readView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (messageType != 'audio' && messageContent != 'yes' && messageContent != 'no, try again' && messageContent != 'no') {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                // Send alias and starting instruction
                await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

                // Send video content
                const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
                let videoURL = documentFile[0].dataValues.video;

                const lessonText = startingLesson.dataValues.text;

                let finalCaptionText = "Send us a voice message of you reading this passage:\n\n" + lessonText;

                // Media message
                await sendMediaMessage(userMobileNumber, videoURL, 'video', finalCaptionText, 0, "DocumentFile", documentFile[0].dataValues.id, documentFile[0].dataValues.videoMediaId, "videoMediaId");
                await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null, finalCaptionText);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
            }
            else if (messageType == 'audio') {
                // Upload audio
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio, "audio/ogg");
                const submissionDate = new Date();

                const existingAudioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(
                    profileId,
                    null,
                    startingLesson.dataValues.LessonId
                );

                if (existingAudioUrl) {
                    // Update existing record with new audio
                    await waQuestionResponsesRepository.updateReplace(
                        profileId,
                        userMobileNumber,
                        startingLesson.dataValues.LessonId,
                        null,
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
                        startingLesson.dataValues.LessonId,
                        null,
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
                // Get the uploaded audio
                const audioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(profileId, null, startingLesson.dataValues.LessonId);

                // Get audio buffer for processing
                const audioBuffer = await getAudioBufferFromAudioFileUrl(audioUrl);

                // Get the current Read question text
                const lessonText = startingLesson.dataValues.text;

                // Remove punctuation from the text
                const textWithoutPunctuationAndHtmlTags = lessonText.replace(/[^a-z0-9 ]/gi, "").toLowerCase().trim();

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await speechToText.azurePronunciationAssessment(audioBuffer, textWithoutPunctuationAndHtmlTags);

                // Extract user transcription from words
                const userTranscription = extractTranscript(pronunciationAssessment);

                const imageUrl = await createAndUploadScoreImage(pronunciationAssessment, 70);

                if (imageUrl) {
                    // Media message
                    await sendMediaMessage(userMobileNumber, imageUrl, 'image', "You said: " + userTranscription);
                    await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null, "You said: " + userTranscription);
                    await sleep(5000);
                }

                // Update user response to the database with processing results
                const submissionDate = new Date();
                await waQuestionResponsesRepository.updateReplace(
                    profileId,
                    userMobileNumber,
                    startingLesson.dataValues.LessonId,
                    null,
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

                // Reset Question Number, Retry Counter, and Activity Type
                await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

                // Ending Message
                await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
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
            if (messageType != 'audio' && messageContent != 'yes' && messageContent != 'no, try again' && messageContent != 'no') {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                // Send alias and starting instruction
                await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

                // Send video content
                const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
                let videoURL = documentFile[0].dataValues.video;

                // Media message
                const lessonText = startingLesson.dataValues.text;
                let instructionMessage = "Send us a voice message of you reading this passage:\n\n" + lessonText;
                await sendMediaMessage(userMobileNumber, videoURL, 'video', instructionMessage, 0, "DocumentFile", documentFile[0].dataValues.id, documentFile[0].dataValues.videoMediaId, "videoMediaId");
                await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
            }
            else if (messageType == 'audio') {
                // Upload audio
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio, "audio/ogg");
                const submissionDate = new Date();

                const existingAudioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(
                    profileId,
                    null,
                    startingLesson.dataValues.LessonId
                );

                if (existingAudioUrl) {
                    // Update existing record with new audio
                    await waQuestionResponsesRepository.updateReplace(
                        profileId,
                        userMobileNumber,
                        startingLesson.dataValues.LessonId,
                        null,
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
                        startingLesson.dataValues.LessonId,
                        null,
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
                // Get the uploaded audio
                const audioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(profileId, null, startingLesson.dataValues.LessonId);

                // Get audio buffer for processing
                const audioBuffer = await getAudioBufferFromAudioFileUrl(audioUrl);

                // Get the current Read question text
                const lessonText = startingLesson.dataValues.text;

                // Remove punctuation from the text
                const textWithoutPunctuationAndHtmlTags = lessonText.replace(/[^a-z0-9 ]/gi, "").toLowerCase().trim();

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await speechToText.azurePronunciationAssessment(audioBuffer, textWithoutPunctuationAndHtmlTags);

                // Extract user transcription from words
                const userTranscription = extractTranscript(pronunciationAssessment);

                const courseName = await courseRepository.getCourseNameById(currentUserState.dataValues.currentCourseId);
                let level = getLevelFromCourseName(courseName);
                if (level == 4) {
                    level = 3;
                }
                const imageUrl = await createAndUploadKidsScoreImage(pronunciationAssessment, 80, level);

                if (imageUrl) {
                    // Media message
                    await sendMediaMessage(userMobileNumber, imageUrl, 'image', "You said: " + userTranscription);
                    await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null, "You said: " + userTranscription);
                    await sleep(5000);
                }

                // Update user response to the database with processing results
                const submissionDate = new Date();
                await waQuestionResponsesRepository.updateReplace(
                    profileId,
                    userMobileNumber,
                    startingLesson.dataValues.LessonId,
                    null,
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

                // Reset Question Number, Retry Counter, and Activity Type
                await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

                // Ending Message
                await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
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
        console.error('Error sending lesson to user:', error);
        error.fileName = 'readView.js';
        throw error;
    }
};

export { readView };