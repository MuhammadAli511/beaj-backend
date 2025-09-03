import { getDriveMediaUrl } from "../google_sheet_utils/masterSheetUtils.js";
import createLessonService1 from "../services/lessonService.js";
import createMultipleChoiceQuestionService1 from "../services/multipleChoiceQuestionService.js";
import createMultipleChoiceQuestionAnswerService1 from "../services/multipleChoiceQuestionAnswerService.js";
import createSpeakActivityQuestionService1 from "../services/speakActivityQuestionService.js";
import uploadDocumentFileService1 from "../services/documentFilesService.js";


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

  // Process MCQ activities
  processMCQActivity: async function(activity, courseId, activityType, existingLessonId = null) {
    try {
      const response = await this.createBaseLesson(activity, courseId, activityType, existingLessonId);
      const lessonId = response.LessonId;

      let existingQuestions = [];
      if (existingLessonId) {
        // Get existing questions
        existingQuestions = await createMultipleChoiceQuestionService1.getMultipleChoiceQuestionsByLessonIdService(existingLessonId);
      }

      for (const question of activity.questions || []) {
        const qText = question.qText || "";
        const qType = "Text+Video";
        const qNo = question.qNo;
        const optionType = "Text";

        for (let diffIndex = 0; diffIndex < question.difficulties.length; diffIndex++) {
          const diff = question.difficulties[diffIndex];
          
          // Find existing question to update or create new one
          const questionIndex = (parseInt(qNo) - 1) * question.difficulties.length + diffIndex;
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
        }
      }
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
          const videoResponse = await uploadDocumentFileService1.updateDocumentFilesService(
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
          const videoResponse = await uploadDocumentFileService1.updateDocumentFilesService(
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

  // Process Listen and Speak activities
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

      return `success: true, activityType: ${activityType}, Alias: ${activity.alias}, LessonId: ${lessonId}`;
    } catch (error) {
      return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: ${error.message}`;
    }
  },

  // Process Watch and Speak activities
  processWatchAndSpeakActivity: async function(activity, courseId, activityType, existingLessonId = null) {
    try {
      const response = await this.createBaseLesson(activity, courseId, activityType, existingLessonId);
      const lessonId = response.LessonId;

      let existingQuestions = [];
      if (existingLessonId) {
        existingQuestions = await createSpeakActivityQuestionService1.getSpeakActivityQuestionsByLessonIdService(existingLessonId);
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

      return `success: true, activityType: ${activityType}, Alias: ${activity.alias}, LessonId: ${lessonId}`;
    } catch (error) {
      return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: ${error.message}`;
    }
  },

  // Process Conversational Bot activities
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

      return `success: true, activityType: ${activityType}, Alias: ${activity.alias}, LessonId: ${lessonId}`;
    } catch (error) {
      return `success: false, activityType: ${activityType}, Alias: ${activity.alias}, error: ${error.message}`;
    }
  },

  // Process Speaking Practice activities
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