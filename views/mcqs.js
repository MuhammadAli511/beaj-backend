import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import { sendMessage, sendButtonMessage, sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import { sleep, convertNumberToEmoji } from "../utils/utils.js";
import multipleChoiceQuestionRepository from "../repositories/multipleChoiceQuestionRepository.js";
import multipleChoiceQuestionAnswerRepository from "../repositories/multipleChoiceQuestionAnswerRepository.js";

const mcqsView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null, buttonId = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                let defaultTextInstruction = "👇 *Answer the following questions.*";
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

                // Send first MCQs question
                const firstMCQsQuestion = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstMCQsQuestion.dataValues.QuestionNumber);

                // Send question
                const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(firstMCQsQuestion.dataValues.Id);
                const questionText = firstMCQsQuestion.dataValues.QuestionText.replace(/\\n/g, '\n');
                let mcqMessage = questionText + "\n\n";
                if (!questionText.includes("Choose the correct sentence:") && !questionText.includes("What is the correct question") && !questionText.includes("Which is a correct question") && !questionText.includes("Which sentence is correct?")) {
                    mcqMessage += "Choose the correct answer:\n";
                }
                for (let i = 0; i < mcqAnswers.length; i++) {
                    mcqMessage += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                }

                const mcqImage = firstMCQsQuestion.dataValues.QuestionImageUrl;
                const mcqVideo = firstMCQsQuestion.dataValues.QuestionVideoUrl;
                const mcqType = firstMCQsQuestion.dataValues.QuestionType;

                if (mcqType == 'Text') {
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${firstMCQsQuestion.dataValues.Id}_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })));
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                }
                else if (mcqType == 'Text+Image') {
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${firstMCQsQuestion.dataValues.Id}_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })), 0, mcqImage, null, "MultipleChoiceQuestion", firstMCQsQuestion.dataValues.Id, firstMCQsQuestion.dataValues.QuestionImageMediaId, null, "QuestionImageMediaId");
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                }
                else if (mcqType == 'Text+Video') {
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${firstMCQsQuestion.dataValues.Id}_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })), 0, null, mcqVideo, "MultipleChoiceQuestion", firstMCQsQuestion.dataValues.Id, null, firstMCQsQuestion.dataValues.QuestionVideoMediaId, "QuestionVideoMediaId");
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                }
                else if (mcqType == 'Image') {
                    await sendButtonMessage(userMobileNumber, "", mcqAnswers.map((answer, index) => ({ id: `${firstMCQsQuestion.dataValues.Id}_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })), 0, mcqImage, null, "MultipleChoiceQuestion", firstMCQsQuestion.dataValues.Id, firstMCQsQuestion.dataValues.QuestionImageMediaId, null, "QuestionImageMediaId");
                    await createActivityLog(userMobileNumber, "template", "outbound", "", null);
                }

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["option a", "option b", "option c"]);
            }
            else {
                // Parse question ID from button response
                let questionIdFromButton = buttonId;
                let userOption = null;
                if (buttonId) {
                    userOption = buttonId.split('_')[1];
                    questionIdFromButton = buttonId.split('_')[0];
                }

                // Get current MCQ question
                const currentMCQsQuestion = await multipleChoiceQuestionRepository.getCurrentMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // **KEY CHECK** - If button was for a different question, ignore it
                if (questionIdFromButton && questionIdFromButton != currentMCQsQuestion.dataValues.Id) {
                    console.log(`Ignoring late click for question ${questionIdFromButton}, user is now on question ${currentMCQsQuestion.dataValues.Id}`);
                    return;
                }
                // If button was for the same and record already exists, ignore it
                const existingRecord = await waQuestionResponsesRepository.getByQuestionIdAndAnswer(currentMCQsQuestion.dataValues.Id, profileId);
                if (existingRecord) {
                    console.log(`Ignoring duplicate click for question ${currentMCQsQuestion.dataValues.Id}, user already answered`);
                    return;
                }

                // Upper and Lower case answers
                const originalAnswer = messageContent;
                const userAnswer = messageContent.toLowerCase();

                // Get all answers against the question
                const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(currentMCQsQuestion.dataValues.Id);

                // Check if the user answer is correct
                let isCorrectAnswer = false;
                let selectedAnswerIndex = -1;
                for (let i = 0; i < mcqAnswers.length; i++) {
                    let matchWith = `option ${String.fromCharCode(65 + i)}`.toLowerCase();
                    if (userAnswer == matchWith) {
                        selectedAnswerIndex = i;
                        if (mcqAnswers[i].dataValues.IsCorrect === true) {
                            isCorrectAnswer = true;
                        }
                        break;
                    }
                }

                // Save user response to the database
                const submissionDate = new Date();
                const response = await waQuestionResponsesRepository.create(
                    profileId,
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentMCQsQuestion.dataValues.Id,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    [originalAnswer],
                    null,
                    null,
                    null,
                    null,
                    [isCorrectAnswer],
                    1,
                    submissionDate
                );
                if (!response) {
                    return;
                }

                // Check if custom feedback exists for the selected answer
                if (selectedAnswerIndex !== -1) {
                    const selectedAnswer = mcqAnswers[selectedAnswerIndex];
                    let customFeedbackText = selectedAnswer.dataValues.CustomAnswerFeedbackText;
                    const customFeedbackImage = selectedAnswer.dataValues.CustomAnswerFeedbackImage;
                    const customFeedbackAudio = selectedAnswer.dataValues.CustomAnswerFeedbackAudio;

                    // If not null based on the user selection send all the custom feedback which is not null
                    if (customFeedbackText) {
                        customFeedbackText = customFeedbackText.replace(/\\n/g, '\n');
                        await sendMessage(userMobileNumber, customFeedbackText);
                        await createActivityLog(userMobileNumber, "text", "outbound", customFeedbackText, null);
                    }
                    if (customFeedbackImage) {
                        await sendMediaMessage(userMobileNumber, customFeedbackImage, 'image', null, 0, "MultipleChoiceQuestionAnswer", selectedAnswer.dataValues.Id, selectedAnswer.dataValues.CustomAnswerFeedbackImageMediaId, "CustomAnswerFeedbackImageMediaId");
                        await createActivityLog(userMobileNumber, "image", "outbound", customFeedbackImage, null);
                        await sleep(2000);
                    }
                    if (customFeedbackAudio) {
                        await sendMediaMessage(userMobileNumber, customFeedbackAudio, 'audio', null, 0, "MultipleChoiceQuestionAnswer", selectedAnswer.dataValues.Id, selectedAnswer.dataValues.CustomAnswerFeedbackAudioMediaId, "CustomAnswerFeedbackAudioMediaId");
                        await createActivityLog(userMobileNumber, "audio", "outbound", customFeedbackAudio, null);
                        await sleep(5000);
                    }

                    if (!customFeedbackText && !customFeedbackImage && !customFeedbackAudio) {
                        // Correct Answer Feedback
                        if (isCorrectAnswer) {
                            // Text message
                            await sendMessage(userMobileNumber, "✅ Great!");
                            await createActivityLog(userMobileNumber, "text", "outbound", "✅ Great!", null);
                        }
                        // Incorrect Answer Feedback
                        else {
                            let correctAnswer = "❌ The correct answer is ";
                            for (let i = 0; i < mcqAnswers.length; i++) {
                                if (mcqAnswers[i].dataValues.IsCorrect === true) {
                                    correctAnswer += "Option " + String.fromCharCode(65 + i) + ": " + mcqAnswers[i].dataValues.AnswerText;
                                }
                            }
                            // Text message
                            await sendMessage(userMobileNumber, correctAnswer);
                            await createActivityLog(userMobileNumber, "text", "outbound", correctAnswer, null);
                        }
                    }
                } else {
                    // Fallback for invalid selection
                    await sendMessage(userMobileNumber, "Invalid option selected. Please try again.");
                    await createActivityLog(userMobileNumber, "text", "outbound", "Invalid option selected. Please try again.", null);
                    return;
                }

                // Get next MCQ question
                const nextMCQsQuestion = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                if (nextMCQsQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextMCQsQuestion.dataValues.QuestionNumber);

                    // Send question
                    const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(nextMCQsQuestion.dataValues.Id);
                    const questionText = nextMCQsQuestion.dataValues.QuestionText.replace(/\\n/g, '\n');
                    let mcqMessage = questionText + "\n\n";
                    if (!questionText.includes("Choose the correct sentence:") && !questionText.includes("What is the correct question") && !questionText.includes("Which is a correct question") && !questionText.includes("Which sentence is correct?")) {
                        mcqMessage += "Choose the correct answer:\n";
                    }
                    for (let i = 0; i < mcqAnswers.length; i++) {
                        mcqMessage += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                    }

                    // Reply buttons to answer
                    const mcqImage = nextMCQsQuestion.dataValues.QuestionImageUrl;
                    const mcqVideo = nextMCQsQuestion.dataValues.QuestionVideoUrl;
                    const mcqType = nextMCQsQuestion.dataValues.QuestionType;

                    if (mcqType == 'Text') {
                        await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${nextMCQsQuestion.dataValues.Id}_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })));
                        await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                    }
                    else if (mcqType == 'Text+Image') {
                        await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${nextMCQsQuestion.dataValues.Id}_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })), 0, mcqImage, null, "MultipleChoiceQuestion", nextMCQsQuestion.dataValues.Id, nextMCQsQuestion.dataValues.QuestionImageMediaId, null, "QuestionImageMediaId");
                        await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                    }
                    else if (mcqType == 'Text+Video') {
                        await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${nextMCQsQuestion.dataValues.Id}_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })), 0, null, mcqVideo, "MultipleChoiceQuestion", nextMCQsQuestion.dataValues.Id, null, nextMCQsQuestion.dataValues.QuestionVideoMediaId, "QuestionVideoMediaId");
                        await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                    }
                    else if (mcqType == 'Image') {
                        await sendButtonMessage(userMobileNumber, "", mcqAnswers.map((answer, index) => ({ id: `${nextMCQsQuestion.dataValues.Id}_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })), 0, mcqImage, null, "MultipleChoiceQuestion", nextMCQsQuestion.dataValues.Id, nextMCQsQuestion.dataValues.QuestionImageMediaId, null, "QuestionImageMediaId");
                        await createActivityLog(userMobileNumber, "template", "outbound", "", null);
                    }

                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["option a", "option b", "option c"]);
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
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

                    // ENDING MESSAGE
                    await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
                }
            }
        }
        else if (persona == 'kid') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                let defaultTextInstruction = "👇 *Answer the following questions.*";
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
                let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias.replace(/\\n/g, '\n');
                lessonMessage += "\n\n" + finalTextInstruction;

                // Text message
                await sendMessage(userMobileNumber, lessonMessage);
                await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                // Send first MCQs question
                const firstMCQsQuestion = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstMCQsQuestion.dataValues.QuestionNumber);
                const totalQuestions = await multipleChoiceQuestionRepository.getTotalQuestions(currentUserState.dataValues.currentLessonId);

                // Send question
                const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(firstMCQsQuestion.dataValues.Id);
                const questionText = firstMCQsQuestion.dataValues.QuestionText.replace(/\\n/g, '\n');

                const mcqType = firstMCQsQuestion.dataValues.QuestionType;

                let mcqMessage = "";
                if (mcqType == 'Text') {
                    mcqMessage = "👉 *Question " + await convertNumberToEmoji(firstMCQsQuestion.dataValues.QuestionNumber) + " of " + totalQuestions + "*\n\n" + questionText + "\n\n";
                } else {
                    mcqMessage = "👉 *Question " + await convertNumberToEmoji(firstMCQsQuestion.dataValues.QuestionNumber) + " of " + totalQuestions + "*\n\n";
                }
                if (!questionText.includes("Choose the correct sentence:") && !questionText.includes("What is the correct question") && !questionText.includes("Which is a correct question") && !questionText.includes("Which sentence is correct?")) {
                    mcqMessage += "Choose the correct answer:\n";
                    if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                        mcqMessage += "\nor Type *next* to skip this activity!";
                    }
                }
                if (mcqType == 'Text') {
                    for (let i = 0; i < mcqAnswers.length; i++) {
                        mcqMessage += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                    }
                }

                const mcqImage = firstMCQsQuestion.dataValues.QuestionImageUrl;
                const mcqVideo = firstMCQsQuestion.dataValues.QuestionVideoUrl;

                if (mcqType == 'Text') {
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${firstMCQsQuestion.dataValues.Id}_${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })));
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                }
                else if (mcqType == 'Text+Image') {
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${firstMCQsQuestion.dataValues.Id}_${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })), 0, mcqImage, null, "MultipleChoiceQuestion", firstMCQsQuestion.dataValues.Id, firstMCQsQuestion.dataValues.QuestionImageMediaId, null, "QuestionImageMediaId");
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                }
                else if (mcqType == 'Text+Video') {
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${firstMCQsQuestion.dataValues.Id}_${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })), 0, null, mcqVideo, "MultipleChoiceQuestion", firstMCQsQuestion.dataValues.Id, null, firstMCQsQuestion.dataValues.QuestionVideoMediaId, "QuestionVideoMediaId");
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                }
                else if (mcqType == 'Image') {
                    await sendButtonMessage(userMobileNumber, "", mcqAnswers.map((answer, index) => ({ id: `${firstMCQsQuestion.dataValues.Id}_${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })), 0, mcqImage, null, "MultipleChoiceQuestion", firstMCQsQuestion.dataValues.Id, firstMCQsQuestion.dataValues.QuestionImageMediaId, null, "QuestionImageMediaId");
                    await createActivityLog(userMobileNumber, "template", "outbound", "", null);
                }

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["a", "b", "c"]);
            }
            else {
                // Parse question ID from button response
                let questionIdFromButton = buttonId;
                let userOption = null;
                if (buttonId) {
                    userOption = buttonId.split('_')[1];
                    questionIdFromButton = buttonId.split('_')[0];
                }

                // Get current MCQ question
                const currentMCQsQuestion = await multipleChoiceQuestionRepository.getCurrentMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // **KEY CHECK** - If button was for a different question, ignore it
                if (questionIdFromButton && questionIdFromButton != currentMCQsQuestion.dataValues.Id) {
                    console.log(`Ignoring late click for question ${questionIdFromButton}, user is now on question ${currentMCQsQuestion.dataValues.Id}`);
                    return;
                }
                // If button was for the same and record already exists, ignore it
                const existingRecord = await waQuestionResponsesRepository.getByQuestionIdAndAnswer(currentMCQsQuestion.dataValues.Id, profileId);
                if (existingRecord) {
                    console.log(`Ignoring duplicate click for question ${currentMCQsQuestion.dataValues.Id}, user already answered`);
                    return;
                }

                // Upper and Lower case answers
                const originalAnswer = messageContent;
                const userAnswer = messageContent.toLowerCase();

                // Get all answers against the question
                const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(currentMCQsQuestion.dataValues.Id);

                // Check if the user answer is correct
                let isCorrectAnswer = false;
                let selectedAnswerIndex = -1;
                for (let i = 0; i < mcqAnswers.length; i++) {
                    let matchWith = `${String.fromCharCode(65 + i)}`.toLowerCase();
                    if (userAnswer == matchWith) {
                        selectedAnswerIndex = i;
                        if (mcqAnswers[i].dataValues.IsCorrect === true) {
                            isCorrectAnswer = true;
                        }
                        break;
                    }
                }

                // Save user response to the database
                const submissionDate = new Date();
                const response = await waQuestionResponsesRepository.create(
                    profileId,
                    userMobileNumber,
                    currentUserState.dataValues.currentLessonId,
                    currentMCQsQuestion.dataValues.Id,
                    activity,
                    startingLesson.dataValues.activityAlias,
                    [originalAnswer],
                    null,
                    null,
                    null,
                    null,
                    [isCorrectAnswer],
                    1,
                    submissionDate
                );
                if (!response) {
                    return;
                }

                // Check if custom feedback exists for the selected answer
                if (selectedAnswerIndex !== -1) {
                    const selectedAnswer = mcqAnswers[selectedAnswerIndex];
                    let customFeedbackText = selectedAnswer.dataValues.CustomAnswerFeedbackText;
                    const customFeedbackImage = selectedAnswer.dataValues.CustomAnswerFeedbackImage;
                    const customFeedbackAudio = selectedAnswer.dataValues.CustomAnswerFeedbackAudio;
                    const totalQuestions = await multipleChoiceQuestionRepository.getTotalQuestions(currentUserState.dataValues.currentLessonId);
                    const currentQuestionNumber = currentUserState.dataValues.questionNumber;
                    const remainingQuestions = totalQuestions - currentQuestionNumber;

                    // If both image and text are available, send image with caption
                    if (customFeedbackImage && customFeedbackText) {
                        customFeedbackText = customFeedbackText.replace(/\\n/g, '\n');
                        if (remainingQuestions > 1) {
                            // if not trial
                            if (currentUserState.dataValues.engagement_type != "Free Trial - Kids - Level 1" && currentUserState.dataValues.engagement_type != "Free Trial - Kids - Level 3") {
                                customFeedbackText += "\n\n" + remainingQuestions + " more questions to go!";
                            }
                        }
                        await sendMediaMessage(userMobileNumber, customFeedbackImage, 'image', customFeedbackText, 0, "MultipleChoiceQuestionAnswer", selectedAnswer.dataValues.Id, selectedAnswer.dataValues.CustomAnswerFeedbackImageMediaId, "CustomAnswerFeedbackImageMediaId");
                        await createActivityLog(userMobileNumber, "image", "outbound", customFeedbackImage, customFeedbackText);
                        await sleep(2000);
                    } else {
                        // Otherwise send them separately if they exist
                        if (customFeedbackText) {
                            customFeedbackText = customFeedbackText.replace(/\\n/g, '\n');
                            if (remainingQuestions > 1) {
                                if (currentUserState.dataValues.engagement_type != "Free Trial - Kids - Level 1" && currentUserState.dataValues.engagement_type != "Free Trial - Kids - Level 3") {
                                    customFeedbackText += "\n\n" + remainingQuestions + " more questions to go!";
                                }
                            }
                            await sendMessage(userMobileNumber, customFeedbackText);
                            await createActivityLog(userMobileNumber, "text", "outbound", customFeedbackText, null);
                        }
                        if (customFeedbackImage) {
                            await sendMediaMessage(userMobileNumber, customFeedbackImage, 'image', null, 0, "MultipleChoiceQuestionAnswer", selectedAnswer.dataValues.Id, selectedAnswer.dataValues.CustomAnswerFeedbackImageMediaId, "CustomAnswerFeedbackImageMediaId");
                            await createActivityLog(userMobileNumber, "image", "outbound", customFeedbackImage, null);
                            await sleep(2000);
                        }
                    }

                    // Send audio if it exists
                    if (customFeedbackAudio) {
                        await sendMediaMessage(userMobileNumber, customFeedbackAudio, 'audio', null, 0, "MultipleChoiceQuestionAnswer", selectedAnswer.dataValues.Id, selectedAnswer.dataValues.CustomAnswerFeedbackAudioMediaId, "CustomAnswerFeedbackAudioMediaId");
                        await createActivityLog(userMobileNumber, "audio", "outbound", customFeedbackAudio, null);
                        await sleep(5000);
                    }

                    if (!customFeedbackText && !customFeedbackImage && !customFeedbackAudio) {
                        if (isCorrectAnswer) {
                            let correctAnswerMessage = "✅ That's right!\n\n";
                            if (remainingQuestions > 1) {
                                correctAnswerMessage += remainingQuestions + " more questions to go!";
                            }
                            await sendMessage(userMobileNumber, correctAnswerMessage);
                            await createActivityLog(userMobileNumber, "text", "outbound", correctAnswerMessage, null);
                        }
                        // Incorrect Answer Feedback
                        else {
                            let correctAnswer = "❌ The correct answer is ";
                            for (let i = 0; i < mcqAnswers.length; i++) {
                                if (mcqAnswers[i].dataValues.IsCorrect === true) {
                                    correctAnswer += String.fromCharCode(65 + i) + ": " + mcqAnswers[i].dataValues.AnswerText;
                                }
                            }
                            if (remainingQuestions > 1) {
                                correctAnswer += "\n\n" + remainingQuestions + " more questions to go!";
                            }
                            await sendMessage(userMobileNumber, correctAnswer);
                            await createActivityLog(userMobileNumber, "text", "outbound", correctAnswer, null);
                        }
                    }
                } else {
                    // Fallback for invalid selection
                    await sendMessage(userMobileNumber, "Invalid option selected. Please try again.");
                    await createActivityLog(userMobileNumber, "text", "outbound", "Invalid option selected. Please try again.", null);
                    return;
                }

                // Get next MCQ question
                const nextMCQsQuestion = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
                if (nextMCQsQuestion) {
                    // Update question number
                    await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextMCQsQuestion.dataValues.QuestionNumber);
                    const totalQuestions = await multipleChoiceQuestionRepository.getTotalQuestions(currentUserState.dataValues.currentLessonId);

                    const mcqType = nextMCQsQuestion.dataValues.QuestionType;

                    // Send question
                    const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(nextMCQsQuestion.dataValues.Id);
                    const questionText = nextMCQsQuestion.dataValues.QuestionText.replace(/\\n/g, '\n');
                    let mcqMessage = "";
                    if (mcqType == 'Text') {
                        mcqMessage = "👉 *Question " + await convertNumberToEmoji(nextMCQsQuestion.dataValues.QuestionNumber) + " of " + totalQuestions + "*\n\n" + questionText + "\n\n";
                    } else {
                        mcqMessage = "👉 *Question " + await convertNumberToEmoji(nextMCQsQuestion.dataValues.QuestionNumber) + " of " + totalQuestions + "*\n\n";
                    }
                    if (!questionText.includes("Choose the correct sentence:") && !questionText.includes("What is the correct question") && !questionText.includes("Which is a correct question") && !questionText.includes("Which sentence is correct?")) {
                        mcqMessage += "Choose the correct answer:\n";
                        if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                            mcqMessage += "\nor Type *next* to skip this activity!";
                        }
                    }
                    if (mcqType == 'Text') {
                        for (let i = 0; i < mcqAnswers.length; i++) {
                            mcqMessage += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                        }
                    }

                    // Reply buttons to answer
                    const mcqImage = nextMCQsQuestion.dataValues.QuestionImageUrl;
                    const mcqVideo = nextMCQsQuestion.dataValues.QuestionVideoUrl;

                    if (mcqType == 'Text') {
                        await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${nextMCQsQuestion.dataValues.Id}_${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })));
                        await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                    }
                    else if (mcqType == 'Text+Image') {
                        await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${nextMCQsQuestion.dataValues.Id}_${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })), 0, mcqImage, null, "MultipleChoiceQuestion", nextMCQsQuestion.dataValues.Id, nextMCQsQuestion.dataValues.QuestionImageMediaId, null, "QuestionImageMediaId");
                        await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                    }
                    else if (mcqType == 'Text+Video') {
                        await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${nextMCQsQuestion.dataValues.Id}_${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })), 0, null, mcqVideo, "MultipleChoiceQuestion", nextMCQsQuestion.dataValues.Id, null, nextMCQsQuestion.dataValues.QuestionVideoMediaId, "QuestionVideoMediaId");
                        await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                    }
                    else if (mcqType == 'Image') {
                        await sendButtonMessage(userMobileNumber, "", mcqAnswers.map((answer, index) => ({ id: `${nextMCQsQuestion.dataValues.Id}_${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })), 0, mcqImage, null, "MultipleChoiceQuestion", nextMCQsQuestion.dataValues.Id, nextMCQsQuestion.dataValues.QuestionImageMediaId, null, "QuestionImageMediaId");
                        await createActivityLog(userMobileNumber, "template", "outbound", "", null);
                    }

                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["a", "b", "c"]);
                } else {
                    // Calculate total score and send message
                    const totalScore = await waQuestionResponsesRepository.getTotalScore(profileId, userMobileNumber, currentUserState.dataValues.currentLessonId);
                    const totalQuestions = await waQuestionResponsesRepository.getTotalQuestions(profileId, userMobileNumber, currentUserState.dataValues.currentLessonId);
                    const scorePercentage = (totalScore / totalQuestions) * 100;
                    let message = "*Your score: " + totalScore + "/" + totalQuestions + ".*";
                    if (scorePercentage >= 0 && scorePercentage <= 60) {
                        message += "\n\nGood Effort! 👍🏽";
                    } else if (scorePercentage >= 61 && scorePercentage <= 79) {
                        message += "\n\nWell done! 🌟";
                    } else if (scorePercentage >= 80) {
                        message += "\n\nExcellent 🎉";
                    }

                    // if not free trial, send message
                    if (currentUserState.dataValues.engagement_type != "Free Trial - Kids - Level 1" && currentUserState.dataValues.engagement_type != "Free Trial - Kids - Level 3") {
                        await sendMessage(userMobileNumber, message);
                        await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                    }

                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

                    // ENDING MESSAGE
                    await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson, message);
                }
            }
        }
        return;
    } catch (error) {
        console.log('Error sending lesson to user:', error);
        error.fileName = 'mcqsView.js';
        throw error;
    }
};

export { mcqsView };