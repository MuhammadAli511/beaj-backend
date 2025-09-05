import { getSheetsObj, getAuthSheetClient } from "../utils/sheetUtils.js";
import { isCellHighlighted } from "../utils/sheetUtils.js";
import { columns_order } from "../constants/constants.js";

// Helper function to extract and structure activity data properly
const extractStructuredActivityData = (rows, activityStartRow, activityEndRow) => {
    const questionsMap = new Map();
    let currentQuestion = null;
    let currentQuestionData = {};
    let answerCounters = {};

    for (let r = activityStartRow - 1; r < activityEndRow && r < rows.length; r++) {
        const row = rows[r];
        const cells = row.values || [];
        const get = (col) => cells[col]?.formattedValue?.trim() || "";
        const rowNum = r + 1;

        // Check if this row starts a new question (has Q No)
        const questionNumber = get(columns_order.Q_NO);
        if (questionNumber) {
            currentQuestion = questionNumber;

            if (!questionsMap.has(questionNumber)) {
                questionsMap.set(questionNumber, {
                    questionNumber: parseInt(questionNumber),
                    questionText: "",
                    questionVideo: "",
                    questionAudio: "",
                    questionImage: "",
                    difficultiesMap: new Map()
                });
            }

            currentQuestionData = questionsMap.get(questionNumber);

            // Update question-level data
            if (get(columns_order.Q_TEXT)) {
                currentQuestionData.questionText = get(columns_order.Q_TEXT);
            }
            if (get(columns_order.Q_VIDEO_LINK)) {
                currentQuestionData.questionVideo = get(columns_order.Q_VIDEO_LINK);
            }
            if (get(columns_order.Q_AUDIO_LINK)) {
                currentQuestionData.questionAudio = get(columns_order.Q_AUDIO_LINK);
            }
            if (get(columns_order.Q_IMAGE_LINK)) {
                currentQuestionData.questionImage = get(columns_order.Q_IMAGE_LINK);
            }
        }

        // Handle difficulty level and answers
        const difficultyLevel = get(columns_order.DIFFICULTY_LEVEL);
        const questionText = get(columns_order.Q_TEXT);
        const questionVideo = get(columns_order.Q_VIDEO_LINK);
        const questionAudio = get(columns_order.Q_AUDIO_LINK);
        const questionImage = get(columns_order.Q_IMAGE_LINK);
        const answerText = get(columns_order.ANSWER);
        const cfText = get(columns_order.CF_TEXT);
        const cfImage = get(columns_order.CF_IMAGE);
        const cfAudio = get(columns_order.CF_AUDIO);

        // Handle activities without questions (single row activities)
        if (!currentQuestion && (questionVideo || questionAudio || questionImage || answerText || cfText || cfImage || cfAudio)) {
            // Create a default question for activities without Q No
            currentQuestion = "1";
            if (!questionsMap.has(currentQuestion)) {
                questionsMap.set(currentQuestion, {
                    questionNumber: 1,
                    questionText: "",
                    questionVideo: "",
                    questionAudio: "",
                    questionImage: "",
                    difficultiesMap: new Map()
                });
            }
            currentQuestionData = questionsMap.get(currentQuestion);
        }

        // If we have question data or answer data, process it
        if (currentQuestion && currentQuestionData && (difficultyLevel || questionText || questionVideo || questionAudio || questionImage || answerText || cfText || cfImage || cfAudio)) {
            const diffKey = difficultyLevel.toLowerCase() || "default";
            const counterKey = `${currentQuestion}_${diffKey}`;

            if (!currentQuestionData.difficultiesMap.has(diffKey)) {
                currentQuestionData.difficultiesMap.set(diffKey, {
                    difficultyLevel: difficultyLevel.toLowerCase() || "",
                    questionText: "",
                    questionVideo: "",
                    questionAudio: "",
                    questionImage: "",
                    answers: []
                });
                // Initialize answer counter for this question-difficulty combination
                answerCounters[counterKey] = 1;
            }

            const difficultyData = currentQuestionData.difficultiesMap.get(diffKey);

            // Update difficulty-specific question data
            if (questionText && !difficultyData.questionText) {
                difficultyData.questionText = questionText;
            }
            if (questionVideo && !difficultyData.questionVideo) {
                difficultyData.questionVideo = questionVideo;
            }
            if (questionAudio && !difficultyData.questionAudio) {
                difficultyData.questionAudio = questionAudio;
            }
            if (questionImage && !difficultyData.questionImage) {
                difficultyData.questionImage = questionImage;
            }

            // Update question-level data (fallback for merged cells)
            if (questionText && !currentQuestionData.questionText) {
                currentQuestionData.questionText = questionText;
            }
            if (questionVideo && !currentQuestionData.questionVideo) {
                currentQuestionData.questionVideo = questionVideo;
            }
            if (questionAudio && !currentQuestionData.questionAudio) {
                currentQuestionData.questionAudio = questionAudio;
            }
            if (questionImage && !currentQuestionData.questionImage) {
                currentQuestionData.questionImage = questionImage;
            }

            // If we have answer data, add it
            if (answerText || cfText || cfImage || cfAudio) {
                // Check if the answer cell is highlighted (correct answer)
                const answerCell = cells[columns_order.ANSWER];
                const bg = answerCell?.effectiveFormat?.backgroundColor;
                const isCorrect = isCellHighlighted(bg);

                difficultyData.answers.push({
                    answerNumber: answerCounters[counterKey]++,
                    answerText: answerText,
                    correct: isCorrect,
                    customFeedbackText: cfText,
                    customFeedbackImage: cfImage,
                    customFeedbackAudio: cfAudio
                });
            }
        }
    }

    // Convert maps to arrays and structure the final output
    const questions = [];
    for (const [questionNumber, questionData] of questionsMap) {
        if (questionData.difficultiesMap.size === 0) {
            // No difficulty levels, just create a basic question
            questions.push({
                questionNumber: questionData.questionNumber,
                difficultyLevel: "",
                questionText: questionData.questionText,
                questionVideo: questionData.questionVideo,
                questionAudio: questionData.questionAudio,
                questionImage: questionData.questionImage,
                answers: []
            });
        } else {
            // Process each difficulty level
            for (const [diffKey, diffData] of questionData.difficultiesMap) {
                questions.push({
                    questionNumber: questionData.questionNumber,
                    difficultyLevel: diffData.difficultyLevel,
                    // Use difficulty-specific question text if available, otherwise fallback to general
                    questionText: diffData.questionText || questionData.questionText,
                    questionVideo: diffData.questionVideo || questionData.questionVideo,
                    questionAudio: diffData.questionAudio || questionData.questionAudio,
                    questionImage: diffData.questionImage || questionData.questionImage,
                    answers: diffData.answers
                });
            }
        }
    }

    // Sort questions by question number and difficulty level
    questions.sort((a, b) => {
        if (a.questionNumber !== b.questionNumber) {
            return a.questionNumber - b.questionNumber;
        }
        const diffOrder = { 'easy': 1, 'medium': 2, 'hard': 3, '': 4 };
        return (diffOrder[a.difficultyLevel] || 4) - (diffOrder[b.difficultyLevel] || 4);
    });

    return questions;
};


const validateIngestionService = async (sheetId, sheetTitle) => {
    try {
        let valid = [], errors = [], warnings = [];
        const sheets = await getSheetsObj();
        const authSheetClient = await getAuthSheetClient();
        try {
            // Step 1: Check if sheet is accessible and tab exists
            try {
                const sheetInfo = await sheets.spreadsheets.get({
                    auth: authSheetClient,
                    spreadsheetId: sheetId,
                });

                const sheetTab = sheetInfo.data.sheets?.find((sheet) => sheet.properties.title === sheetTitle)

                if (!sheetTab) {
                    errors.push(`success: false, Sheet tab "${sheetTitle}" not found in spreadsheet.`)
                    return { valid: valid, errors: errors, warnings: warnings }
                }

            } catch (error) {
                errors.push(`success: false, Cannot access Google Sheet: ${error.message}`)
                return { valid: valid, errors: errors, warnings: warnings }
            }
            valid.push(`success: true, Google Sheet is accessible`)
            valid.push(`success: true, Sheet tab "${sheetTitle}" found in spreadsheet`)


            // Step 2: Get sheet data with formatting and validate
            const res = await sheets.spreadsheets.get({
                auth: authSheetClient,
                spreadsheetId: sheetId,
                ranges: [sheetTitle],
                includeGridData: true,
            })

            const sheet = res.data.sheets?.[0]
            const rows = sheet.data?.[0]?.rowData ?? []

            if (rows.length === 0) {
                errors.push("success: false, Sheet is empty")
                return { valid: valid, errors: errors, warnings: warnings }
            }


            // Extract and group activities by UPLOAD checkboxes
            const activities = [];
            let currentActivity = null;

            for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                const cells = row.values || [];
                const get = (col) => cells[col]?.formattedValue?.trim() || "";
                const rowNum = r + 1;

                // Check if this row starts a new activity (has UPLOAD checkbox)
                if (get(columns_order.UPLOAD)) {
                    // Save previous activity if exists
                    if (currentActivity) {
                        // Extract structured data for the completed activity
                        currentActivity.questions = extractStructuredActivityData(rows, currentActivity.startRow, currentActivity.endRow);
                        activities.push(currentActivity);
                    }

                    // Start new activity
                    currentActivity = {
                        startRow: rowNum,
                        endRow: rowNum, // Will be updated as we add more rows
                        upload: get(columns_order.UPLOAD),
                        week: get(columns_order.WEEK_NO),
                        day: get(columns_order.DAY_NO),
                        seq: get(columns_order.SEQ_NO),
                        alias: get(columns_order.ALIAS),
                        activityType: get(columns_order.ACTIVITY_TYPE),
                        textInstruction: get(columns_order.TEXT_INSTRUCTION),
                        audioInstruction: get(columns_order.AUDIO_INSTRUCTION),
                        completionSticker: get(columns_order.COMPLETION_STICKER),
                        questions: [] // Will be populated when activity is complete
                    };
                } else if (currentActivity) {
                    // This row belongs to the current activity
                    currentActivity.endRow = rowNum;

                    // Update activity info if empty and found in current row
                    if (!currentActivity.week && get(columns_order.WEEK_NO)) {
                        currentActivity.week = get(columns_order.WEEK_NO);
                    }
                    if (!currentActivity.day && get(columns_order.DAY_NO)) {
                        currentActivity.day = get(columns_order.DAY_NO);
                    }
                }
            }

            // Don't forget the last activity
            if (currentActivity) {
                // Extract structured data for the last activity
                currentActivity.questions = extractStructuredActivityData(rows, currentActivity.startRow, currentActivity.endRow);
                activities.push(currentActivity);
            }

            // Add activity grouping information to valid messages
            valid.push(`success: true, Activities Count: ${activities.length}`);

            activities.forEach((activity, index) => {
                const rowRange = activity.startRow === activity.endRow
                    ? `Row ${activity.startRow}`
                    : `Rows ${activity.startRow}-${activity.endRow}`;
                valid.push(`success: true, Activity ${index + 1}: ${activity.alias || 'No Alias'} (${activity.activityType || 'No Type'}) - ${rowRange} - ${activity.questions.length} questions`);
            });

            valid.push(`success: true, All activities successfully extracted and grouped!`);

            // Create validation calls for all activity types
            const videoActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'video');
            const videoEndActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'videoend');
            const mcqsActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'mcqs');
            const feedbackAudioActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'feedbackaudio');
            const listenAndSpeakActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'listenandspeak');
            const watchAndSpeakActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'watchandspeak');
            const watchAndAudioActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'watchandaudio');
            const assessmentWatchAndSpeakActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'assessmentwatchandspeak');
            const assessmentMcqsActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'assessmentmcqs');
            const feedbackMcqsActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'feedbackmcqs');
            const speakingPracticeActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'speakingpractice');
            const conversationalQuestionsBotActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'conversationalquestionsbot');
            const readActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'read');
            const watchAndImageActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'watchandimage');
            const conversationalMonologueBotActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'conversationalmonologuebot');
            const conversationalAgencyBotActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'conversationalagencybot');
            const watchActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'watch');
            const watchEndActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'watchend');

            // Call all validation functions concurrently using Promise.all
            const [
                videoErrors,
                videoEndErrors,
                mcqsErrors,
                feedbackAudioErrors,
                listenAndSpeakErrors,
                watchAndSpeakErrors,
                watchAndAudioErrors,
                assessmentWatchAndSpeakErrors,
                assessmentMcqsErrors,
                feedbackMcqsErrors,
                speakingPracticeErrors,
                conversationalQuestionsBotErrors,
                readErrors,
                watchAndImageErrors,
                conversationalMonologueBotErrors,
                conversationalAgencyBotErrors,
                watchErrors,
                watchEndErrors
            ] = await Promise.all([
                ingestion.videoValidation(videoActivities),
                ingestion.videoEndValidation(videoEndActivities),
                ingestion.mcqsValidation(mcqsActivities),
                ingestion.feedbackAudioValidation(feedbackAudioActivities),
                ingestion.listenAndSpeakValidation(listenAndSpeakActivities),
                ingestion.watchAndSpeakValidation(watchAndSpeakActivities),
                ingestion.watchAndAudioValidation(watchAndAudioActivities),
                ingestion.assessmentWatchAndSpeakValidation(assessmentWatchAndSpeakActivities),
                ingestion.assessmentMcqsValidation(assessmentMcqsActivities),
                ingestion.feedbackMcqsValidation(feedbackMcqsActivities),
                ingestion.speakingPracticeValidation(speakingPracticeActivities),
                ingestion.conversationalQuestionsBotValidation(conversationalQuestionsBotActivities),
                ingestion.readValidation(readActivities),
                ingestion.watchAndImageValidation(watchAndImageActivities),
                ingestion.conversationalMonologueBotValidation(conversationalMonologueBotActivities),
                ingestion.conversationalAgencyBotValidation(conversationalAgencyBotActivities),
                ingestion.watchValidation(watchActivities),
                ingestion.watchEndValidation(watchEndActivities)
            ]);

            // Collect all non-null validation errors
            const allValidationErrors = {
                videoErrors: videoErrors || null,
                videoEndErrors: videoEndErrors || null,
                mcqsErrors: mcqsErrors || null,
                feedbackAudioErrors: feedbackAudioErrors || null,
                listenAndSpeakErrors: listenAndSpeakErrors || null,
                watchAndSpeakErrors: watchAndSpeakErrors || null,
                watchAndAudioErrors: watchAndAudioErrors || null,
                assessmentWatchAndSpeakErrors: assessmentWatchAndSpeakErrors || null,
                assessmentMcqsErrors: assessmentMcqsErrors || null,
                feedbackMcqsErrors: feedbackMcqsErrors || null,
                speakingPracticeErrors: speakingPracticeErrors || null,
                conversationalQuestionsBotErrors: conversationalQuestionsBotErrors || null,
                readErrors: readErrors || null,
                watchAndImageErrors: watchAndImageErrors || null,
                conversationalMonologueBotErrors: conversationalMonologueBotErrors || null,
                conversationalAgencyBotErrors: conversationalAgencyBotErrors || null,
                watchErrors: watchErrors || null,
                watchEndErrors: watchEndErrors || null
            };

            // Filter out null values
            const validationErrors = Object.fromEntries(
                Object.entries(allValidationErrors).filter(([key, value]) => value !== null)
            );


            return {
                valid: valid,
                errors: errors,
                warnings: warnings,
                activities: activities, // Include the grouped activities in the response
                validationErrors: validationErrors // Include all non-null validation errors
            }
        } catch (error) {
            console.error("Error during validation:", error)
            errors.push(`success: false, Validation failed: ${error.message}`)
            return { valid: valid, errors: errors, warnings: warnings }
        }
    } catch (error) {
        error.fileName = 'contentIngestionService.js';
        throw error;
    }
};


const processIngestionService = async (courseId, sheetId, sheetTitle) => {
    try {
        let valid = [], errors = [], warnings = [];
        const sheets = await getSheetsObj();
        const authSheetClient = await getAuthSheetClient();

        // Get sheet data with formatting
        const res = await sheets.spreadsheets.get({
            auth: authSheetClient,
            spreadsheetId: sheetId,
            ranges: [sheetTitle],
            includeGridData: true,
        });

        const sheet = res.data.sheets?.[0];
        const rows = sheet.data?.[0]?.rowData ?? [];

        if (rows.length === 0) {
            errors.push("success: false, Sheet is empty");
            return { valid: valid, errors: errors, warnings: warnings };
        }

        // Extract and group activities by UPLOAD checkboxes (same logic as validation)
        const activities = [];
        let currentActivity = null;

        for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            const cells = row.values || [];
            const get = (col) => cells[col]?.formattedValue?.trim() || "";
            const rowNum = r + 1;

            // Check if this row starts a new activity (has UPLOAD checkbox)
            if (get(columns_order.UPLOAD)) {
                // Save previous activity if exists
                if (currentActivity) {
                    // Extract structured data for the completed activity
                    currentActivity.questions = extractStructuredActivityData(rows, currentActivity.startRow, currentActivity.endRow);
                    activities.push(currentActivity);
                }

                // Start new activity
                currentActivity = {
                    startRow: rowNum,
                    endRow: rowNum, // Will be updated as we add more rows
                    upload: get(columns_order.UPLOAD),
                    week: get(columns_order.WEEK_NO),
                    day: get(columns_order.DAY_NO),
                    seq: get(columns_order.SEQ_NO),
                    alias: get(columns_order.ALIAS),
                    activityType: get(columns_order.ACTIVITY_TYPE),
                    textInstruction: get(columns_order.TEXT_INSTRUCTION),
                    audioInstruction: get(columns_order.AUDIO_INSTRUCTION),
                    completionSticker: get(columns_order.COMPLETION_STICKER),
                    questions: [] // Will be populated when activity is complete
                };
            } else if (currentActivity) {
                // This row belongs to the current activity
                currentActivity.endRow = rowNum;

                // Update activity info if empty and found in current row
                if (!currentActivity.week && get(columns_order.WEEK_NO)) {
                    currentActivity.week = get(columns_order.WEEK_NO);
                }
                if (!currentActivity.day && get(columns_order.DAY_NO)) {
                    currentActivity.day = get(columns_order.DAY_NO);
                }
            }
        }

        // Don't forget the last activity
        if (currentActivity) {
            // Extract structured data for the last activity
            currentActivity.questions = extractStructuredActivityData(rows, currentActivity.startRow, currentActivity.endRow);
            activities.push(currentActivity);
        }

        // Filter activities by type for ingestion
        const videoActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'video');
        const videoEndActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'videoend');
        const mcqsActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'mcqs');
        const feedbackAudioActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'feedbackaudio');
        const listenAndSpeakActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'listenandspeak');
        const watchAndSpeakActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'watchandspeak');
        const watchAndAudioActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'watchandaudio');
        const assessmentWatchAndSpeakActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'assessmentwatchandspeak');
        const assessmentMcqsActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'assessmentmcqs');
        const feedbackMcqsActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'feedbackmcqs');
        const speakingPracticeActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'speakingpractice');
        const conversationalQuestionsBotActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'conversationalquestionsbot');
        const readActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'read');
        const watchAndImageActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'watchandimage');
        const conversationalMonologueBotActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'conversationalmonologuebot');
        const conversationalAgencyBotActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'conversationalagencybot');
        const watchActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'watch');
        const watchEndActivities = activities.filter(activity => activity.activityType?.toLowerCase() === 'watchend');

        // Call all ingestion functions concurrently using Promise.all
        const [
            videoResults,
            videoEndResults,
            mcqsResults,
            feedbackAudioResults,
            listenAndSpeakResults,
            watchAndSpeakResults,
            watchAndAudioResults,
            assessmentWatchAndSpeakResults,
            assessmentMcqsResults,
            feedbackMcqsResults,
            speakingPracticeResults,
            conversationalQuestionsBotResults,
            readResults,
            watchAndImageResults,
            conversationalMonologueBotResults,
            conversationalAgencyBotResults,
            watchResults,
            watchEndResults
        ] = await Promise.all([
            ingestion.videoIngestion(videoActivities, courseId),
            ingestion.videoEndIngestion(videoEndActivities, courseId),
            ingestion.mcqsIngestion(mcqsActivities, courseId),
            ingestion.feedbackAudioIngestion(feedbackAudioActivities, courseId),
            ingestion.listenAndSpeakIngestion(listenAndSpeakActivities, courseId),
            ingestion.watchAndSpeakIngestion(watchAndSpeakActivities, courseId),
            ingestion.watchAndAudioIngestion(watchAndAudioActivities, courseId),
            ingestion.assessmentWatchAndSpeakIngestion(assessmentWatchAndSpeakActivities, courseId),
            ingestion.assessmentMcqsIngestion(assessmentMcqsActivities, courseId),
            ingestion.feedbackMcqsIngestion(feedbackMcqsActivities, courseId),
            ingestion.speakingPracticeIngestion(speakingPracticeActivities, courseId),
            ingestion.conversationalQuestionsBotIngestion(conversationalQuestionsBotActivities, courseId),
            ingestion.readIngestion(readActivities, courseId),
            ingestion.watchAndImageIngestion(watchAndImageActivities, courseId),
            ingestion.conversationalMonologueBotIngestion(conversationalMonologueBotActivities, courseId),
            ingestion.conversationalAgencyBotIngestion(conversationalAgencyBotActivities, courseId),
            ingestion.watchIngestion(watchActivities, courseId),
            ingestion.watchEndIngestion(watchEndActivities, courseId)
        ]);

        // Collect all non-null ingestion results
        const allIngestionResults = {
            videoResults: videoResults || null,
            videoEndResults: videoEndResults || null,
            mcqsResults: mcqsResults || null,
            feedbackAudioResults: feedbackAudioResults || null,
            listenAndSpeakResults: listenAndSpeakResults || null,
            watchAndSpeakResults: watchAndSpeakResults || null,
            watchAndAudioResults: watchAndAudioResults || null,
            assessmentWatchAndSpeakResults: assessmentWatchAndSpeakResults || null,
            assessmentMcqsResults: assessmentMcqsResults || null,
            feedbackMcqsResults: feedbackMcqsResults || null,
            speakingPracticeResults: speakingPracticeResults || null,
            conversationalQuestionsBotResults: conversationalQuestionsBotResults || null,
            readResults: readResults || null,
            watchAndImageResults: watchAndImageResults || null,
            conversationalMonologueBotResults: conversationalMonologueBotResults || null,
            conversationalAgencyBotResults: conversationalAgencyBotResults || null,
            watchResults: watchResults || null,
            watchEndResults: watchEndResults || null
        };

        // Filter out null values
        const ingestionResults = Object.fromEntries(
            Object.entries(allIngestionResults).filter(([key, value]) => value !== null)
        );

        return {
            valid: valid,
            errors: errors,
            warnings: warnings,
            ingestionResults: ingestionResults // Include all non-null ingestion results
        };
    } catch (error) {
        error.fileName = 'contentIngestionService.js';
        throw error;
    }
};


export default {
    validateIngestionService,
    processIngestionService,
};