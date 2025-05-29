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
import { sleep, convertNumberToEmoji } from "../utils/utils.js";
import AIServices from "../utils/AIServices.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import { removeHTMLTags } from "../utils/utils.js";

const listenAndSpeakView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
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
                lessonMessage += "\n\nListen to the audio question and send your answer as a voice message.💬";

                // Text message
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Listen and Speak question
                const firstListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstListenAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                const mediaType = firstListenAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';
                await sendMediaMessage(userMobileNumber, firstListenAndSpeakQuestion.dataValues.mediaFile, mediaType, null, 0, "SpeakActivityQuestion", firstListenAndSpeakQuestion.dataValues.id, firstListenAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, mediaType, "outbound", firstListenAndSpeakQuestion.dataValues.mediaFile, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                await sleep(5000);

                // Send question text
                const questionText = firstListenAndSpeakQuestion.dataValues.question.replace(/\\n/g, '\n');
                await sendMessage(userMobileNumber, questionText);
                await createActivityLog(userMobileNumber, "text", "outbound", questionText, null);

                return;
            }
            else if (messageType === 'audio') {
                // Get the current Listen and Speak question
                const currentListenAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                const answersArray = currentListenAndSpeakQuestion.dataValues.answer;
                let prompt = answersArray[0];
                let recognizedText = await AIServices.openaiSpeechToTextWithPrompt(messageContent.data, prompt);
                if (recognizedText) {
                    // Checking if user response is correct or not

                    let userAnswerIsCorrect = false;
                    const recognizedTextCleaned = recognizedText.replace(/[^a-z0-9 ]/gi, "").toLowerCase().trim();
                    for (let i = 0; i < answersArray.length; i++) {
                        const answerCleaned = answersArray[i].replace(/[^a-z0-9 ]/gi, "").toLowerCase().trim();
                        if (recognizedTextCleaned == answerCleaned) {
                            userAnswerIsCorrect = true;
                            break;
                        }
                    }
                    if (!userAnswerIsCorrect) {
                        userAnswerIsCorrect = false;
                    }

                    // Uploading user audio to Azure Blob Storage
                    const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                    const uniqueID = uuidv4();
                    const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                    const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);

                    // Save user response to the database
                    const submissionDate = new Date();
                    const retryCounter = currentUserState.dataValues.retryCounter;
                    // User first attempt
                    if (retryCounter == 0 || retryCounter == null) {
                        await waUserProgressRepository.updateRetryCounter(profileId, userMobileNumber, 1);
                        await waQuestionResponsesRepository.create(
                            profileId,
                            userMobileNumber,
                            currentUserState.dataValues.currentLessonId,
                            currentListenAndSpeakQuestion.dataValues.id,
                            activity,
                            startingLesson.dataValues.activityAlias,
                            [recognizedText],
                            [userAudioFileUrl],
                            null,
                            null,
                            null,
                            [userAnswerIsCorrect],
                            retryCounter + 1,
                            submissionDate
                        );
                    }
                    // User other attempts
                    else {
                        await waQuestionResponsesRepository.update(
                            profileId,
                            userMobileNumber,
                            currentUserState.dataValues.currentLessonId,
                            currentListenAndSpeakQuestion.dataValues.id,
                            activity,
                            startingLesson.dataValues.activityAlias,
                            recognizedText,
                            userAudioFileUrl,
                            null,
                            null,
                            null,
                            userAnswerIsCorrect,
                            retryCounter + 1,
                            submissionDate
                        );
                    }
                    // If user response is correct
                    if (userAnswerIsCorrect) {
                        // Reset retry counter
                        await waUserProgressRepository.updateRetryCounter(profileId, userMobileNumber, 0);

                        // Text message
                        let correctMessage = "You said:\n\n" + recognizedText + "\n✅ Great!";
                        await sendMessage(userMobileNumber, correctMessage);
                        await createActivityLog(userMobileNumber, "text", "outbound", correctMessage, null);
                    }
                    // If user response is incorrect
                    else {
                        if (retryCounter !== 2) {
                            // Update retry counter
                            await waUserProgressRepository.updateRetryCounter(profileId, userMobileNumber, currentUserState.dataValues.retryCounter + 1);

                            // Text message
                            let wrongMessage = "You said:\n\n" + recognizedText + "\n❌ Try Again!";
                            await sendMessage(userMobileNumber, wrongMessage);
                            await createActivityLog(userMobileNumber, "text", "outbound", wrongMessage, null);
                            return;
                        } else if (retryCounter == 2) {
                            // Reset retry counter
                            await waUserProgressRepository.updateRetryCounter(profileId, userMobileNumber, 0);

                            // Text message
                            let wrongMessage = "You said:\n\n" + recognizedText + "\n❌ The correct answer is: " + answersArray[0];
                            await sendMessage(userMobileNumber, wrongMessage);
                            await createActivityLog(userMobileNumber, "text", "outbound", wrongMessage, null);
                        }
                    }
                    const nextListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                    if (nextListenAndSpeakQuestion) {
                        // Update question number
                        await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextListenAndSpeakQuestion.dataValues.questionNumber);

                        const mediaType = nextListenAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';
                        if (mediaType == 'video') {
                            await sendMediaMessage(userMobileNumber, nextListenAndSpeakQuestion.dataValues.mediaFile, 'video', null, 0, "SpeakActivityQuestion", nextListenAndSpeakQuestion.dataValues.id, nextListenAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                            await createActivityLog(userMobileNumber, "video", "outbound", nextListenAndSpeakQuestion.dataValues.mediaFile, null);
                        }

                        // Update acceptable messages list for the user
                        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                        if (mediaType == 'video') {
                            await sleep(5000);
                        }


                        // Text message
                        const questionText = nextListenAndSpeakQuestion.dataValues.question.replace(/\\n/g, '\n');
                        await sendMessage(userMobileNumber, questionText);
                        await createActivityLog(userMobileNumber, "text", "outbound", questionText, null);
                    } else {
                        // Calculate total score and send message
                        const totalScore = await waQuestionResponsesRepository.getTotalScore(profileId, userMobileNumber, currentUserState.dataValues.currentLessonId);
                        const totalQuestions = await waQuestionResponsesRepository.getTotalQuestions(profileId, userMobileNumber, currentUserState.dataValues.currentLessonId);
                        const scorePercentage = (totalScore / totalQuestions) * 100;
                        let message = "*Your score: " + totalScore + "/" + totalQuestions + ".*";
                        if (scorePercentage >= 0 && scorePercentage <= 60) {
                            message += "\n\nGood Effort! 👍🏽";
                            // Text message
                            await sendMessage(userMobileNumber, message);
                            await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                        } else if (scorePercentage >= 61 && scorePercentage <= 79) {
                            message += "\n\nWell done! 🌟";
                            // Text message
                            await sendMessage(userMobileNumber, message);
                            await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                        } else if (scorePercentage >= 80) {
                            message += "\n\nExcellent 🎉";
                            // Text message
                            await sendMessage(userMobileNumber, message);
                            await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                        }

                        // Reset Question Number, Retry Counter, and Activity Type
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null);

                        // ENDING MESSAGE
                        await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
                    }
                } else {
                    let logger = `No speech recognized or an error occurred. User: ${userMobileNumber}, Message Type: ${messageType}, Message Content: ${messageContent}`;
                    console.log(logger);
                }
            }
        }
        else if (persona == 'kid') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                let lessonText = startingLesson.dataValues.text;
                lessonText = lessonText.replace(/\\n/g, '\n');
                let lessonMessage = startingLesson.dataValues.activityAlias.replace(/\\n/g, '\n') + "\n\n" + lessonText;

                // Text message
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first Listen and Speak question
                const firstListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstListenAndSpeakQuestion.dataValues.questionNumber);

                // Send question media file
                const mediaType = firstListenAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';
                await sendMediaMessage(userMobileNumber, firstListenAndSpeakQuestion.dataValues.mediaFile, mediaType, null, 0, "SpeakActivityQuestion", firstListenAndSpeakQuestion.dataValues.id, firstListenAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, mediaType, "outbound", firstListenAndSpeakQuestion.dataValues.mediaFile, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                if (mediaType == 'video') {
                    await sleep(5000);
                } else {
                    await sleep(2000);
                }

                // Send question text
                if (firstListenAndSpeakQuestion.dataValues.question != null && firstListenAndSpeakQuestion.dataValues.question != "") {
                    const questionText = firstListenAndSpeakQuestion.dataValues.question.replace(/\\n/g, '\n');
                    await sendMessage(userMobileNumber, questionText);
                    await createActivityLog(userMobileNumber, "text", "outbound", questionText, null);
                }

                const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);

                // Instructions
                let instructions = "👉 *Question " + await convertNumberToEmoji(firstListenAndSpeakQuestion.dataValues.questionNumber) + " of " + totalQuestions + "*\n\n";
                instructions += "Record a voice message:\nوائس میسج ریکارڈ کریں";
                if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                    instructions += "\nOR\n" + "or Type *next* to skip this activity!";
                }
                await sendMessage(userMobileNumber, instructions);
                await createActivityLog(userMobileNumber, "text", "outbound", instructions, null);

                return;
            }
            else if (messageType === 'audio') {
                // Get the current Listen and Speak question
                const currentListenAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                const answersArray = currentListenAndSpeakQuestion.dataValues.answer;
                let prompt = answersArray[0];
                let recognizedText = await AIServices.openaiSpeechToTextWithPrompt(messageContent.data, prompt);
                if (recognizedText) {
                    // Checking if user response is correct or not

                    let userAnswerIsCorrect = false;
                    const recognizedTextCleaned = recognizedText.replace(/[^a-z0-9 ]/gi, "").toLowerCase().trim();
                    for (let i = 0; i < answersArray.length; i++) {
                        const answerCleaned = answersArray[i].replace(/[^a-z0-9 ]/gi, "").toLowerCase().trim();
                        if (recognizedTextCleaned == answerCleaned) {
                            userAnswerIsCorrect = true;
                            break;
                        }
                    }
                    if (!userAnswerIsCorrect) {
                        userAnswerIsCorrect = false;
                    }

                    // Uploading user audio to Azure Blob Storage
                    const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                    const uniqueID = uuidv4();
                    const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                    const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio);

                    // Save user response to the database
                    const submissionDate = new Date();
                    const retryCounter = currentUserState.dataValues.retryCounter;
                    // User first attempt
                    if (retryCounter == 0 || retryCounter == null) {
                        await waUserProgressRepository.updateRetryCounter(profileId, userMobileNumber, 1);
                        await waQuestionResponsesRepository.create(
                            profileId,
                            userMobileNumber,
                            currentUserState.dataValues.currentLessonId,
                            currentListenAndSpeakQuestion.dataValues.id,
                            activity,
                            startingLesson.dataValues.activityAlias,
                            [recognizedText],
                            [userAudioFileUrl],
                            null,
                            null,
                            null,
                            [userAnswerIsCorrect],
                            retryCounter + 1,
                            submissionDate
                        );
                    }
                    // User other attempts
                    else {
                        await waQuestionResponsesRepository.update(
                            profileId,
                            userMobileNumber,
                            currentUserState.dataValues.currentLessonId,
                            currentListenAndSpeakQuestion.dataValues.id,
                            activity,
                            startingLesson.dataValues.activityAlias,
                            recognizedText,
                            userAudioFileUrl,
                            null,
                            null,
                            null,
                            userAnswerIsCorrect,
                            retryCounter + 1,
                            submissionDate
                        );
                    }
                    // If user response is correct
                    if (userAnswerIsCorrect) {
                        // Reset retry counter
                        await waUserProgressRepository.updateRetryCounter(profileId, userMobileNumber, 0);

                        // Text message
                        let correctMessage = "You said:\n\n" + recognizedText + "\n✅ That's right!";
                        await sendMessage(userMobileNumber, correctMessage);
                        await createActivityLog(userMobileNumber, "text", "outbound", correctMessage, null);
                    }
                    // If user response is incorrect
                    else {
                        if (retryCounter !== 1) {
                            // Update retry counter
                            await waUserProgressRepository.updateRetryCounter(profileId, userMobileNumber, currentUserState.dataValues.retryCounter + 1);

                            // Text message
                            let wrongMessage = "You said:\n\n" + recognizedText + "\n❌ Try Again!";
                            await sendMessage(userMobileNumber, wrongMessage);
                            await createActivityLog(userMobileNumber, "text", "outbound", wrongMessage, null);
                            return;
                        } else if (retryCounter == 1) {
                            // Reset retry counter
                            await waUserProgressRepository.updateRetryCounter(profileId, userMobileNumber, 0);

                            // Text message
                            let wrongMessage = "You said:\n\n" + recognizedText + "\n❌ The correct answer is: " + answersArray[0];
                            await sendMessage(userMobileNumber, wrongMessage);
                            await createActivityLog(userMobileNumber, "text", "outbound", wrongMessage, null);
                        }
                    }
                    const nextListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                    if (nextListenAndSpeakQuestion) {
                        // Update question number
                        await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextListenAndSpeakQuestion.dataValues.questionNumber);

                        const mediaType = nextListenAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';
                        if (mediaType == 'video') {
                            await sendMediaMessage(userMobileNumber, nextListenAndSpeakQuestion.dataValues.mediaFile, 'video', null, 0, "SpeakActivityQuestion", nextListenAndSpeakQuestion.dataValues.id, nextListenAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                            await createActivityLog(userMobileNumber, "video", "outbound", nextListenAndSpeakQuestion.dataValues.mediaFile, null);
                        }

                        // Update acceptable messages list for the user
                        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                        if (mediaType == 'video') {
                            await sleep(5000);
                        } else {
                            await sleep(2000);
                        }


                        // Text message
                        const questionText = nextListenAndSpeakQuestion.dataValues.question.replace(/\\n/g, '\n');
                        if (questionText != null && questionText != "") {
                            await sendMessage(userMobileNumber, questionText);
                            await createActivityLog(userMobileNumber, "text", "outbound", questionText, null);
                        }

                        // Instructions
                        const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);
                        let instructions = "👉 *Question " + await convertNumberToEmoji(nextListenAndSpeakQuestion.dataValues.questionNumber) + " of " + totalQuestions + "*\n\n";
                        instructions += "Record a voice message:\nوائس میسج ریکارڈ کریں";
                        if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                            instructions += "\nOR\n" + "or Type *next* to skip this activity!";
                        }
                        await sendMessage(userMobileNumber, instructions);
                        await createActivityLog(userMobileNumber, "text", "outbound", instructions, null);
                    } else {
                        // Calculate total score and send message
                        const totalScore = await waQuestionResponsesRepository.getTotalScore(profileId, userMobileNumber, currentUserState.dataValues.currentLessonId);
                        const totalQuestions = await waQuestionResponsesRepository.getTotalQuestions(profileId, userMobileNumber, currentUserState.dataValues.currentLessonId);
                        const scorePercentage = (totalScore / totalQuestions) * 100;
                        let message = "Your score: " + totalScore + "/" + totalQuestions + ".";
                        if (scorePercentage >= 0 && scorePercentage <= 60) {
                            message += "\n\nGood Effort! 👍🏽";
                        } else if (scorePercentage >= 61 && scorePercentage <= 79) {
                            message += "\n\nWell done! 🌟";
                        } else if (scorePercentage >= 80) {
                            message += "\n\nExcellent 🎉";
                        }

                        // Reset Question Number, Retry Counter, and Activity Type
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null);

                        // ENDING MESSAGE
                        await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson, message);
                    }
                } else {
                    let logger = `No speech recognized or an error occurred. User: ${userMobileNumber}, Message Type: ${messageType}, Message Content: ${messageContent}`;
                    console.log(logger);
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

export { listenAndSpeakView };