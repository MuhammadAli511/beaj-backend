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
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import { removeHTMLTags } from "../utils/utils.js";

const feedbackAudioView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                // Lesson Text
                let lessonText = startingLesson.dataValues.text;
                lessonText = removeHTMLTags(lessonText);
                if (lessonText == "Let's Start Questions👇🏽") {
                    await sendMessage(userMobileNumber, lessonText);
                    await createActivityLog(userMobileNumber, "text", "outbound", lessonText, null);
                }

                // Send lesson message
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                lessonMessage += "\n\nListen to the audio instruction and send your response as a voice message.💬\nOR\n" + "Type “next” to skip";

                // Text message
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Listen and Speak question
                const firstListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstListenAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                const mediaType = firstListenAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';
                await sendMediaMessage(userMobileNumber, firstListenAndSpeakQuestion.dataValues.mediaFile, mediaType, null, 0, "SpeakActivityQuestion", firstListenAndSpeakQuestion.dataValues.id, firstListenAndSpeakQuestion.dataValues.audioMediaId);
                await createActivityLog(userMobileNumber, mediaType, "outbound", firstListenAndSpeakQuestion.dataValues.mediaFile, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);

                return;
            }
            else if (messageType === 'audio') {
                // Get the current Listen and Speak question
                const currentListenAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Uploading user audio to Azure Blob Storage
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);

                // Save user response to the database
                const submissionDate = new Date();
                const retryCounter = currentUserState.dataValues.retryCounter;
                // User first attempt
                await waQuestionResponsesRepository.create(
                    profileId,
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentListenAndSpeakQuestion.dataValues.id,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    null,
                    [userAudioFileUrl],
                    null,
                    null,
                    null,
                    null,
                    retryCounter + 1,
                    submissionDate
                );

                const nextListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                if (nextListenAndSpeakQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextListenAndSpeakQuestion.dataValues.questionNumber);

                    const mediaType = nextListenAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';
                    if (mediaType == 'video') {
                        await sendMediaMessage(userMobileNumber, nextListenAndSpeakQuestion.dataValues.mediaFile, 'video', null, 0, "SpeakActivityQuestion", nextListenAndSpeakQuestion.dataValues.id, nextListenAndSpeakQuestion.dataValues.videoMediaId);
                        await createActivityLog(userMobileNumber, "video", "outbound", nextListenAndSpeakQuestion.dataValues.mediaFile, null);
                    }

                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                    if (mediaType == 'video') {
                        await sleep(5000);
                    }

                } else {
                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null);

                    // ENDING MESSAGE
                    await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
                }

            }
        }
        return;
    } catch (error) {
        console.log('Error sending lesson to user:', error);
        error.fileName = 'listenAndSpeakView.js';
        throw error;
    }
};

export { feedbackAudioView };