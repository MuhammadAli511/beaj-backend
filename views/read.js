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
import AIServices from "../utils/AIServices.js";
import { createAndUploadScoreImage, createAndUploadKidsScoreImage } from "../utils/imageGenerationUtils.js";
import courseRepository from "../repositories/courseRepository.js";

const readView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (messageType != 'audio' && messageContent != 'yes' && messageContent != 'no, try again' && messageContent != 'no') {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                // Send lesson message
                let defaultTextInstruction = "Listen to the passage carefully.";
                const lessonTextInstruction = startingLesson.dataValues.textInstruction;
                let finalTextInstruction = defaultTextInstruction;
                if (lessonTextInstruction != null && lessonTextInstruction != "") {
                    finalTextInstruction = lessonTextInstruction.replace(/\\n/g, '\n');
                }
                const lessonAudioInstruction = startingLesson.dataValues.audioInstructionUrl;
                if (lessonAudioInstruction != null && lessonAudioInstruction != "") {
                    await sendMediaMessage(userMobileNumber, lessonAudioInstruction, 'audio', null, 0, "Lesson", startingLesson.dataValues.LessonId, startingLesson.dataValues.audioInstructionMediaId, "audioInstructionMediaId");
                    await createActivityLog(userMobileNumber, "audio", "outbound", lessonAudioInstruction, null);
                }

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias.replace(/\\n/g, '\n');;
                lessonMessage += "\n\n" + finalTextInstruction;
                // Text message
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send video content
                const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
                let videoURL = documentFile[0].dataValues.video;

                // Media message
                await sendMediaMessage(userMobileNumber, videoURL, 'video', null, 0, "DocumentFile", documentFile[0].dataValues.id, documentFile[0].dataValues.videoMediaId, "videoMediaId");
                await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                await sleep(12000);

                // Remove html tags from the text
                const lessonText = startingLesson.dataValues.text;

                // Text message
                await sendMessage(userMobileNumber, "Send us a voice message of you reading this passage:\n\n" + lessonText);
                await createActivityLog(userMobileNumber, "text", "outbound", "Send us a voice message of you reading this passage:\n\n" + lessonText, null);
            }
            else if (messageType == 'audio') {
                // Upload audio
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
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
                const pronunciationAssessment = await AIServices.azurePronunciationAssessment(audioBuffer, textWithoutPunctuationAndHtmlTags);

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

                // Send lesson message
                let defaultTextInstruction = "Listen to the passage carefully.";
                const lessonTextInstruction = startingLesson.dataValues.textInstruction;
                let finalTextInstruction = defaultTextInstruction;
                if (lessonTextInstruction != null && lessonTextInstruction != "") {
                    finalTextInstruction = lessonTextInstruction.replace(/\\n/g, '\n');
                }
                const lessonAudioInstruction = startingLesson.dataValues.audioInstructionUrl;
                if (lessonAudioInstruction != null && lessonAudioInstruction != "") {
                    await sendMediaMessage(userMobileNumber, lessonAudioInstruction, 'audio', null, 0, "Lesson", startingLesson.dataValues.LessonId, startingLesson.dataValues.audioInstructionMediaId, "audioInstructionMediaId");
                    await createActivityLog(userMobileNumber, "audio", "outbound", lessonAudioInstruction, null);
                }

                // Send lesson message
                let lessonMessage = startingLesson.dataValues.activityAlias.replace(/\\n/g, '\n');;
                lessonMessage += "\n\n" + finalTextInstruction;
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send video content
                const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
                let videoURL = documentFile[0].dataValues.video;

                // Media message
                const lessonText = startingLesson.dataValues.text;
                let instructionMessage = "Send us a voice message of you reading this passage:\n\n" + lessonText;
                if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                    instructionMessage += "\n\nOR\n\n" + "Type *next* to skip this activity!";
                }
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
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);
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
                const pronunciationAssessment = await AIServices.azurePronunciationAssessment(audioBuffer, textWithoutPunctuationAndHtmlTags);

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
        console.log('Error sending lesson to user:', error);
        error.fileName = 'readView.js';
        throw error;
    }
};

export { readView };