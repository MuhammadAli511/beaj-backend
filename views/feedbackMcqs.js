import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import { sendMessage, sendButtonMessage, sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { endingMessage } from "../utils/endingMessageUtils.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import multipleChoiceQuestionRepository from "../repositories/multipleChoiceQuestionRepository.js";
import multipleChoiceQuestionAnswerRepository from "../repositories/multipleChoiceQuestionAnswerRepository.js";

const feedbackMcqsView = async (profileId, userMobileNumber, currentUserState, startingLesson, messageType, messageContent, persona = null) => {
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

                // Activity Alias
                const activityAlias = startingLesson.dataValues.activityAlias.replace(/\\n/g, '\n');;
                let lessonMessage = "Activity: " + activityAlias;
                lessonMessage += "\n\n" + finalTextInstruction;
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
                    mcqMessage += "Select one response:\n";
                }
                for (let i = 0; i < mcqAnswers.length; i++) {
                    mcqMessage += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                }

                await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `q${currentMCQsQuestion.dataValues.Id}_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })));
                await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["option a", "option b", "option c"]);
            }
            else {
                // Get current MCQ question
                const currentMCQsQuestion = await multipleChoiceQuestionRepository.getCurrentMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                const originalAnswer = messageContent;

                // Save user response to the database
                const submissionDate = new Date();
                await waQuestionResponsesRepository.create(
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
                    null,
                    1,
                    submissionDate
                );


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
                        mcqMessage += "Select one response:\n";
                    }
                    for (let i = 0; i < mcqAnswers.length; i++) {
                        mcqMessage += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                    }

                    // Reply buttons to answer
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `q${currentMCQsQuestion.dataValues.Id}_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })));
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);

                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["option a", "option b", "option c"]);
                } else {
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

                // Activity Alias
                const activityAlias = startingLesson.dataValues.activityAlias.replace(/\\n/g, '\n');;
                let lessonMessage = "Activity: " + activityAlias;
                lessonMessage += "\n\n" + finalTextInstruction;
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
                    mcqMessage += "Select one response:\n";
                }
                for (let i = 0; i < mcqAnswers.length; i++) {
                    mcqMessage += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                }

                await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `q${currentMCQsQuestion.dataValues.Id}_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })));
                await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["option a", "option b", "option c"]);
            }
            else {
                // Get current MCQ question
                const currentMCQsQuestion = await multipleChoiceQuestionRepository.getCurrentMultipleChoiceQuestion(currentUserState.dataValues.currentLessonId, currentUserState.dataValues.questionNumber);

                const originalAnswer = messageContent;

                // Save user response to the database
                const submissionDate = new Date();
                await waQuestionResponsesRepository.create(
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
                    null,
                    1,
                    submissionDate
                );


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
                        mcqMessage += "Select one response:\n";
                    }
                    for (let i = 0; i < mcqAnswers.length; i++) {
                        mcqMessage += `${String.fromCharCode(65 + i)}) ${mcqAnswers[i].dataValues.AnswerText}\n`;
                    }

                    // Reply buttons to answer
                    await sendButtonMessage(userMobileNumber, mcqMessage, mcqAnswers.map((answer, index) => ({ id: `q${currentMCQsQuestion.dataValues.Id}_${String.fromCharCode(65 + index)}`, title: "Option " + String.fromCharCode(65 + index) })));
                    await createActivityLog(userMobileNumber, "template", "outbound", mcqMessage, null);

                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["option a", "option b", "option c"]);
                } else {
                    // Reset Question Number, Retry Counter, and Activity Type
                    await waUserProgressRepository.updateQuestionNumberRetryCounterActivityType(profileId, userMobileNumber, null, 0, null, null);

                    // ENDING MESSAGE
                    await endingMessage(profileId, userMobileNumber, currentUserState, startingLesson);
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

export { feedbackMcqsView };