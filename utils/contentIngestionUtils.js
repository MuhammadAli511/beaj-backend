import { getDriveMediaUrl } from "../google_sheet_utils/masterSheetUtils.js";
import createLessonService1 from "../services/lessonService.js";
import createMultipleChoiceQuestionService1 from "../services/multipleChoiceQuestionService.js";
import createMultipleChoiceQuestionAnswerService1 from "../services/multipleChoiceQuestionAnswerService.js";
import createSpeakActivityQuestionService1 from "../services/speakActivityQuestionService.js";
import uploadDocumentFileService1 from "../services/documentFilesService.js";

// const contentIngestionUtils = {
//   // Main function to process any activity type
//   processActivity: async function(activity, courseId) {
//     try {
//       let activityType = activity.activityType.toLowerCase();
//       activityType = await this.activityTypeCase(activityType);
      
//       // Check if lesson exists
//       const existingLessonId = await createLessonService1.getByCourseWeekDaySeqService(
//         courseId, 
//         activity.week, 
//         activity.day, 
//         activity.seq
//       );

//       switch (activityType) {
//         case 'mcqs':
//         case 'feedbackMcqs':
//         case 'assessmentMcqs':
//           return await this.processMCQActivity(activity, courseId, activityType, existingLessonId);
        
//         case 'video':
//         case 'videoEnd':
//           return await this.processVideoActivity(activity, courseId, activityType, existingLessonId);
          
//         case 'read':
//           return await this.processReadActivity(activity, courseId, activityType, existingLessonId);
          
//         case 'listenAndSpeak':
//         case 'feedbackAudio':
//           return await this.processListenAndSpeakActivity(activity, courseId, activityType, existingLessonId);
          
//         case 'watchAndSpeak':
//         case 'assessmentWatchAndSpeak':
//         case 'watchAndAudio':
//         case 'watchAndImage':
//           return await this.processWatchAndSpeakActivity(activity, courseId, activityType, existingLessonId);
          
//         case 'conversationalQuestionsBot':
//         case 'conversationalMonologueBot':
//         case 'conversationalAgencyBot':
//           return await this.processConversationalBotActivity(activity, courseId, activityType, existingLessonId);
          
//         case 'speakingPractice':
//           return await this.processSpeakingPracticeActivity(activity, courseId, activityType, existingLessonId);
          
//         default:
//           return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: "Unknown activity type"`;
//       }
//     } catch (error) {
//       return `success: false, activityType: ${activity.activityType}, Alias: ${activity.alias}, error: ${error.message}`;
//     }
//   },

//   // Helper function to match questions by qNo
//   matchQuestionsByQNo: function(activityQuestions, existingQuestions) {
//     const questionMap = new Map();
    
//     // Create a map of existing questions by qNo
//     existingQuestions.forEach(existingQ => {
//       const qNo = existingQ.qNo || existingQ.questionNumber;
//       if (!questionMap.has(qNo)) {
//         questionMap.set(qNo, []);
//       }
//       questionMap.get(qNo).push(existingQ);
//     });

//     const matchedQuestions = [];
//     const unmatchedExistingQuestions = [...existingQuestions];

//     activityQuestions.forEach((activityQ, index) => {
//       let qNo = activityQ.qNo;
      
//       // If qNo is empty, assume sequential numbering starting from 1
//       if (!qNo || qNo === '') {
//         qNo = (index + 1).toString();
//       }

//       // Find matching existing question by qNo
//       const matchingQuestions = questionMap.get(qNo) || [];
      
//       if (matchingQuestions.length > 0) {
//         const matchedQuestion = matchingQuestions.shift(); // Take the first match
//         matchedQuestions.push({
//           activityQuestion: activityQ,
//           existingQuestion: matchedQuestion,
//           qNo: qNo
//         });
        
//         // Remove from unmatched list
//         const unmatchedIndex = unmatchedExistingQuestions.findIndex(q => q.Id === matchedQuestion.Id || q.id === matchedQuestion.id);
//         if (unmatchedIndex > -1) {
//           unmatchedExistingQuestions.splice(unmatchedIndex, 1);
//         }
//       } else {
//         // No existing question found, will create new
//         matchedQuestions.push({
//           activityQuestion: activityQ,
//           existingQuestion: null,
//           qNo: qNo
//         });
//       }
//     });

//     return {
//       matchedQuestions,
//       questionsToDelete: unmatchedExistingQuestions
//     };
//   },

//   // Helper function to delete extra questions for MCQ activities
//   deleteExtraMCQQuestions: async function(questionsToDelete) {
//     for (const question of questionsToDelete) {
//       const questionId = question.Id || question.id;
      
//       // First delete all answers for this question
//       const existingAnswers = await createMultipleChoiceQuestionAnswerService1.getMultipleChoiceQuestionAnswerByQuestionIdService(questionId);
//       for (const answer of existingAnswers) {
//         await createMultipleChoiceQuestionAnswerService1.deleteMultipleChoiceQuestionAnswerService(answer.Id || answer.id);
//       }
      
//       // Then delete the question
//       await createMultipleChoiceQuestionService1.deleteMultipleChoiceQuestionService(questionId);
//     }
//   },

//   // Helper function to delete extra questions for Speak activities
//   deleteExtraSpeakQuestions: async function(questionsToDelete) {
//     for (const question of questionsToDelete) {
//       const questionId = question.Id || question.id;
//       await createSpeakActivityQuestionService1.deleteSpeakActivityQuestionService(questionId);
//     }
//   },

//   // Create base lesson for any activity
//   createBaseLesson: async function(activity, courseId, activityType, existingLessonId = null) {
//     // Download audio instruction if exists
//     let audioInstructionFile = null;
//     if (activity.audioInstruction) {
//       audioInstructionFile = await getDriveMediaUrl(activity.audioInstruction);
//     }

//     let response;
//     if (existingLessonId) {
//       // Update existing lesson
//       response = await createLessonService1.updateLessonService(
//         existingLessonId,
//         "week",
//         activity.day,
//         activityType,
//         activity.alias,
//         activity.week,
//         activity.textInstruction,
//         courseId,
//         activity.seq,
//         "Active",
//         activity.textInstruction,
//         audioInstructionFile
//       );
//       response.LessonId = existingLessonId;
//     } else {
//       // Create new lesson
//       response = await createLessonService1.createLessonService(
//         "week",
//         activity.day,
//         activityType,
//         activity.alias,
//         activity.week,
//         activity.textInstruction,
//         courseId,
//         activity.seq,
//         "Active",
//         activity.textInstruction,
//         audioInstructionFile
//       );
//     }

//     return response;
//   },

//   // Process MCQ activities with proper question matching
//   processMCQActivity: async function(activity, courseId, activityType, existingLessonId = null) {
//     try {
//       const response = await this.createBaseLesson(activity, courseId, activityType, existingLessonId);
//       const lessonId = response.LessonId;

//       let existingQuestions = [];
//       if (existingLessonId) {
//         existingQuestions = await createMultipleChoiceQuestionService1.getMultipleChoiceQuestionsByLessonIdService(existingLessonId);
//       }

//       // Create flat list of all questions (accounting for difficulties)
//       const flatActivityQuestions = [];
//       for (const question of activity.questions || []) {
//         for (let diffIndex = 0; diffIndex < question.difficulties.length; diffIndex++) {
//           flatActivityQuestions.push({
//             ...question,
//             difficultyIndex: diffIndex,
//             difficulty: question.difficulties[diffIndex]
//           });
//         }
//       }

//       // Match questions
//       const { matchedQuestions, questionsToDelete } = this.matchQuestionsByQNo(flatActivityQuestions, existingQuestions);

//       // Process matched questions
//       for (const match of matchedQuestions) {
//         const question = match.activityQuestion;
//         const diff = question.difficulty;
//         const qText = question.qText || "";
//         let qType = "Text";
//         const optionType = "Text";

//         // Determine question type
//         if(qText && diff.qVideo){
//           qType = "Text+Video";
//         } else if(qText && diff.qImage){
//           qType = "Text+Image";
//         } else if(qText){
//           qType = "Text";
//         } else {
//           qType = "Image";
//         }

//         let questionResponse;
//         if (match.existingQuestion) {
//           // Update existing question
//           questionResponse = await createMultipleChoiceQuestionService1.updateMultipleChoiceQuestionService(
//             match.existingQuestion.Id,
//             diff.qAudio,
//             diff.qImage,
//             diff.qVideo,
//             qType,
//             qText,
//             match.qNo,
//             lessonId,
//             optionType,
//             diff.qAudio,
//             diff.qImage,
//             diff.qVideo
//           );
//           questionResponse.Id = match.existingQuestion.Id;
//         } else {
//           // Create new question
//           questionResponse = await createMultipleChoiceQuestionService1.createMultipleChoiceQuestionService(
//             diff.qAudio,
//             diff.qImage,
//             diff.qVideo,
//             qType,
//             qText,
//             match.qNo,
//             lessonId,
//             optionType
//           );
//         }

//         const questionId = questionResponse.Id;

//         // Handle answers
//         let existingAnswers = [];
//         if (match.existingQuestion) {
//           existingAnswers = await createMultipleChoiceQuestionAnswerService1.getMultipleChoiceQuestionAnswerByQuestionIdService(questionId);
//         }

//         // Process answers
//         for (let ansIndex = 0; ansIndex < diff.answers.length; ansIndex++) {
//           const ans = diff.answers[ansIndex];
//           const isCorrect = ans.isCorrect;
//           const existingAnswer = existingAnswers[ansIndex];

//           if (existingAnswer) {
//             // Update existing answer
//             await createMultipleChoiceQuestionAnswerService1.updateMultipleChoiceQuestionAnswerService(
//               existingAnswer.Id,
//               ans.aText,
//               ans.aImage,
//               ans.aAudio,
//               isCorrect,
//               questionId,
//               (ansIndex + 1).toString(),
//               ans.cfText,
//               ans.cfImage,
//               ans.cfAudio
//             );
//           } else {
//             // Create new answer
//             await createMultipleChoiceQuestionAnswerService1.createMultipleChoiceQuestionAnswerService(
//               ans.aText,
//               ans.aImage,
//               ans.aAudio,
//               isCorrect,
//               questionId,
//               (ansIndex + 1).toString(),
//               ans.cfText,
//               ans.cfImage,
//               ans.cfAudio
//             );
//           }
//         }

//         // Delete extra answers if existing has more than current
//         if (existingAnswers.length > diff.answers.length) {
//           for (let i = diff.answers.length; i < existingAnswers.length; i++) {
//             await createMultipleChoiceQuestionAnswerService1.deleteMultipleChoiceQuestionAnswerService(existingAnswers[i].Id);
//           }
//         }
//       }

//       // Delete extra questions
//       if (questionsToDelete.length > 0) {
//         await this.deleteExtraMCQQuestions(questionsToDelete);
//       }

//       return `success: true, activityType: ${activityType}, Alias: ${activity.alias}, LessonId: ${lessonId}`;
//     } catch (error) {
//       return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: ${error.message}`;
//     }
//   },

//   // Process Video activities
//   processVideoActivity: async function(activity, courseId, activityType, existingLessonId = null) {
//     try {
//       const response = await this.createBaseLesson(activity, courseId, activityType, existingLessonId);
//       const lessonId = response.LessonId;

//       // For video activities, we need video from questions
//       if (activity.questions && activity.questions.length > 0) {
//         const firstQuestion = activity.questions[0];
//         const firstDifficulty = firstQuestion.difficulties[0];

//         if (!firstDifficulty.qVideo) {
//           return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: "Video is required for video activity"`;
//         }

//         let existingDocuments = [];
//         if (existingLessonId) {
//           existingDocuments = await uploadDocumentFileService1.getDocumentFilesByLessonIdService(existingLessonId);
//         }

//         // Find existing video document
//         const existingVideoDoc = existingDocuments.find(doc => doc.mediaType === 'video');

//         if (existingVideoDoc) {
//           // Update existing video
//           await uploadDocumentFileService1.updateDocumentFilesService(
//             existingVideoDoc.id,
//             firstDifficulty.qVideo,
//             lessonId,
//             "English",
//             "video"
//           );
//         } else {
//           // Create new video
//           const videoResponse = await uploadDocumentFileService1.createDocumentFilesService(
//             firstDifficulty.qVideo,
//             lessonId,
//             "English",
//             "video"
//           );

//           if (videoResponse.status !== 200) {
//             return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: "Failed to upload video file"`;
//           }
//         }
//       }
//       return `success: true, activityType: ${activityType}, Alias: ${activity.alias}, LessonId: ${lessonId}`;
//     } catch (error) {
//       return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: ${error.message}`;
//     }
//   },

//   // Process Read activities
//   processReadActivity: async function(activity, courseId, activityType, existingLessonId = null) {
//     try {
//       const response = await this.createBaseLesson(activity, courseId, activityType, existingLessonId);
//       const lessonId = response.LessonId;

//       // For read activities, we need video from questions
//       if (activity.questions && activity.questions.length > 0) {
//         const firstQuestion = activity.questions[0];
//         const firstDifficulty = firstQuestion.difficulties[0];

//         if (!firstDifficulty.qVideo) {
//           return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: "Video is required for read activity"`;
//         }

//         let existingDocuments = [];
//         if (existingLessonId) {
//           existingDocuments = await uploadDocumentFileService1.getDocumentFilesByLessonIdService(existingLessonId);
//         }

//         // Find existing video document
//         const existingVideoDoc = existingDocuments.find(doc => doc.mediaType === 'video');

//         if (existingVideoDoc) {
//           // Update existing video
//           await uploadDocumentFileService1.updateDocumentFilesService(
//             existingVideoDoc.id,
//             firstDifficulty.qVideo,
//             lessonId,
//             "English",
//             "video"
//           );
//         } else {
//           // Create new video
//           const videoResponse = await uploadDocumentFileService1.createDocumentFilesService(
//             firstDifficulty.qVideo,
//             lessonId,
//             "English",
//             "video"
//           );

//           if (videoResponse.status !== 200) {
//             return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: "Video upload failed"`;
//           }
//         }
//       }

//       return `success: true, activityType: ${activityType}, Alias: ${activity.alias}, LessonId: ${lessonId}`;
//     } catch (error) {
//       return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: ${error.message}`;
//     }
//   },

//   // Process Listen and Speak activities with proper question matching
//   processListenAndSpeakActivity: async function(activity, courseId, activityType, existingLessonId = null) {
//     try {
//       const response = await this.createBaseLesson(activity, courseId, activityType, existingLessonId);
//       const lessonId = response.LessonId;

//       let existingQuestions = [];
//       if (existingLessonId) {
//         existingQuestions = await createSpeakActivityQuestionService1.getSpeakActivityQuestionsByLessonIdService(existingLessonId);
//       }

//       // Match questions
//       const { matchedQuestions, questionsToDelete } = this.matchQuestionsByQNo(activity.questions, existingQuestions);

//       // Process matched questions
//       for (const match of matchedQuestions) {
//         const question = match.activityQuestion;
//         const answers = question.difficulties[0]?.answers || [];
//         const answersArray = answers
//           .map(answer => `"${answer.aText.replace(/"/g, '\\"')}"`)
//           .join(",");

//         if (match.existingQuestion) {
//           // Update existing question
//           await createSpeakActivityQuestionService1.updateSpeakActivityQuestionService(
//             match.existingQuestion.id,
//             question.qText,
//             question.difficulties[0]?.qVideo || null,
//             question.difficulties[0]?.qAudio || null,
//             answersArray,
//             lessonId,
//             match.qNo,
//             activityType,
//             question.difficulties[0]?.difficulty || null,
//             question.difficulties[0]?.answers[0]?.cfText || null,
//             question.difficulties[0]?.answers[0]?.cfImage || null,
//             question.difficulties[0]?.answers[0]?.cfAudio || null
//           );
//         } else {
//           // Create new question
//           await createSpeakActivityQuestionService1.createSpeakActivityQuestionService(
//             question.qText,
//             question.difficulties[0]?.qVideo || null,
//             question.difficulties[0]?.qAudio || null,
//             answersArray,
//             lessonId,
//             match.qNo,
//             activityType,
//             question.difficulties[0]?.difficulty || null,
//             question.difficulties[0]?.answers[0]?.cfText || null,
//             question.difficulties[0]?.answers[0]?.cfImage || null,
//             question.difficulties[0]?.answers[0]?.cfAudio || null
//           );
//         }
//       }

//       // Delete extra questions
//       if (questionsToDelete.length > 0) {
//         await this.deleteExtraSpeakQuestions(questionsToDelete);
//       }

//       return `success: true, activityType: ${activityType}, Alias: ${activity.alias}, LessonId: ${lessonId}`;
//     } catch (error) {
//       return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: ${error.message}`;
//     }
//   },

//   // Process Watch and Speak activities with proper question matching
//   processWatchAndSpeakActivity: async function(activity, courseId, activityType, existingLessonId = null) {
//     try {
//       const response = await this.createBaseLesson(activity, courseId, activityType, existingLessonId);
//       const lessonId = response.LessonId;

//       let existingQuestions = [];
//       if (existingLessonId) {
//         existingQuestions = await createSpeakActivityQuestionService1.getSpeakActivityQuestionsByLessonIdService(existingLessonId);
//       }

//       // Create flat list of all questions (accounting for difficulties)
//       const flatActivityQuestions = [];
//       for (const question of activity.questions) {
//         for (let diffIndex = 0; diffIndex < question.difficulties.length; diffIndex++) {
//           flatActivityQuestions.push({
//             ...question,
//             difficultyIndex: diffIndex,
//             difficulty: question.difficulties[diffIndex]
//           });
//         }
//       }

//       // Match questions
//       const { matchedQuestions, questionsToDelete } = this.matchQuestionsByQNo(flatActivityQuestions, existingQuestions);

//       // Process matched questions
//       for (const match of matchedQuestions) {
//         const question = match.activityQuestion;
//         const difficulty = question.difficulty;
//         const answers = difficulty?.answers || [];
//         let answersArray = null;
        
//         if (activityType === 'watchAndSpeak' || activityType === 'assessmentWatchAndSpeak') {
//           answersArray = answers
//             .map(answer => `"${answer.aText.replace(/"/g, '\\"')}"`)
//             .join(",");
//         }

//         if (match.existingQuestion) {
//           // Update existing question
//           await createSpeakActivityQuestionService1.updateSpeakActivityQuestionService(
//             match.existingQuestion.id,
//             question.qText,
//             question.difficulties[0]?.qVideo || null,
//             question.difficulties[0]?.qAudio || null,
//             answersArray,
//             lessonId,
//             match.qNo,
//             activityType,
//             difficulty?.difficulty || null,
//             difficulty?.answers[0]?.cfText || null,
//             difficulty?.answers[0]?.cfImage || null,
//             difficulty?.answers[0]?.cfAudio || null
//           );
//         } else {
//           // Create new question
//           await createSpeakActivityQuestionService1.createSpeakActivityQuestionService(
//             question.qText,
//             question.difficulties[0]?.qVideo || null,
//             question.difficulties[0]?.qAudio || null,
//             answersArray,
//             lessonId,
//             match.qNo,
//             activityType,
//             difficulty?.difficulty || null,
//             difficulty?.answers[0]?.cfText || null,
//             difficulty?.answers[0]?.cfImage || null,
//             difficulty?.answers[0]?.cfAudio || null
//           );
//         }
//       }

//       // Delete extra questions
//       if (questionsToDelete.length > 0) {
//         await this.deleteExtraSpeakQuestions(questionsToDelete);
//       }

//       return `success: true, activityType: ${activityType}, Alias: ${activity.alias}, LessonId: ${lessonId}`;
//     } catch (error) {
//       return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: ${error.message}`;
//     }
//   },

//   // Process Conversational Bot activities with proper question matching
//   processConversationalBotActivity: async function(activity, courseId, activityType, existingLessonId = null) {
//     try {
//       const response = await this.createBaseLesson(activity, courseId, activityType, existingLessonId);
//       const lessonId = response.LessonId;

//       let existingQuestions = [];
//       if (existingLessonId) {
//         existingQuestions = await createSpeakActivityQuestionService1.getSpeakActivityQuestionsByLessonIdService(existingLessonId);
//       }

//       // Match questions
//       const { matchedQuestions, questionsToDelete } = this.matchQuestionsByQNo(activity.questions, existingQuestions);

//       // Process matched questions
//       for (const match of matchedQuestions) {
//         const question = match.activityQuestion;

//         if (activityType === "conversationalQuestionsBot") {
//           if (match.existingQuestion) {
//             // Update existing question
//             await createSpeakActivityQuestionService1.updateSpeakActivityQuestionService(
//               match.existingQuestion.id,
//               question.qText,
//               null,
//               null,
//               null,
//               lessonId,
//               match.qNo,
//               activityType,
//               question.difficulties[0]?.difficulty || null,
//               null,
//               null,
//               null
//             );
//           } else {
//             // Create new question
//             await createSpeakActivityQuestionService1.createSpeakActivityQuestionService(
//               question.qText,
//               null,
//               null,
//               null,
//               lessonId,
//               match.qNo,
//               activityType,
//               question.difficulties[0]?.difficulty || null,
//               null,
//               null,
//               null
//             );
//           }
//         } else if (activityType === "conversationalMonologueBot") {
//           if (match.existingQuestion) {
//             // Update existing question
//             await createSpeakActivityQuestionService1.updateSpeakActivityQuestionService(
//               match.existingQuestion.id,
//               question.qText,
//               question.difficulties[0]?.qVideo || null,
//               null,
//               null,
//               lessonId,
//               match.qNo,
//               activityType,
//               question.difficulties[0]?.difficulty || null,
//               null,
//               null,
//               null
//             );
//           } else {
//             // Create new question
//             await createSpeakActivityQuestionService1.createSpeakActivityQuestionService(
//               question.qText,
//               question.difficulties[0]?.qVideo || null,
//               null,
//               null,
//               lessonId,
//               match.qNo,
//               activityType,
//               question.difficulties[0]?.difficulty || null,
//               null,
//               null,
//               null
//             );
//           }
//         } else if (activityType === "conversationalAgencyBot") {
//           if (match.existingQuestion) {
//             // Update existing question
//             await createSpeakActivityQuestionService1.updateSpeakActivityQuestionService(
//               match.existingQuestion.id,
//               question.qText,
//               null,
//               null,
//               null,
//               lessonId,
//               match.qNo,
//               activityType,
//               question.difficulties[0]?.difficulty || null,
//               null,
//               null,
//               null
//             );
//           } else {
//             // Create new question
//             await createSpeakActivityQuestionService1.createSpeakActivityQuestionService(
//               question.qText,
//               null,
//               null,
//               null,
//               lessonId,
//               match.qNo,
//               activityType,
//               question.difficulties[0]?.difficulty || null,
//               null,
//               null,
//               null
//             );
//           }
//         }
//       }

//       // Delete extra questions
//       if (questionsToDelete.length > 0) {
//         await this.deleteExtraSpeakQuestions(questionsToDelete);
//       }

//       return `success: true, activityType: ${activityType}, Alias: ${activity.alias}, LessonId: ${lessonId}`;
//     } catch (error) {
//       return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: ${error.message}`;
//     }
//   },

//   // Process Speaking Practice activities with proper question matching
//   processSpeakingPracticeActivity: async function(activity, courseId, activityType, existingLessonId = null) {
//     try {
//       const response = await this.createBaseLesson(activity, courseId, activityType, existingLessonId);
//       const lessonId = response.LessonId;

//       let existingQuestions = [];
//       if (existingLessonId) {
//         existingQuestions = await createSpeakActivityQuestionService1.getSpeakActivityQuestionsByLessonIdService(existingLessonId);
//       }

//       // Match questions
//       const { matchedQuestions, questionsToDelete } = this.matchQuestionsByQNo(activity.questions, existingQuestions);

//       // Process matched questions
//       for (const match of matchedQuestions) {
//         const question = match.activityQuestion;

//         if (match.existingQuestion) {
//           // Update existing question
//           await createSpeakActivityQuestionService1.updateSpeakActivityQuestionService(
//             match.existingQuestion.id,
//             question.qText,
//             question.difficulties[0]?.qAudio || null,
//             null,
//             null,
//             lessonId,
//             match.qNo,
//             activityType,
//             question.difficulties[0]?.difficulty || null,
//             null,
//             null,
//             null
//           );
//         } else {
//           // Create new question
//           await createSpeakActivityQuestionService1.createSpeakActivityQuestionService(
//             question.qText,
//             question.difficulties[0]?.qAudio || null,
//             null,
//             null,
//             lessonId,
//             match.qNo,
//             activityType,
//             question.difficulties[0]?.difficulty || null,
//             null,
//             null,
//             null
//           );
//         }
//       }

//       // Delete extra questions
//       if (questionsToDelete.length > 0) {
//         await this.deleteExtraSpeakQuestions(questionsToDelete);
//       }

//       return `success: true, activityType: ${activityType}, Alias: ${activity.alias}, LessonId: ${lessonId}`;
//     } catch (error) {
//       return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: ${error.message}`;
//     }
//   },

//   activityTypeCase: async function (activityType){
//     if(activityType == "assessmentwatchandspeak") {
//         activityType = "assessmentWatchAndSpeak";
//       }
//       else if(activityType == "feedbackmcqs") {
//         activityType = "feedbackMcqs";
//       }
//       else if(activityType == "assessmentmcqs") {
//         activityType = "assessmentMcqs";
//       }
//       else if(activityType == "watchandspeak") {
//         activityType = "watchAndSpeak";
//       }
//       else if(activityType == "conversationalquestionsbot") {
//         activityType = "conversationalQuestionsBot";
//       }
//       else if(activityType == "conversationalmonologuebot") {
//         activityType = "conversationalMonologueBot";
//       }
//       else if(activityType == "conversationalagencybot") {
//         activityType = "conversationalAgencyBot";
//       }
//       else if(activityType == "speakingpractice") {
//         activityType = "speakingPractice";
//       }
//       else if(activityType == "listenandspeak") {
//         activityType = "listenAndSpeak";
//       }
//       else if(activityType == "feedbackaudio") {
//         activityType = "feedbackAudio";
//       }
//       else if(activityType == "watchandaudio") {
//         activityType = "watchAndAudio";
//       }
//       else if(activityType == "videoend" || activityType == "watchend") {
//         activityType = "videoEnd";
//       }
//        else if(activityType == "video" || activityType == "watch") {
//         activityType = "video";
//       }
//       else if(activityType == "watchandimage") {
//         activityType = "watchAndImage";
//       }
//       return activityType;
//   },
// };

// export default contentIngestionUtils;



const contentIngestionUtils = {
  // Main function to process any activity type
  processActivity: async function(activity, courseId) {
    try {
      let activityType = activity.activityType.toLowerCase();
      activityType = await this.activityTypeCase(activityType);
      
      // Check if lesson exists
      const existingLessonId = await createLessonService1.getByCourseWeekDaySeqService(
        courseId, 
        activity.week, 
        activity.day, 
        activity.seq
      );

      switch (activityType) {
        case 'mcqs':
        case 'feedbackMcqs':
        case 'assessmentMcqs':
          return await this.processMCQActivity(activity, courseId, activityType, existingLessonId);
        
        case 'video':
        case 'videoEnd':
          return await this.processVideoActivity(activity, courseId, activityType, existingLessonId);
          
        case 'read':
          return await this.processReadActivity(activity, courseId, activityType, existingLessonId);
          
        case 'listenAndSpeak':
        case 'feedbackAudio':
          return await this.processListenAndSpeakActivity(activity, courseId, activityType, existingLessonId);
          
        case 'watchAndSpeak':
        case 'assessmentWatchAndSpeak':
        case 'watchAndAudio':
        case 'watchAndImage':
          return await this.processWatchAndSpeakActivity(activity, courseId, activityType, existingLessonId);
          
        case 'conversationalQuestionsBot':
        case 'conversationalMonologueBot':
        case 'conversationalAgencyBot':
          return await this.processConversationalBotActivity(activity, courseId, activityType, existingLessonId);
          
        case 'speakingPractice':
          return await this.processSpeakingPracticeActivity(activity, courseId, activityType, existingLessonId);
          
        default:
          return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: "Unknown activity type"`;
      }
    } catch (error) {
      return `success: false, activityType: ${activity.activityType}, Alias: ${activity.alias}, error: ${error.message}`;
    }
  },

  // Create base lesson for any activity
  createBaseLesson: async function(activity, courseId, activityType, existingLessonId = null) {
    // Download audio instruction if exists
    let audioInstructionFile = null;
    if (activity.audioInstruction) {
      audioInstructionFile = await getDriveMediaUrl(activity.audioInstruction);
    }

    let response;
    if (existingLessonId) {
      // Update existing lesson
      response = await createLessonService1.updateLessonService(
        existingLessonId,
        "week",
        activity.day,
        activityType,
        activity.alias,
        activity.week,
        activity.textInstruction,
        courseId,
        activity.seq,
        "Active",
        activity.textInstruction,
        audioInstructionFile
      );
      response.LessonId = existingLessonId;
    } else {
      // Create new lesson
      response = await createLessonService1.createLessonService(
        "week",
        activity.day,
        activityType,
        activity.alias,
        activity.week,
        activity.textInstruction,
        courseId,
        activity.seq,
        "Active",
        activity.textInstruction,
        audioInstructionFile
      );
    }

    return response;
  },

  // Helper function to delete excess MCQ questions and answers
  deleteExcessMCQQuestions: async function(existingQuestions, expectedQuestionCount) {
    if (existingQuestions.length > expectedQuestionCount) {
      const questionsToDelete = existingQuestions.slice(expectedQuestionCount);
      
      for (const question of questionsToDelete) {
        try {
          // Delete answers first
          const answers = await createMultipleChoiceQuestionAnswerService1.getMultipleChoiceQuestionAnswerByQuestionIdService(question.Id);
          for (const answer of answers) {
            await createMultipleChoiceQuestionAnswerService1.deleteMultipleChoiceQuestionAnswerService(answer.Id);
          }
          // Delete question
          await createMultipleChoiceQuestionService1.deleteMultipleChoiceQuestionService(question.Id);
        } catch (error) {
          console.error(`Error deleting MCQ question ${question.Id}:`, error);
        }
      }
    }
  },

  // Helper function to delete excess speaking questions
  deleteExcessSpeakingQuestions: async function(existingQuestions, expectedQuestionCount) {
    if (existingQuestions.length > expectedQuestionCount) {
      const questionsToDelete = existingQuestions.slice(expectedQuestionCount);
      
      for (const question of questionsToDelete) {
        try {
          await createSpeakActivityQuestionService1.deleteSpeakActivityQuestionService(question.id);
        } catch (error) {
          console.error(`Error deleting speaking question ${question.id}:`, error);
        }
      }
    }
  },

  // Helper function to delete excess MCQ answers
  deleteExcessMCQAnswers: async function(existingAnswers, expectedAnswerCount) {
    if (existingAnswers.length > expectedAnswerCount) {
      const answersToDelete = existingAnswers.slice(expectedAnswerCount);
      
      for (const answer of answersToDelete) {
        try {
          await createMultipleChoiceQuestionAnswerService1.deleteMultipleChoiceQuestionAnswerService(answer.Id);
        } catch (error) {
          console.error(`Error deleting MCQ answer ${answer.Id}:`, error);
        }
      }
    }
  },

  // Process MCQ activities with delete functionality
  processMCQActivity: async function(activity, courseId, activityType, existingLessonId = null) {
    try {
      const response = await this.createBaseLesson(activity, courseId, activityType, existingLessonId);
      const lessonId = response.LessonId;

      let existingQuestions = [];
      if (existingLessonId) {
        // Get existing questions
        existingQuestions = await createMultipleChoiceQuestionService1.getMultipleChoiceQuestionsByLessonIdService(existingLessonId);
      }

      // Calculate expected total questions
      let expectedQuestionCount = 0;
      for (const question of activity.questions || []) {
        expectedQuestionCount += question.difficulties.length;
      }

      let questionIndex = 0;
      for (const question of activity.questions || []) {
        const qText = question.qText || "";
        let qType = "Text";
        const qNo = question.qNo;
        const optionType = "Text";

        for (let diffIndex = 0; diffIndex < question.difficulties.length; diffIndex++) {
          const diff = question.difficulties[diffIndex];
          
          // Determine question type
          if(qText && diff.qVideo){
              qType = "Text+Video";
            }
          else if(qText && diff.qImage){
              qType = "Text+Image";
          }
          else if(qText){
              qType = "Text";
          }
          else{
            qType = "Image";
          }

          const existingQuestion = existingQuestions[questionIndex];
          
          let questionResponse;
          if (existingQuestion) {
            // Update existing question
            questionResponse = await createMultipleChoiceQuestionService1.updateMultipleChoiceQuestionService(
              existingQuestion.Id,
              diff.qAudio,
              diff.qImage,
              diff.qVideo,
              qType,
              qText,
              qNo,
              lessonId,
              optionType,
              diff.qAudio,
              diff.qImage,
              diff.qVideo
            );
            questionResponse.Id = existingQuestion.Id;
          } else {
            // Create new question
            questionResponse = await createMultipleChoiceQuestionService1.createMultipleChoiceQuestionService(
              diff.qAudio,
              diff.qImage,
              diff.qVideo,
              qType,
              qText,
              qNo,
              lessonId,
              optionType
            );
          }

          const questionId = questionResponse.Id;

          // Handle answers
          let existingAnswers = [];
          if (existingQuestion) {
            existingAnswers = await createMultipleChoiceQuestionAnswerService1.getMultipleChoiceQuestionAnswerByQuestionIdService(questionId);
          }

          // Process current answers
          for (let ansIndex = 0; ansIndex < diff.answers.length; ansIndex++) {
            const ans = diff.answers[ansIndex];
            const isCorrect = ans.isCorrect;
            const existingAnswer = existingAnswers[ansIndex];

            if (existingAnswer) {
              // Update existing answer
              await createMultipleChoiceQuestionAnswerService1.updateMultipleChoiceQuestionAnswerService(
                existingAnswer.Id,
                ans.aText,
                ans.aImage,
                ans.aAudio,
                isCorrect,
                questionId,
                (ansIndex + 1).toString(),
                ans.cfText,
                ans.cfImage,
                ans.cfAudio
              );
            } else {
              // Create new answer
              await createMultipleChoiceQuestionAnswerService1.createMultipleChoiceQuestionAnswerService(
                ans.aText,
                ans.aImage,
                ans.aAudio,
                isCorrect,
                questionId,
                (ansIndex + 1).toString(),
                ans.cfText,
                ans.cfImage,
                ans.cfAudio
              );
            }
          }

          // Delete excess answers if any
          await this.deleteExcessMCQAnswers(existingAnswers, diff.answers.length);
          
          questionIndex++;
        }
      }

      // Delete excess questions if any
      await this.deleteExcessMCQQuestions(existingQuestions, expectedQuestionCount);

      return `success: true, activityType: ${activityType}, Alias: ${activity.alias}, LessonId: ${lessonId}`;
    } catch (error) {
      return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: ${error.message}`;
    }
  },

  // Process Video activities
  processVideoActivity: async function(activity, courseId, activityType, existingLessonId = null) {
    try {
      const response = await this.createBaseLesson(activity, courseId, activityType, existingLessonId);
      const lessonId = response.LessonId;

      // For video activities, we need video from questions
      if (activity.questions && activity.questions.length > 0) {
        const firstQuestion = activity.questions[0];
        const firstDifficulty = firstQuestion.difficulties[0];

        if (!firstDifficulty.qVideo) {
          return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: "Video is required for video activity"`;
        }

        let existingDocuments = [];
        if (existingLessonId) {
          existingDocuments = await uploadDocumentFileService1.getDocumentFilesByLessonIdService(existingLessonId);
        }

        // Find existing video document
        const existingVideoDoc = existingDocuments.find(doc => doc.mediaType === 'video');

        if (existingVideoDoc) {
          // Update existing video
          await uploadDocumentFileService1.updateDocumentFilesService(
            existingVideoDoc.id,
            firstDifficulty.qVideo,
            lessonId,
            "English",
            "video"
          );
        } else {
          // Create new video
          const videoResponse = await uploadDocumentFileService1.createDocumentFilesService(
            firstDifficulty.qVideo,
            lessonId,
            "English",
            "video"
          );

          if (videoResponse.status !== 200) {
            return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: "Failed to upload video file"`;
          }
        }
      }
      return `success: true, activityType: ${activityType}, Alias: ${activity.alias}, LessonId: ${lessonId}`;
    } catch (error) {
      return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: ${error.message}`;
    }
  },

  // Process Read activities
  processReadActivity: async function(activity, courseId, activityType, existingLessonId = null) {
    try {
      const response = await this.createBaseLesson(activity, courseId, activityType, existingLessonId);
      const lessonId = response.LessonId;

      // For read activities, we need video from questions
      if (activity.questions && activity.questions.length > 0) {
        const firstQuestion = activity.questions[0];
        const firstDifficulty = firstQuestion.difficulties[0];

        if (!firstDifficulty.qVideo) {
          return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: "Video is required for read activity"`;
        }

        let existingDocuments = [];
        if (existingLessonId) {
          existingDocuments = await uploadDocumentFileService1.getDocumentFilesByLessonIdService(existingLessonId);
        }

        // Find existing video document
        const existingVideoDoc = existingDocuments.find(doc => doc.mediaType === 'video');

        if (existingVideoDoc) {
          // Update existing video
          await uploadDocumentFileService1.updateDocumentFilesService(
            existingVideoDoc.id,
            firstDifficulty.qVideo,
            lessonId,
            "English",
            "video"
          );
        } else {
          // Create new video
          const videoResponse = await uploadDocumentFileService1.createDocumentFilesService(
            firstDifficulty.qVideo,
            lessonId,
            "English",
            "video"
          );

          if (videoResponse.status !== 200) {
            return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: "Video upload failed"`;
          }
        }
      }

      return `success: true, activityType: ${activityType}, Alias: ${activity.alias}, LessonId: ${lessonId}`;
    } catch (error) {
      return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: ${error.message}`;
    }
  },

  // Process Listen and Speak activities with delete functionality
  processListenAndSpeakActivity: async function(activity, courseId, activityType, existingLessonId = null) {
    try {
      const response = await this.createBaseLesson(activity, courseId, activityType, existingLessonId);
      const lessonId = response.LessonId;

      let existingQuestions = [];
      if (existingLessonId) {
        existingQuestions = await createSpeakActivityQuestionService1.getSpeakActivityQuestionsByLessonIdService(existingLessonId);
      }

      for (let qIndex = 0; qIndex < activity.questions.length; qIndex++) {
        const question = activity.questions[qIndex];
        const answers = question.difficulties[0]?.answers || [];
        const answersArray = answers
          .map(answer => `"${answer.aText.replace(/"/g, '\\"')}"`)
          .join(",");

        const existingQuestion = existingQuestions[qIndex];

        if (existingQuestion) {
          // Update existing question
          await createSpeakActivityQuestionService1.updateSpeakActivityQuestionService(
            existingQuestion.id,
            question.qText,
            question.difficulties[0]?.qVideo || null,
            question.difficulties[0]?.qAudio || null,
            answersArray,
            lessonId,
            question.qNo || (qIndex + 1).toString(),
            activityType,
            question.difficulties[0]?.difficulty || null,
            question.difficulties[0]?.answers[0]?.cfText || null,
            question.difficulties[0]?.answers[0]?.cfImage || null,
            question.difficulties[0]?.answers[0]?.cfAudio || null
          );
        } else {
          // Create new question
          await createSpeakActivityQuestionService1.createSpeakActivityQuestionService(
            question.qText,
            question.difficulties[0]?.qVideo || null,
            question.difficulties[0]?.qAudio || null,
            answersArray,
            lessonId,
            question.qNo || (qIndex + 1).toString(),
            activityType,
            question.difficulties[0]?.difficulty || null,
            question.difficulties[0]?.answers[0]?.cfText || null,
            question.difficulties[0]?.answers[0]?.cfImage || null,
            question.difficulties[0]?.answers[0]?.cfAudio || null
          );
        }
      }

      // Delete excess questions if any
      await this.deleteExcessSpeakingQuestions(existingQuestions, activity.questions.length);

      return `success: true, activityType: ${activityType}, Alias: ${activity.alias}, LessonId: ${lessonId}`;
    } catch (error) {
      return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: ${error.message}`;
    }
  },

  // Process Watch and Speak activities with delete functionality
  processWatchAndSpeakActivity: async function(activity, courseId, activityType, existingLessonId = null) {
    try {
      const response = await this.createBaseLesson(activity, courseId, activityType, existingLessonId);
      const lessonId = response.LessonId;

      let existingQuestions = [];
      if (existingLessonId) {
        existingQuestions = await createSpeakActivityQuestionService1.getSpeakActivityQuestionsByLessonIdService(existingLessonId);
      }

      // Calculate expected question count
      let expectedQuestionCount = 0;
      for (const question of activity.questions) {
        expectedQuestionCount += question.difficulties.length;
      }

      let questionCounter = 0;
      for (let qIndex = 0; qIndex < activity.questions.length; qIndex++) {
        const question = activity.questions[qIndex];
        
        for (let diffIndex = 0; diffIndex < question.difficulties.length; diffIndex++) {
          const difficulty = question.difficulties[diffIndex];
          const answers = difficulty?.answers || [];
          let answersArray = null;
          
          if (activityType === 'watchAndSpeak' || activityType === 'assessmentWatchAndSpeak') {
            answersArray = answers
              .map(answer => `"${answer.aText.replace(/"/g, '\\"')}"`)
              .join(",");
          }

          const existingQuestion = existingQuestions[questionCounter];

          if (existingQuestion) {
            // Update existing question
            await createSpeakActivityQuestionService1.updateSpeakActivityQuestionService(
              existingQuestion.id,
              question.qText,
              question.difficulties[0]?.qVideo || null,
              question.difficulties[0]?.qAudio || null,
              answersArray,
              lessonId,
              question.qNo || (qIndex + 1).toString(),
              activityType,
              difficulty?.difficulty || null,
              difficulty?.answers[0]?.cfText || null,
              difficulty?.answers[0]?.cfImage || null,
              difficulty?.answers[0]?.cfAudio || null
            );
          } else {
            // Create new question
            await createSpeakActivityQuestionService1.createSpeakActivityQuestionService(
              question.qText,
              question.difficulties[0]?.qVideo || null,
              question.difficulties[0]?.qAudio || null,
              answersArray,
              lessonId,
              question.qNo || (qIndex + 1).toString(),
              activityType,
              difficulty?.difficulty || null,
              difficulty?.answers[0]?.cfText || null,
              difficulty?.answers[0]?.cfImage || null,
              difficulty?.answers[0]?.cfAudio || null
            );
          }
          
          questionCounter++;
        }
      }

      // Delete excess questions if any
      await this.deleteExcessSpeakingQuestions(existingQuestions, expectedQuestionCount);

      return `success: true, activityType: ${activityType}, Alias: ${activity.alias}, LessonId: ${lessonId}`;
    } catch (error) {
      return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: ${error.message}`;
    }
  },

  // Process Conversational Bot activities with delete functionality
  processConversationalBotActivity: async function(activity, courseId, activityType, existingLessonId = null) {
    try {
      const response = await this.createBaseLesson(activity, courseId, activityType, existingLessonId);
      const lessonId = response.LessonId;

      let existingQuestions = [];
      if (existingLessonId) {
        existingQuestions = await createSpeakActivityQuestionService1.getSpeakActivityQuestionsByLessonIdService(existingLessonId);
      }

      for (let qIndex = 0; qIndex < activity.questions.length; qIndex++) {
        const question = activity.questions[qIndex];
        const existingQuestion = existingQuestions[qIndex];

        if (activityType === "conversationalQuestionsBot") {
          if (existingQuestion) {
            // Update existing question
            await createSpeakActivityQuestionService1.updateSpeakActivityQuestionService(
              existingQuestion.id,
              question.qText,
              null,
              null,
              null,
              lessonId,
              (qIndex + 1).toString(),
              activityType,
              question.difficulties[0]?.difficulty || null,
              null,
              null,
              null
            );
          } else {
            // Create new question
            await createSpeakActivityQuestionService1.createSpeakActivityQuestionService(
              question.qText,
              null,
              null,
              null,
              lessonId,
              (qIndex + 1).toString(),
              activityType,
              question.difficulties[0]?.difficulty || null,
              null,
              null,
              null
            );
          }
        } else if (activityType === "conversationalMonologueBot") {
          if (existingQuestion) {
            // Update existing question
            await createSpeakActivityQuestionService1.updateSpeakActivityQuestionService(
              existingQuestion.id,
              question.qText,
              question.difficulties[0]?.qVideo || null,
              null,
              null,
              lessonId,
              (qIndex + 1).toString(),
              activityType,
              question.difficulties[0]?.difficulty || null,
              null,
              null,
              null
            );
          } else {
            // Create new question
            await createSpeakActivityQuestionService1.createSpeakActivityQuestionService(
              question.qText,
              question.difficulties[0]?.qVideo || null,
              null,
              null,
              lessonId,
              (qIndex + 1).toString(),
              activityType,
              question.difficulties[0]?.difficulty || null,
              null,
              null,
              null
            );
          }
        } else if (activityType === "conversationalAgencyBot") {
          if (existingQuestion) {
            // Update existing question
            await createSpeakActivityQuestionService1.updateSpeakActivityQuestionService(
              existingQuestion.id,
              question.qText,
              null,
              null,
              null,
              lessonId,
              (qIndex + 1).toString(),
              activityType,
              question.difficulties[0]?.difficulty || null,
              null,
              null,
              null
            );
          } else {
            // Create new question
            await createSpeakActivityQuestionService1.createSpeakActivityQuestionService(
              question.qText,
              null,
              null,
              null,
              lessonId,
              (qIndex + 1).toString(),
              activityType,
              question.difficulties[0]?.difficulty || null,
              null,
              null,
              null
            );
          }
        }
      }

      // Delete excess questions if any
      await this.deleteExcessSpeakingQuestions(existingQuestions, activity.questions.length);

      return `success: true, activityType: ${activityType}, Alias: ${activity.alias}, LessonId: ${lessonId}`;
    } catch (error) {
      return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: ${error.message}`;
    }
  },

  // Process Speaking Practice activities with delete functionality
  processSpeakingPracticeActivity: async function(activity, courseId, activityType, existingLessonId = null) {
    try {
      const response = await this.createBaseLesson(activity, courseId, activityType, existingLessonId);
      const lessonId = response.LessonId;

      let existingQuestions = [];
      if (existingLessonId) {
        existingQuestions = await createSpeakActivityQuestionService1.getSpeakActivityQuestionsByLessonIdService(existingLessonId);
      }

      for (let qIndex = 0; qIndex < activity.questions.length; qIndex++) {
        const question = activity.questions[qIndex];
        const existingQuestion = existingQuestions[qIndex];

        if (existingQuestion) {
          // Update existing question
          await createSpeakActivityQuestionService1.updateSpeakActivityQuestionService(
            existingQuestion.id,
            question.qText,
            question.difficulties[0]?.qAudio || null,
            null,
            null,
            lessonId,
            question.qNo || (qIndex + 1).toString(),
            activityType,
            question.difficulties[0]?.difficulty || null,
            null,
            null,
            null
          );
        } else {
          // Create new question
          await createSpeakActivityQuestionService1.createSpeakActivityQuestionService(
            question.qText,
            question.difficulties[0]?.qAudio || null,
            null,
            null,
            lessonId,
            question.qNo || (qIndex + 1).toString(),
            activityType,
            question.difficulties[0]?.difficulty || null,
            null,
            null,
            null
          );
        }
      }

      // Delete excess questions if any
      await this.deleteExcessSpeakingQuestions(existingQuestions, activity.questions.length);

      return `success: true, activityType: ${activityType}, Alias: ${activity.alias}, LessonId: ${lessonId}`;
    } catch (error) {
      return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: ${error.message}`;
    }
  },

  activityTypeCase: async function (activityType){
    if(activityType == "assessmentwatchandspeak") {
        activityType = "assessmentWatchAndSpeak";
      }
      else if(activityType == "feedbackmcqs") {
        activityType = "feedbackMcqs";
      }
      else if(activityType == "assessmentmcqs") {
        activityType = "assessmentMcqs";
      }
      else if(activityType == "watchandspeak") {
        activityType = "watchAndSpeak";
      }
      else if(activityType == "conversationalquestionsbot") {
        activityType = "conversationalQuestionsBot";
      }
      else if(activityType == "conversationalmonologuebot") {
        activityType = "conversationalMonologueBot";
      }
      else if(activityType == "conversationalagencybot") {
        activityType = "conversationalAgencyBot";
      }
      else if(activityType == "speakingpractice") {
        activityType = "speakingPractice";
      }
      else if(activityType == "listenandspeak") {
        activityType = "listenAndSpeak";
      }
      else if(activityType == "feedbackaudio") {
        activityType = "feedbackAudio";
      }
      else if(activityType == "watchandaudio") {
        activityType = "watchAndAudio";
      }
      else if(activityType == "videoend" || activityType == "watchend") {
        activityType = "videoEnd";
      }
       else if(activityType == "video" || activityType == "watch") {
        activityType = "video";
      }
      else if(activityType == "watchandimage") {
        activityType = "watchAndImage";
      }
      return activityType;
  },
};

export default contentIngestionUtils;