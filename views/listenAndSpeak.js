import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import { sendMessage, sendButtonMessage, sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import azureBlobStorage from "../utils/azureBlobStorage.js";
import { sleep, convertNumberToEmoji, difficultyLevelCalculation, getAudioBufferFromAudioFileUrl } from "../utils/utils.js";
import speechToText from "../utils/speechToText.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import { sendAliasAndStartingInstruction } from "../utils/aliasAndInstructionsUtils.js";

const listenAndSpeakView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                // Difficulty Level Calculation
                const difficultyLevelCalculationResult = await difficultyLevelCalculation(profileId, userMobileNumber, currentUserState, messageContent);
                if (!difficultyLevelCalculationResult) {
                    return;
                }

                // Send alias and starting instruction
                await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

                // Send first Listen and Speak question
                const firstListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstListenAndSpeakQuestion.dataValues.questionNumber);
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);

                // Send question media file
                const mediaType = firstListenAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';
                await sendMediaMessage(userMobileNumber, firstListenAndSpeakQuestion.dataValues.mediaFile, mediaType, null, 0, "SpeakActivityQuestion", firstListenAndSpeakQuestion.dataValues.id, firstListenAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, mediaType, "outbound", firstListenAndSpeakQuestion.dataValues.mediaFile, null);

                let secondMediaType = null;
                if (firstListenAndSpeakQuestion?.dataValues?.mediaFileSecond) {
                    secondMediaType = firstListenAndSpeakQuestion?.dataValues?.mediaFileSecond?.endsWith('.mp4') ? 'video' : 'audio';
                }

                if (mediaType == 'video') {
                    await sleep(5000);
                } else {
                    await sleep(2000);
                }

                if (secondMediaType != null && secondMediaType != "null" && secondMediaType != "") {
                    console.log("HERE")
                    await sendMediaMessage(userMobileNumber, firstListenAndSpeakQuestion.dataValues.mediaFileSecond, secondMediaType, null, 0, "SpeakActivityQuestion", firstListenAndSpeakQuestion.dataValues.id, firstListenAndSpeakQuestion.dataValues.mediaFileSecondMediaId, "mediaFileSecondMediaId");
                    await createActivityLog(userMobileNumber, secondMediaType, "outbound", firstListenAndSpeakQuestion.dataValues.mediaFileSecond, null);
                    if (secondMediaType == 'video') {
                        await sleep(5000);
                    } else {
                        await sleep(2000);
                    }
                }

                // Send question text
                const questionText = firstListenAndSpeakQuestion.dataValues.question.replace(/\\n/g, '\n');
                await sendMessage(userMobileNumber, questionText);
                await createActivityLog(userMobileNumber, "text", "outbound", questionText, null);

                return;
            }
            else if (messageType === 'audio') {
                // Get the current Listen and Speak question
                const currentListenAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Upload audio
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio, "audio/ogg");
                const submissionDate = new Date();

                const existingAudioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(
                    profileId,
                    currentListenAndSpeakQuestion.dataValues.id,
                    currentUserState.dataValues.currentLessonId
                );

                if (existingAudioUrl) {
                    // Update existing record with new audio
                    await waQuestionResponsesRepository.updateReplace(
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
                        1,
                        submissionDate
                    );
                } else {
                    // Create new record if none exists
                    const response = await waQuestionResponsesRepository.create(
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
                // Get the current Listen and Speak question
                const currentListenAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Get the uploaded audio
                const audioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(profileId, currentListenAndSpeakQuestion.dataValues.id, currentUserState.dataValues.currentLessonId);

                // Get audio buffer for processing
                const audioBuffer = await getAudioBufferFromAudioFileUrl(audioUrl);

                const answersArray = currentListenAndSpeakQuestion.dataValues.answer;
                let prompt = "Transcribe the audio, if it is empty return nothing";
                let recognizedText = null;
                try {
                    recognizedText = await speechToText.azureOpenAISpeechToText(audioBuffer, prompt);
                } catch (error) {
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                    await waQuestionResponsesRepository.deleteRecord(profileId, userMobileNumber, currentUserState.dataValues.currentLessonId, currentListenAndSpeakQuestion.dataValues.id);
                    let errorMessage = "Sorry! We did not understand that.\n\nPlease record a *new* voice message. Do not forward the previously recorded voice message.";
                    await sendMessage(userMobileNumber, errorMessage);
                    await createActivityLog(userMobileNumber, "text", "outbound", errorMessage, null);
                    return;
                }
                if (recognizedText) {
                    // Checking if user response is correct or not

                    let userAnswerIsCorrect = false;
                    const recognizedTextCleaned = recognizedText.replace(/[^a-z0-9 ]/gi, "").toLowerCase().trim();
                    for (const mcqOptionAnswer of answersArray) {
                        const answerCleaned = mcqOptionAnswer.replace(/[^a-z0-9 ]/gi, "").toLowerCase().trim();
                        if (recognizedTextCleaned == answerCleaned) {
                            userAnswerIsCorrect = true;
                            break;
                        }
                    }
                    if (!userAnswerIsCorrect) {
                        userAnswerIsCorrect = false;
                    }

                    // Update user response to the database with processing results
                    const submissionDate = new Date();
                    const retryCounter = currentUserState.dataValues.retryCounter;
                    // User first attempt
                    if (retryCounter == 0 || retryCounter == null) {
                        await waUserProgressRepository.updateRetryCounter(profileId, userMobileNumber, 1);
                        await waQuestionResponsesRepository.updateReplace(
                            profileId,
                            userMobileNumber,
                            currentUserState.dataValues.currentLessonId,
                            currentListenAndSpeakQuestion.dataValues.id,
                            activity,
                            startingLesson.dataValues.activityAlias,
                            [recognizedText],
                            [audioUrl],
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
                            audioUrl,
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

                            // Update acceptable messages list for the user
                            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
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
                    const nextListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel);
                    if (nextListenAndSpeakQuestion) {
                        // Update question number
                        await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextListenAndSpeakQuestion.dataValues.questionNumber);
                        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);

                        if (nextListenAndSpeakQuestion.dataValues.mediaFile) {
                            const mediaType = nextListenAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';
                            await sendMediaMessage(userMobileNumber, nextListenAndSpeakQuestion.dataValues.mediaFile, mediaType, null, 0, "SpeakActivityQuestion", nextListenAndSpeakQuestion.dataValues.id, nextListenAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                            await createActivityLog(userMobileNumber, mediaType, "outbound", nextListenAndSpeakQuestion.dataValues.mediaFile, null);
                            if (mediaType == 'video') {
                                await sleep(5000);
                            } else {
                                await sleep(2000);
                            }
                        }
                        let secondMediaType = null;
                        if (nextListenAndSpeakQuestion?.dataValues?.mediaFileSecond) {
                            secondMediaType = nextListenAndSpeakQuestion?.dataValues?.mediaFileSecond?.endsWith('.mp4') ? 'video' : 'audio';
                        }
                        if (secondMediaType != null && secondMediaType != "null" && secondMediaType != "") {
                            await sendMediaMessage(userMobileNumber, nextListenAndSpeakQuestion.dataValues.mediaFileSecond, secondMediaType, null, 0, "SpeakActivityQuestion", nextListenAndSpeakQuestion.dataValues.id, nextListenAndSpeakQuestion.dataValues.mediaFileSecondMediaId, "mediaFileSecondMediaId");
                            await createActivityLog(userMobileNumber, secondMediaType, "outbound", nextListenAndSpeakQuestion.dataValues.mediaFileSecond, null);
                            if (secondMediaType == 'video') {
                                await sleep(5000);
                            } else {
                                await sleep(2000);
                            }
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
                            message += "\n\nExcellent! 🎉";
                            // Text message
                            await sendMessage(userMobileNumber, message);
                            await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                        }

                        // Reset Question Number, Retry Counter, and Activity Type
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

                        // ENDING MESSAGE
                        await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
                    }
                } else {
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                    await waQuestionResponsesRepository.deleteRecord(profileId, userMobileNumber, currentUserState.dataValues.currentLessonId, currentListenAndSpeakQuestion.dataValues.id);
                    let errorMessage = "Sorry! We did not understand that.\n\nPlease record a *new* voice message. Do not forward the previously recorded voice message.";
                    await sendMessage(userMobileNumber, errorMessage);
                    await createActivityLog(userMobileNumber, "text", "outbound", errorMessage, null);
                }
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
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                // Difficulty Level Calculation
                const difficultyLevelCalculationResult = await difficultyLevelCalculation(profileId, userMobileNumber, currentUserState, messageContent);
                if (!difficultyLevelCalculationResult) {
                    return;
                }

                // Send alias and starting instruction
                await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

                // Send first Listen and Speak question
                const firstListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, null, currentUserState.dataValues.currentDifficultyLevel);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstListenAndSpeakQuestion.dataValues.questionNumber);


                // Question Text
                const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);
                let instructions = "👉 *Question " + await convertNumberToEmoji(firstListenAndSpeakQuestion.dataValues.questionNumber) + " of " + totalQuestions + "*\n\n";
                instructions += "Record a voice message.";
                if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                    instructions += "\nOR\n" + "or Type *next* to skip this activity!";
                }
                if (currentUserState.dataValues.currentCourseId == 143) {
                    instructions += "\n\n" + firstListenAndSpeakQuestion.dataValues.question.replace(/\\n/g, '\n');
                }

                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                // Send question media file
                const mediaType = firstListenAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';
                await sendMediaMessage(userMobileNumber, firstListenAndSpeakQuestion.dataValues.mediaFile, mediaType, instructions, 0, "SpeakActivityQuestion", firstListenAndSpeakQuestion.dataValues.id, firstListenAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                await createActivityLog(userMobileNumber, mediaType, "outbound", firstListenAndSpeakQuestion.dataValues.mediaFile, null, instructions);
                if (mediaType == 'video') {
                    await sleep(5000);
                } else {
                    await sleep(2000);
                }
                let secondMediaType = null;
                if (firstListenAndSpeakQuestion?.dataValues?.mediaFileSecond) {
                    secondMediaType = firstListenAndSpeakQuestion?.dataValues?.mediaFileSecond?.endsWith('.mp4') ? 'video' : 'audio';
                }
                if (secondMediaType != null && secondMediaType != "null" && secondMediaType != "") {
                    await sendMediaMessage(userMobileNumber, firstListenAndSpeakQuestion.dataValues.mediaFileSecond, secondMediaType, null, 0, "SpeakActivityQuestion", firstListenAndSpeakQuestion.dataValues.id, firstListenAndSpeakQuestion.dataValues.mediaFileSecondMediaId, "mediaFileSecondMediaId");
                    await createActivityLog(userMobileNumber, secondMediaType, "outbound", firstListenAndSpeakQuestion.dataValues.mediaFileSecond, null);
                    if (secondMediaType == 'video') {
                        await sleep(5000);
                    } else {
                        await sleep(2000);
                    }
                }

                if (mediaType == 'audio') {
                    await sendMessage(userMobileNumber, instructions);
                    await createActivityLog(userMobileNumber, "text", "outbound", instructions, null);
                }

                return;
            }
            else if (messageType === 'audio') {
                // Get the current Listen and Speak question
                const currentListenAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Upload audio
                const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
                const uniqueID = uuidv4();
                const userAudio = `${timestamp}-${uniqueID}-` + "audioFile.opus";
                const userAudioFileUrl = await azureBlobStorage.uploadToBlobStorage(messageContent.data, userAudio, "audio/ogg");
                const submissionDate = new Date();

                const existingAudioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(
                    profileId,
                    currentListenAndSpeakQuestion.dataValues.id,
                    currentUserState.dataValues.currentLessonId
                );

                if (existingAudioUrl) {
                    // Update existing record with new audio
                    await waQuestionResponsesRepository.updateReplace(
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
                        1,
                        submissionDate
                    );
                } else {
                    // Create new record if none exists
                    const response = await waQuestionResponsesRepository.create(
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
                // Get the current Listen and Speak question
                const currentListenAndSpeakQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // Get the uploaded audio
                const audioUrl = await waQuestionResponsesRepository.getAudioUrlForProfileIdAndQuestionIdAndLessonId(profileId, currentListenAndSpeakQuestion.dataValues.id, currentUserState.dataValues.currentLessonId);

                // Get audio buffer for processing
                const audioBuffer = await getAudioBufferFromAudioFileUrl(audioUrl);

                const answersArray = currentListenAndSpeakQuestion.dataValues.answer;
                let prompt = "Transcribe the audio, if it is empty return nothing";
                let recognizedText = null;
                try {
                    recognizedText = await speechToText.azureOpenAISpeechToText(audioBuffer, prompt);
                } catch (error) {
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                    await waQuestionResponsesRepository.deleteRecord(profileId, userMobileNumber, currentUserState.dataValues.currentLessonId, currentListenAndSpeakQuestion.dataValues.id);
                    let errorMessage = "Sorry! We did not understand that.\n\nPlease record a *new* voice message. Do not forward the previously recorded voice message.";
                    await sendMessage(userMobileNumber, errorMessage);
                    await createActivityLog(userMobileNumber, "text", "outbound", errorMessage, null);
                    return;
                }
                if (recognizedText) {
                    // Checking if user response is correct or not

                    let userAnswerIsCorrect = false;
                    const recognizedTextCleaned = recognizedText.replace(/[^a-z0-9 ]/gi, "").toLowerCase().trim();
                    for (const mcqOptionAnswer of answersArray) {
                        const answerCleaned = mcqOptionAnswer.replace(/[^a-z0-9 ]/gi, "").toLowerCase().trim();
                        if (recognizedTextCleaned == answerCleaned) {
                            userAnswerIsCorrect = true;
                            break;
                        }
                    }
                    if (!userAnswerIsCorrect) {
                        userAnswerIsCorrect = false;
                    }

                    // Update user response to the database with processing results
                    const submissionDate = new Date();
                    const retryCounter = currentUserState.dataValues.retryCounter;
                    // User first attempt
                    if (retryCounter == 0 || retryCounter == null) {
                        await waUserProgressRepository.updateRetryCounter(profileId, userMobileNumber, 1);
                        await waQuestionResponsesRepository.updateReplace(
                            profileId,
                            userMobileNumber,
                            currentUserState.dataValues.currentLessonId,
                            currentListenAndSpeakQuestion.dataValues.id,
                            activity,
                            startingLesson.dataValues.activityAlias,
                            [recognizedText],
                            [audioUrl],
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
                            audioUrl,
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

                            // Update acceptable messages list for the user
                            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
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
                    const nextListenAndSpeakQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber, currentUserState.dataValues.currentDifficultyLevel);
                    if (nextListenAndSpeakQuestion) {
                        // Update question number
                        await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextListenAndSpeakQuestion.dataValues.questionNumber);

                        const mediaType = nextListenAndSpeakQuestion.dataValues.mediaFile.endsWith('.mp4') ? 'video' : 'audio';

                        const totalQuestions = await speakActivityQuestionRepository.getTotalQuestionsByLessonId(currentUserState.dataValues.currentLessonId);
                        let instructions = "👉 *Question " + await convertNumberToEmoji(nextListenAndSpeakQuestion.dataValues.questionNumber) + " of " + totalQuestions + "*\n\n";
                        instructions += "Record a voice message.";
                        if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                            instructions += "\nOR\n" + "or Type *next* to skip this activity!";
                        }
                        if (currentUserState.dataValues.currentCourseId == 143) {
                            instructions += "\n\n" + nextListenAndSpeakQuestion.dataValues.question.replace(/\\n/g, '\n');
                        }
                        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                        await sendMediaMessage(userMobileNumber, nextListenAndSpeakQuestion.dataValues.mediaFile, mediaType, instructions, 0, "SpeakActivityQuestion", nextListenAndSpeakQuestion.dataValues.id, nextListenAndSpeakQuestion.dataValues.mediaFileMediaId, "mediaFileMediaId");
                        await createActivityLog(userMobileNumber, mediaType, "outbound", nextListenAndSpeakQuestion.dataValues.mediaFile, null, instructions);
                        if (mediaType == 'video') {
                            await sleep(5000);

                        } else {
                            await sleep(2000);
                        }
                        let secondMediaType = null;
                        if (nextListenAndSpeakQuestion?.dataValues?.mediaFileSecond) {
                            secondMediaType = nextListenAndSpeakQuestion?.dataValues?.mediaFileSecond?.endsWith('.mp4') ? 'video' : 'audio';
                        }
                        if (secondMediaType != null && secondMediaType != "null" && secondMediaType != "") {
                            await sendMediaMessage(userMobileNumber, nextListenAndSpeakQuestion.dataValues.mediaFileSecond, secondMediaType, null, 0, "SpeakActivityQuestion", nextListenAndSpeakQuestion.dataValues.id, nextListenAndSpeakQuestion.dataValues.mediaFileSecondMediaId, "mediaFileSecondMediaId");
                            await createActivityLog(userMobileNumber, secondMediaType, "outbound", nextListenAndSpeakQuestion.dataValues.mediaFileSecond, null);
                            if (secondMediaType == 'video') {
                                await sleep(5000);
                            } else {
                                await sleep(2000);
                            }
                        }

                        if (mediaType == 'audio') {
                            await sendMessage(userMobileNumber, instructions);
                            await createActivityLog(userMobileNumber, "text", "outbound", instructions, null);
                        }
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
                            message += "\n\nExcellent! 🎉";
                        }

                        // Reset Question Number, Retry Counter, and Activity Type
                        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

                        // ENDING MESSAGE
                        await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson, message);
                    }
                } else {
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
                    await waQuestionResponsesRepository.deleteRecord(profileId, userMobileNumber, currentUserState.dataValues.currentLessonId, currentListenAndSpeakQuestion.dataValues.id);
                    let errorMessage = "Sorry! We did not understand that.\n\nPlease record a *new* voice message. Do not forward the previously recorded voice message.";
                    await sendMessage(userMobileNumber, errorMessage);
                    await createActivityLog(userMobileNumber, "text", "outbound", errorMessage, null);
                }
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
        error.fileName = 'listenAndSpeakView.js';
        throw error;
    }
};

export { listenAndSpeakView };