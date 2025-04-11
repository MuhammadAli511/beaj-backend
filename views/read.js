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
import { createAndUploadScoreImage } from "../utils/imageGenerationUtils.js";
import { extractTranscript } from "../utils/utils.js";
import { removeHTMLTags } from "../utils/utils.js";

const readView = async (userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        if (persona == 'teacher') {
            if (messageType != 'audio') {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\n\nListen to the passage carefully.";
                // Text message
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send video content
                const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
                let videoURL = documentFile[0].dataValues.video;

                // Media message
                await sendMediaMessage(userMobileNumber, videoURL, 'video');
                await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
                await sleep(12000);

                // Remove html tags from the text
                const lessonText = startingLesson.dataValues.text;
                const cleanedLessonText = removeHTMLTags(lessonText);

                // Text message
                await sendMessage(userMobileNumber, "Send us a voice message of you reading this passage:\n\n" + cleanedLessonText);
                await createActivityLog(userMobileNumber, "text", "outbound", "Send us a voice message of you reading this passage:\n\n" + cleanedLessonText, null);
            }
            else if (messageType == 'audio') {
                // Get the current Read question text
                const lessonText = startingLesson.dataValues.text;

                // Remove HTML tags from the text
                const textWithoutHtmlTags = removeHTMLTags(lessonText);

                // Remove punctuation from the text
                const textWithoutPunctuationAndHtmlTags = textWithoutHtmlTags.replace(/[^a-z0-9 ]/gi, "").toLowerCase().trim();

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await AIServices.azurePronunciationAssessment(messageContent.data, textWithoutPunctuationAndHtmlTags);

                // Extract user transcription from words
                const userTranscription = extractTranscript(pronunciationAssessment);

                const imageUrl = await createAndUploadScoreImage(pronunciationAssessment);

                if (imageUrl) {
                    // Media message
                    await sendMediaMessage(userMobileNumber, imageUrl, 'image', "You said: " + userTranscription);
                    await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null, "You said: " + userTranscription);
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
                    startingLesson.dataValues.LessonId,
                    null,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    [userTranscription],
                    [userAudioFileUrl],
                    [imageUrl],
                    null,
                    [pronunciationAssessment],
                    null,
                    1,
                    submissionDate
                );

                // Reset Question Number, Retry Counter, and Activity Type
                await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                // Ending Message
                await endingMessage(userMobileNumber, currentUserState, startingLesson);
            }
        }
        else if (persona == 'kid') {
            if (messageType != 'audio') {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, startingLesson.dataValues.LessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Send lesson message
                let lessonMessage = startingLesson.dataValues.activityAlias + "\n\n" + "🧏 Listen first, then practice reading.";
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send video content
                const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
                let videoURL = documentFile[0].dataValues.video;

                // Media message
                const lessonText = startingLesson.dataValues.text;
                let instructionMessage = "Send us a voice message of you reading this passage:\n\n" + lessonText;
                if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                    instructionMessage += "\n\nOR\n\n" + "Type “next” to skip challenge";
                }
                await sendMediaMessage(userMobileNumber, videoURL, 'video', instructionMessage);
                await createActivityLog(userMobileNumber, "video", "outbound", videoURL, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["audio"]);
            }
            else if (messageType == 'audio') {
                // Get the current Read question text
                const lessonText = startingLesson.dataValues.text;

                // Remove HTML tags from the text
                const textWithoutHtmlTags = removeHTMLTags(lessonText);

                // Remove punctuation from the text
                const textWithoutPunctuationAndHtmlTags = textWithoutHtmlTags.replace(/[^a-z0-9 ]/gi, "").toLowerCase().trim();

                // Azure Pronunciation Assessment
                const pronunciationAssessment = await AIServices.azurePronunciationAssessment(messageContent.data, textWithoutPunctuationAndHtmlTags);

                // Extract user transcription from words
                const userTranscription = extractTranscript(pronunciationAssessment);

                const imageUrl = await createAndUploadScoreImage(pronunciationAssessment);

                if (imageUrl) {
                    // Media message
                    await sendMediaMessage(userMobileNumber, imageUrl, 'image', "You said: " + userTranscription);
                    await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null, "You said: " + userTranscription);
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
                    startingLesson.dataValues.LessonId,
                    null,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    [userTranscription],
                    [userAudioFileUrl],
                    [imageUrl],
                    null,
                    [pronunciationAssessment],
                    null,
                    1,
                    submissionDate
                );

                // Reset Question Number, Retry Counter, and Activity Type
                await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                // Ending Message
                await endingMessage(userMobileNumber, currentUserState, startingLesson);
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