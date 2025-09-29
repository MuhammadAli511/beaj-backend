import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import { sendMessage, sendButtonMessage, sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import { convertNumberToEmoji } from "../utils/utils.js";
import { sendAliasAndStartingInstruction } from "../utils/aliasAndInstructionsUtils.js";
import multipleChoiceQuestionRepository from "../repositories/multipleChoiceQuestionRepository.js";
import multipleChoiceQuestionAnswerRepository from "../repositories/multipleChoiceQuestionAnswerRepository.js";


const sendQuestion = async (nextMCQsQuestion, totalQuestions, currentUserState, userMobileNumber, profileId, startingLesson) => {
    // Send question
    const mcqType = nextMCQsQuestion.dataValues.QuestionType;
    const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(nextMCQsQuestion.dataValues.Id);
    const questionText = nextMCQsQuestion.dataValues.QuestionText.replace(/\\n/g, '\n');
    let mcqMessage = "";
    if (mcqType == 'Text') {
        mcqMessage = "👉 *Question " + await convertNumberToEmoji(nextMCQsQuestion.dataValues.QuestionNumber) + " of " + totalQuestions + "*\n\n" + questionText + "\n\n";
    } else {
        mcqMessage = "👉 *Question " + await convertNumberToEmoji(nextMCQsQuestion.dataValues.QuestionNumber) + " of " + totalQuestions + "*\n\n";
    }
    if (
        startingLesson.dataValues.activityAlias == "🧠 *Self Growth Activities Complete!*" ||
        startingLesson.dataValues.activityAlias == "🧠 *Let's Think - Final Task!*"
    ) {
        mcqMessage += "Choose one option:\n";
    } else if (
        !questionText.includes("Choose the correct sentence:") &&
        !questionText.includes("What is the correct question") &&
        !questionText.includes("Which is a correct question") &&
        !questionText.includes("Which sentence is correct?") &&
        !questionText.includes("Choose one option")
    ) {
        mcqMessage += "Choose the correct answer:\n";
    }
    if (startingLesson.dataValues.skipOnFirstQuestion == true && nextMCQsQuestion.dataValues.QuestionNumber == 1) {
        mcqMessage += "\n\nOR\n\nClick *'Skip'* to start next activity";
    } else if (startingLesson.dataValues.skipOnEveryQuestion == true) {
        mcqMessage += "\n\nOR\n\nClick *'Skip'* to start next activity";
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
    if (startingLesson.dataValues.skipOnFirstQuestion == true && nextMCQsQuestion.dataValues.QuestionNumber == 1) {
        await sendButtonMessage(userMobileNumber, "👇 Click here to skip:", [{ id: "skip", title: "Skip" }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "👇 Click here to skip:", null);
    }
    else if (startingLesson.dataValues.skipOnEveryQuestion == true) {
        await sendButtonMessage(userMobileNumber, "👇 Click here to skip:", [{ id: "skip", title: "Skip" }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "👇 Click here to skip:", null);
    }

    // Update acceptable messages list for the user
    let acceptableMessages = Array.from({ length: mcqAnswers.length }, (_, i) => String.fromCharCode(97 + i));
    if (startingLesson.dataValues.skipOnFirstQuestion == true && nextMCQsQuestion.dataValues.QuestionNumber == 1) {
        acceptableMessages.push("skip");
    }
    else if (startingLesson.dataValues.skipOnEveryQuestion == true) {
        acceptableMessages.push("skip");
    }
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, acceptableMessages);
};

const getNextMcqQuestion = async (currentUserState, profileId, userMobileNumber, startingLesson) => {
    const nextMCQsQuestion = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);
    if (nextMCQsQuestion) {
        const totalQuestions = await multipleChoiceQuestionRepository.getTotalQuestions(currentUserState.dataValues.currentLessonId);
        await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, nextMCQsQuestion.dataValues.QuestionNumber);
        await sendQuestion(nextMCQsQuestion, totalQuestions, currentUserState, userMobileNumber, profileId, startingLesson);
    } else {
        // Reset Question Number, Retry Counter, and Activity Type
        await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

        // ENDING MESSAGE
        await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
    }
}

const assessmentMcqsView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null, buttonId = null) => {
    try {
        const activity = startingLesson.dataValues.activity;
        if (persona == 'teacher') {
            if (currentUserState.dataValues.questionNumber === null) {
                // Lesson Started Record
                await waLessonsCompletedRepository.create(userMobileNumber, currentUserState.dataValues.currentLessonId, currentUserState.currentCourseId, 'Started', new Date(), profileId);

                // Send alias and starting instruction
                await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

                // Send first MCQs question
                const firstMCQsQuestion = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, null);
                const totalQuestions = await multipleChoiceQuestionRepository.getTotalQuestions(currentUserState.dataValues.currentLessonId);
                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstMCQsQuestion.dataValues.QuestionNumber);

                // Send question
                await sendQuestion(firstMCQsQuestion, totalQuestions, currentUserState, userMobileNumber, profileId, startingLesson);
            }
            else {
                // Parse question ID from button response
                let questionIdFromButton = buttonId;
                if (buttonId) {
                    questionIdFromButton = buttonId.split('_')[0];
                }
                // Get current MCQ question
                const currentMCQsQuestion = await multipleChoiceQuestionRepository.getCurrentMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // **KEY CHECK** - If button was for a different question, ignore it
                if (questionIdFromButton && questionIdFromButton != currentMCQsQuestion.dataValues.Id && buttonId.includes("_")) {
                    return;
                }
                // If button was for the same and record already exists, ignore it
                const existingRecord = await waQuestionResponsesRepository.getByQuestionIdAndAnswer(currentMCQsQuestion.dataValues.Id, profileId);
                if (existingRecord) {
                    await getNextMcqQuestion(currentUserState, profileId, userMobileNumber, startingLesson);
                    return;
                }

                // Upper and Lower case answers
                const originalAnswer = messageContent;
                const userAnswer = messageContent.toLowerCase();

                // Get all answers against the question
                const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(currentMCQsQuestion.dataValues.Id);

                // Check if the user answer is correct
                let isCorrectAnswer = false;
                for (let i = 0; i < mcqAnswers.length; i++) {
                    let matchWith = `${String.fromCharCode(65 + i)}`.toLowerCase();
                    if (userAnswer == matchWith) {
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

                await getNextMcqQuestion(currentUserState, profileId, userMobileNumber, startingLesson);
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

                // Send alias and starting instruction
                await sendAliasAndStartingInstruction(userMobileNumber, startingLesson);

                // Send first MCQs question
                const firstMCQsQuestion = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, null);
                // Update question number
                await waUserProgressRepository.updateQuestionNumber(profileId, userMobileNumber, firstMCQsQuestion.dataValues.QuestionNumber);
                const totalQuestions = await multipleChoiceQuestionRepository.getTotalQuestions(currentUserState.dataValues.currentLessonId);

                // Send question
                await sendQuestion(firstMCQsQuestion, totalQuestions, currentUserState, userMobileNumber, profileId, startingLesson);
            }
            else {
                // Parse question ID from button response
                let questionIdFromButton = buttonId;
                if (buttonId) {
                    questionIdFromButton = buttonId.split('_')[0];
                }
                // Get current MCQ question
                const currentMCQsQuestion = await multipleChoiceQuestionRepository.getCurrentMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                // **KEY CHECK** - If button was for a different question, ignore it
                if (questionIdFromButton && questionIdFromButton != currentMCQsQuestion.dataValues.Id && buttonId.includes("_")) {
                    return;
                }
                // If button was for the same and record already exists, ignore it
                const existingRecord = await waQuestionResponsesRepository.getByQuestionIdAndAnswer(currentMCQsQuestion.dataValues.Id, profileId);
                if (existingRecord) {
                    await getNextMcqQuestion(currentUserState, profileId, userMobileNumber, startingLesson);
                    return;
                }
                // Upper and Lower case answers
                const originalAnswer = messageContent;
                const userAnswer = messageContent.toLowerCase();

                // Get all answers against the question
                const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(currentMCQsQuestion.dataValues.Id);

                // Check if the user answer is correct
                let isCorrectAnswer = false;
                for (let i = 0; i < mcqAnswers.length; i++) {
                    let matchWith = `${String.fromCharCode(65 + i)}`.toLowerCase();
                    if (userAnswer == matchWith) {
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

                // Get next MCQ question
                await getNextMcqQuestion(currentUserState, profileId, userMobileNumber, startingLesson);
            }
        }
        return;
    } catch (error) {
        console.error('Error sending lesson to user:', error);
        error.fileName = 'assessmentMcqsView.js';
        throw error;
    }
};

export { assessmentMcqsView };