import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import { sendMessage, sendButtonMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { sendMediaMessage } from "../utils/whatsappUtils.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import { sleep, convertNumberToEmoji, removeHTMLTags } from "../utils/utils.js";
import multipleChoiceQuestionRepository from "../repositories/multipleChoiceQuestionRepository.js";
import multipleChoiceQuestionAnswerRepository from "../repositories/multipleChoiceQuestionAnswerRepository.js";

const mcqsView = async (userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Activity Alias
                const activityAlias = startingLesson.dataValues.activityAlias;
                let lessonText = startingLesson.dataValues.text;
                lessonText = removeHTMLTags(lessonText);
                if (activityAlias == "*End of Week Challenge!* 💪🏽") {
                    // Send lesson message
                    let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                    lessonMessage += "\n\n" + "Answer the following questions.";
                    // Text message
                    await sendMessage(userMobileNumber, lessonMessage);
                    await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                    await sendMessage(userMobileNumber, "Let's Start Questions👇🏽");
                    await createActivityLog(userMobileNumber, "text", "outbound", "Let's Start Questions👇🏽", null);
                } else if (activityAlias == "*Reading Comprehension* 📖") {
                    let lessonMessage = "Activity: " + startingLesson.dataValues.activityAlias;
                    lessonMessage += "\n\n" + "Answer the following questions about the reading passage.";
                    // Text message
                    await sendMessage(userMobileNumber, lessonMessage);
                    await createActivityLog(userMobileNumber, "text", "outbound", lessonMessage, null);

                    await sendMessage(userMobileNumber, "Let's Start Questions👇🏽");
                    await createActivityLog(userMobileNumber, "text", "outbound", "Let's Start Questions👇🏽", null);
                }

                // Lesson Text
                if (lessonText.includes("After listening to the dialogue")) {
                    await sendMessage(userMobileNumber, lessonText);
                    await createActivityLog(userMobileNumber, "text", "outbound", lessonText, null);
                }

                // Send first MCQs question
                const firstMCQsQuestion = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstMCQsQuestion.dataValues.QuestionNumber);

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
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `option_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })));
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                }
                else if (mcqType == 'Text+Image') {
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `option_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })), 0, mcqImage);
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                }
                else if (mcqType == 'Text+Video') {
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `option_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })), 0, null, mcqVideo);
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                }
                else if (mcqType == 'Image') {
                    await sendButtonMessage(userMobileNumber, "", mcqAnswers.map((answer, index) => ({ id: `option_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })), 0, mcqImage);
                    await createActivityLog(userMobileNumber, "template", "outbound", "", null);
                }

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["option a", "option b", "option c"]);
            }
            else {
                // Get current MCQ question
                const currentMCQsQuestion = await multipleChoiceQuestionRepository.getCurrentMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

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
                await waQuestionResponsesRepository.create(
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
                        await sendMediaMessage(userMobileNumber, customFeedbackImage, 'image');
                        await createActivityLog(userMobileNumber, "image", "outbound", customFeedbackImage, null);
                        await sleep(2000);
                    }
                    if (customFeedbackAudio) {
                        await sendMediaMessage(userMobileNumber, customFeedbackAudio, 'audio');
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
                    await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextMCQsQuestion.dataValues.QuestionNumber);

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
                        await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `option_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })));
                        await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                    }
                    else if (mcqType == 'Text+Image') {
                        await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `option_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })), 0, mcqImage);
                        await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                    }
                    else if (mcqType == 'Text+Video') {
                        await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `option_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })), 0, null, mcqVideo);
                        await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                    }
                    else if (mcqType == 'Image') {
                        await sendButtonMessage(userMobileNumber, "", mcqAnswers.map((answer, index) => ({ id: `option_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })), 0, mcqImage);
                        await createActivityLog(userMobileNumber, "template", "outbound", "", null);
                    }

                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["option a", "option b", "option c"]);
                } else {
                    // Calculate total score and send message
                    const totalScore = await waQuestionResponsesRepository.getTotalScore(userMobileNumber, currentUserState.dataValues.currentLessonId);
                    const totalQuestions = await waQuestionResponsesRepository.getTotalQuestions(userMobileNumber, currentUserState.dataValues.currentLessonId);
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
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                    // ENDING MESSAGE
                    await endingMessage(userMobileNumber, currentUserState, startingLesson);
                }
            }
        }
        else if (persona == 'kid') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date());

                // Activity Alias
                const activityAlias = startingLesson.dataValues.activityAlias;
                let message = activityAlias + "\n\n" + startingLesson.dataValues.text;

                await sendMessage(userMobileNumber, message);
                await createActivityLog(userMobileNumber, "text", "outbound", message, null);

                // Send first MCQs question
                const firstMCQsQuestion = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, null);

                // Update question number
                await waUserProgressRepository.updateQuestionNumber(userMobileNumber, firstMCQsQuestion.dataValues.QuestionNumber);
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
                }
                if (mcqType == 'Text') {
                    for (let i = 0; i < mcqAnswers.length; i++) {
                        mcqMessage += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                    }
                }

                const mcqImage = firstMCQsQuestion.dataValues.QuestionImageUrl;
                const mcqVideo = firstMCQsQuestion.dataValues.QuestionVideoUrl;

                if (mcqType == 'Text') {
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })));
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                }
                else if (mcqType == 'Text+Image') {
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })), 0, mcqImage);
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                }
                else if (mcqType == 'Text+Video') {
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })), 0, null, mcqVideo);
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                }
                else if (mcqType == 'Image') {
                    await sendButtonMessage(userMobileNumber, "", mcqAnswers.map((answer, index) => ({ id: `${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })), 0, mcqImage);
                    await createActivityLog(userMobileNumber, "template", "outbound", "", null);
                }

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["a", "b", "c"]);
            }
            else {
                // Get current MCQ question
                const currentMCQsQuestion = await multipleChoiceQuestionRepository.getCurrentMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

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
                await waQuestionResponsesRepository.create(
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

                // Check if custom feedback exists for the selected answer
                if (selectedAnswerIndex !== -1) {
                    const selectedAnswer = mcqAnswers[selectedAnswerIndex];
                    let customFeedbackText = selectedAnswer.dataValues.CustomAnswerFeedbackText;
                    const customFeedbackImage = selectedAnswer.dataValues.CustomAnswerFeedbackImage;
                    const customFeedbackAudio = selectedAnswer.dataValues.CustomAnswerFeedbackAudio;

                    // If both image and text are available, send image with caption
                    if (customFeedbackImage && customFeedbackText) {
                        customFeedbackText = customFeedbackText.replace(/\\n/g, '\n');
                        await sendMediaMessage(userMobileNumber, customFeedbackImage, 'image', customFeedbackText);
                        await createActivityLog(userMobileNumber, "image", "outbound", customFeedbackImage, customFeedbackText);
                        await sleep(2000);
                    } else {
                        // Otherwise send them separately if they exist
                        if (customFeedbackText) {
                            customFeedbackText = customFeedbackText.replace(/\\n/g, '\n');
                            await sendMessage(userMobileNumber, customFeedbackText);
                            await createActivityLog(userMobileNumber, "text", "outbound", customFeedbackText, null);
                        }
                        if (customFeedbackImage) {
                            await sendMediaMessage(userMobileNumber, customFeedbackImage, 'image');
                            await createActivityLog(userMobileNumber, "image", "outbound", customFeedbackImage, null);
                            await sleep(2000);
                        }
                    }

                    // Send audio if it exists
                    if (customFeedbackAudio) {
                        await sendMediaMessage(userMobileNumber, customFeedbackAudio, 'audio');
                        await createActivityLog(userMobileNumber, "audio", "outbound", customFeedbackAudio, null);
                        await sleep(5000);
                    }

                    if (!customFeedbackText && !customFeedbackImage && !customFeedbackAudio) {
                        // Correct Answer Feedback
                        if (isCorrectAnswer) {
                            // Text message
                            await sendMessage(userMobileNumber, "✅ That's right!");
                            await createActivityLog(userMobileNumber, "text", "outbound", "✅ That's right!", null);
                        }
                        // Incorrect Answer Feedback
                        else {
                            let correctAnswer = "❌ The correct answer is ";
                            for (let i = 0; i < mcqAnswers.length; i++) {
                                if (mcqAnswers[i].dataValues.IsCorrect === true) {
                                    correctAnswer += String.fromCharCode(65 + i) + ": " + mcqAnswers[i].dataValues.AnswerText;
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
                    await waUserProgressRepository.updateQuestionNumber(userMobileNumber, nextMCQsQuestion.dataValues.QuestionNumber);
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
                        await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })));
                        await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                    }
                    else if (mcqType == 'Text+Image') {
                        await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })), 0, mcqImage);
                        await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                    }
                    else if (mcqType == 'Text+Video') {
                        await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })), 0, null, mcqVideo);
                        await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);
                    }
                    else if (mcqType == 'Image') {
                        await sendButtonMessage(userMobileNumber, "", mcqAnswers.map((answer, index) => ({ id: `${String.fromCharCode(65 + index)}`, title: String.fromCharCode(65 + index) })), 0, mcqImage);
                        await createActivityLog(userMobileNumber, "template", "outbound", "", null);
                    }

                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["a", "b", "c"]);
                } else {
                    // const thumbs_up_sticker = "https://beajbloblive.blob.core.windows.net/beajdocuments/thumbs_up.webp"
                    // await sendMediaMessage(userMobileNumber, thumbs_up_sticker, 'sticker');
                    // await createActivityLog(userMobileNumber, "sticker", "outbound", thumbs_up_sticker, null);
                    // await sleep(2000);

                    // Calculate total score and send message
                    const totalScore = await waQuestionResponsesRepository.getTotalScore(userMobileNumber, currentUserState.dataValues.currentLessonId);
                    const totalQuestions = await waQuestionResponsesRepository.getTotalQuestions(userMobileNumber, currentUserState.dataValues.currentLessonId);
                    const scorePercentage = (totalScore / totalQuestions) * 100;
                    let message = "*Your score: " + totalScore + "/" + totalQuestions + ".*";
                    if (scorePercentage >= 0 && scorePercentage <= 60) {
                        message += "\n\nGood Effort! 👍🏽";
                        // Text message
                        // await sendMessage(userMobileNumber, message);
                        // await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                    } else if (scorePercentage >= 61 && scorePercentage <= 79) {
                        message += "\n\nWell done! 🌟";
                        // Text message
                        // await sendMessage(userMobileNumber, message);
                        // await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                    } else if (scorePercentage >= 80) {
                        message += "\n\nExcellent 🎉";
                        // Text message
                        // await sendMessage(userMobileNumber, message);
                        // await createActivityLog(userMobileNumber, "text", "outbound", message, null);
                    }


                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(userMobileNumber, null, 0, null);

                    // ENDING MESSAGE
                    await endingMessage(userMobileNumber, currentUserState, startingLesson, message);
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