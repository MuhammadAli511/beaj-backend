import { getSheetsObj, getAuthSheetClient, isCellHighlighted } from "../utils/sheetUtils.js";
import { toCamelCase } from "../utils/utils.js";
import { activity_types, columns_order } from "../constants/constants.js";
import ingestion from '../ingestion/index.js';
import lessonRepository from '../repositories/lessonRepository.js';


// Helper function to check if a row contains meaningful activity data
const hasActivityData = (get) => {
    return get(columns_order.WEEK_NO) ||
        get(columns_order.DAY_NO) ||
        get(columns_order.SEQ_NO) ||
        get(columns_order.ALIAS) ||
        get(columns_order.ACTIVITY_TYPE) ||
        get(columns_order.TEXT_INSTRUCTION) ||
        get(columns_order.AUDIO_INSTRUCTION) ||
        get(columns_order.COMPLETION_STICKER) ||
        get(columns_order.Q_NO) ||
        get(columns_order.Q_TEXT) ||
        get(columns_order.Q_VIDEO_LINK) ||
        get(columns_order.Q_AUDIO_LINK) ||
        get(columns_order.Q_IMAGE_LINK) ||
        get(columns_order.DIFFICULTY_LEVEL) ||
        get(columns_order.ANSWER) ||
        get(columns_order.CF_TEXT) ||
        get(columns_order.CF_IMAGE) ||
        get(columns_order.CF_AUDIO);
};


const extractStructuredActivityData = (rows, activityStartRow, activityEndRow) => {
    const questionsMap = new Map();
    let currentQuestion = null;
    let currentQuestionData = {};
    let answerCounters = {};

    for (let r = activityStartRow - 1; r < activityEndRow && r < rows.length; r++) {
        const row = rows[r];
        const cells = row.values || [];
        const get = (col) => cells[col]?.formattedValue?.trim() || "";

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


const validateIngestionService = async (courseId, sheetId, sheetTitle) => {
    try {
        let errors = [];
        const sheets = await getSheetsObj();
        const authSheetClient = await getAuthSheetClient();
        try {
            // Step 1: Get sheet data with formatting and validate (combined with tab validation)
            let res;
            try {
                res = await sheets.spreadsheets.get({
                    auth: authSheetClient,
                    spreadsheetId: sheetId,
                    ranges: [sheetTitle],
                    includeGridData: true,
                });
            } catch (error) {
                errors.push(`Cannot access Google Sheet: ${error.message}`)
                return { errors: errors }
            }

            const sheet = res.data.sheets?.[0]

            // Validate sheet tab exists
            if (!sheet) {
                errors.push(`Sheet tab "${sheetTitle}" not found in the spreadsheet`)
                return { errors: errors }
            }

            const rows = sheet.data?.[0]?.rowData ?? []

            if (rows.length === 0) {
                errors.push("Sheet is empty - no content found")
                return { errors: errors }
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
                    if (currentActivity) {
                        currentActivity.questions = extractStructuredActivityData(rows, currentActivity.startRow, currentActivity.endRow);
                        activities.push(currentActivity);
                    }

                    // Start new activity
                    currentActivity = {
                        startRow: rowNum,
                        endRow: rowNum,
                        courseId: courseId,
                        upload: get(columns_order.UPLOAD),
                        week: get(columns_order.WEEK_NO),
                        day: get(columns_order.DAY_NO),
                        seq: get(columns_order.SEQ_NO),
                        alias: get(columns_order.ALIAS),
                        activityType: get(columns_order.ACTIVITY_TYPE),
                        textInstruction: get(columns_order.TEXT_INSTRUCTION),
                        audioInstruction: get(columns_order.AUDIO_INSTRUCTION),
                        completionSticker: get(columns_order.COMPLETION_STICKER),
                        questions: []
                    };
                } else if (currentActivity) {
                    // Only extend activity range if this row has meaningful data
                    if (hasActivityData(get)) {
                        currentActivity.endRow = rowNum;
                    }

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

            // Add status to each activity (created, updated, or skipped)
            for (const activity of activities) {
                if (activity.upload?.toLowerCase() === "true") {
                    // Check if activity exists in database
                    const existingLesson = await lessonRepository.getLessonIdsByCourseWeekDaySeq(
                        activity.courseId,
                        parseInt(activity.week),
                        parseInt(activity.day),
                        parseInt(activity.seq)
                    );

                    if (existingLesson) {
                        activity.status = "UPDATE";
                    } else {
                        activity.status = "CREATE";
                    }
                } else {
                    activity.status = "SKIP";
                }
            }

            // Filter out activities with unticked checkboxes (upload === "FALSE") and group by type
            const tickedActivities = activities.filter(activity => activity.upload?.toLowerCase() === "true");
            const skippedActivities = activities.filter(activity => activity.upload?.toLowerCase() === "false");

            // Create validation calls for all activity types dynamically (only ticked activities)
            const activityTypeFilters = Object.fromEntries(
                activity_types.map(type => [
                    `${toCamelCase(type)}Activities`,
                    tickedActivities.filter(activity => activity.activityType?.toLowerCase() === type.toLowerCase())
                ])
            );

            // Call all validation functions concurrently using Promise.all
            const validationPromises = activity_types.map(type => {
                const functionName = `${toCamelCase(type)}Validation`;
                const activitiesKey = `${toCamelCase(type)}Activities`;
                return ingestion[functionName](activityTypeFilters[activitiesKey]);
            });

            const validationResults = await Promise.all(validationPromises);

            // Create validation results object with proper keys
            const allValidationResults = Object.fromEntries(
                activity_types.map((type, index) => [
                    `${toCamelCase(type)}Validation`,
                    validationResults[index] || null
                ])
            );

            // Filter out null values
            const filteredValidationResults = Object.fromEntries(
                Object.entries(allValidationResults).filter(([key, value]) => value !== null)
            );

            // Aggregate totals and individual counts from all validation results
            let totalToCreate = 0;
            let totalToUpdate = 0;
            let allValidationErrors = [];

            Object.entries(filteredValidationResults).forEach(([activityType, result]) => {
                if (result && typeof result === 'object') {
                    const createCount = result.toCreateCount || 0;
                    const updateCount = result.toUpdateCount || 0;

                    // Add to totals
                    totalToCreate += createCount;
                    totalToUpdate += updateCount;

                    if (result.errors && Array.isArray(result.errors)) {
                        allValidationErrors = allValidationErrors.concat(result.errors);
                    }
                }
            });

            // Add overall summary
            if (totalToCreate > 0 || totalToUpdate > 0) {
                const actions = [];
                if (totalToCreate > 0) actions.push(`${totalToCreate} new activities`);
                if (totalToUpdate > 0) actions.push(`${totalToUpdate} updates`);
            }

            // Call deletion validation service to check for orphaned activities
            const deletionValidation = await deleteActivitiesService(courseId, sheetId, sheetTitle, false, rows);

            // Merge deletion validation results
            if (deletionValidation.errors) {
                errors = errors.concat(deletionValidation.errors);
            }

            const finalResult = {
                errors: errors.concat(allValidationErrors),
                activities: activities,
                stats: {
                    totalActivities: activities.length,
                    activitiesToProcess: tickedActivities.length,
                    activitiesSkipped: skippedActivities.length,
                    toCreate: totalToCreate,
                    toUpdate: totalToUpdate,
                    toDelete: deletionValidation.deletionSummary?.totalToDelete || 0
                },
                validationResults: filteredValidationResults,
                deletionSummary: deletionValidation.deletionSummary || null
            };
            return finalResult;
        } catch (error) {
            console.error("Error during validation:", error)
            errors.push(`Validation failed: ${error.message}`)
            return { errors: errors }
        }
    } catch (error) {
        error.fileName = 'contentIngestionService.js';
        throw error;
    }
};


const processIngestionService = async (courseId, sheetId, sheetTitle) => {
    try {
        let errors = [];
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
            errors.push("Sheet is empty - no content to process");
            return { errors: errors };
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
                    endRow: rowNum,
                    courseId: courseId,
                    upload: get(columns_order.UPLOAD),
                    week: get(columns_order.WEEK_NO),
                    day: get(columns_order.DAY_NO),
                    seq: get(columns_order.SEQ_NO),
                    alias: get(columns_order.ALIAS),
                    activityType: get(columns_order.ACTIVITY_TYPE),
                    textInstruction: get(columns_order.TEXT_INSTRUCTION),
                    audioInstruction: get(columns_order.AUDIO_INSTRUCTION),
                    completionSticker: get(columns_order.COMPLETION_STICKER),
                    questions: []
                };
            } else if (currentActivity) {
                // Only extend activity range if this row has meaningful data
                if (hasActivityData(get)) {
                    currentActivity.endRow = rowNum;
                }

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

        // Add status to each activity (CREATE, UPDATE, or SKIP)
        for (const activity of activities) {
            if (activity.upload?.toLowerCase() === "true") {
                // Check if activity exists in database
                const existingLesson = await lessonRepository.getLessonIdsByCourseWeekDaySeq(
                    activity.courseId,
                    parseInt(activity.week),
                    parseInt(activity.day),
                    parseInt(activity.seq)
                );

                if (existingLesson) {
                    activity.status = "UPDATE";
                } else {
                    activity.status = "CREATE";
                }
            } else {
                activity.status = "SKIP";
            }
        }

        // Filter out activities with unticked checkboxes (upload === "FALSE") and group by type
        const tickedActivities = activities.filter(activity => activity.upload?.toLowerCase() === "true");
        const skippedActivities = activities.filter(activity => activity.upload?.toLowerCase() === "false");


        // Filter activities by type for ingestion dynamically (only ticked activities)
        const activityTypeFilters = Object.fromEntries(
            activity_types.map(type => [
                `${toCamelCase(type)}Activities`,
                tickedActivities.filter(activity => activity.activityType?.toLowerCase() === type.toLowerCase())
            ])
        );

        // Call all ingestion functions concurrently using Promise.all
        const ingestionPromises = activity_types.map(type => {
            const functionName = `${toCamelCase(type)}Ingestion`;
            const activitiesKey = `${toCamelCase(type)}Activities`;
            return ingestion[functionName](activityTypeFilters[activitiesKey], courseId);
        });

        const ingestionResults = await Promise.all(ingestionPromises);

        // Create ingestion results object with proper keys
        const allIngestionResults = Object.fromEntries(
            activity_types.map((type, index) => [
                `${toCamelCase(type)}Results`,
                ingestionResults[index] || null
            ])
        );

        // Filter out null values
        const filteredIngestionResults = Object.fromEntries(
            Object.entries(allIngestionResults).filter(([key, value]) => value !== null)
        );

        // Aggregate totals and individual counts from all ingestion results
        let totalCreated = 0;
        let totalUpdated = 0;
        let allIngestionErrors = [];

        Object.entries(filteredIngestionResults).forEach(([activityType, result]) => {
            if (result && typeof result === 'object') {
                const createdCount = result.createdCount || 0;
                const updatedCount = result.updatedCount || 0;

                // Add to totals
                totalCreated += createdCount;
                totalUpdated += updatedCount;

                if (result.errors && Array.isArray(result.errors)) {
                    allIngestionErrors = allIngestionErrors.concat(result.errors);
                }
            }
        });

        // Add overall processing summary
        if (totalCreated > 0 || totalUpdated > 0) {
            const actions = [];
            if (totalCreated > 0) actions.push(`${totalCreated} activities created`);
            if (totalUpdated > 0) actions.push(`${totalUpdated} activities updated`);
        }

        // Call deletion processing service to remove orphaned activities
        const deletionProcessing = await deleteActivitiesService(courseId, sheetId, sheetTitle, true, rows);

        // Merge deletion processing results
        if (deletionProcessing.errors) {
            errors = errors.concat(deletionProcessing.errors);
        }

        return {
            errors: errors.concat(allIngestionErrors),
            stats: {
                totalCreated: totalCreated,
                totalUpdated: totalUpdated,
                totalDeleted: deletionProcessing.deletionSummary?.totalDeleted || 0,
                totalProcessed: totalCreated + totalUpdated + (deletionProcessing.deletionSummary?.totalDeleted || 0)
            },
            ingestionResults: filteredIngestionResults,
            deletionSummary: deletionProcessing.deletionSummary || null
        };
    } catch (error) {
        error.fileName = 'contentIngestionService.js';
        throw error;
    }
};


const deleteActivitiesService = async (courseId, sheetId, sheetTitle, processDelete = false, providedRows = null) => {
    try {
        let errors = [];
        let rows;

        // Step 1: Get all existing lessons from DB for this course
        const existingLessons = await lessonRepository.getByCourse(courseId);

        if (!existingLessons || existingLessons.length === 0) {
            return {
                errors: errors,
                deletionSummary: {
                    totalToDelete: 0,
                    totalDeleted: 0,
                    lessonsToDelete: []
                }
            };
        }

        // Step 2: Get sheet data to see what activities currently exist in the sheet
        if (providedRows) {
            // Use already-retrieved data to avoid duplicate API call
            rows = providedRows;
        } else {
            // Fallback: make API call if data not provided
            try {
                const sheets = await getSheetsObj();
                const authSheetClient = await getAuthSheetClient();

                const res = await sheets.spreadsheets.get({
                    auth: authSheetClient,
                    spreadsheetId: sheetId,
                    ranges: [sheetTitle],
                    includeGridData: true,
                });

                const sheet = res.data.sheets?.[0];
                rows = sheet.data?.[0]?.rowData ?? [];
            } catch (sheetError) {
                errors.push(`Cannot access Google Sheet: ${sheetError.message}`);
                return { errors: errors };
            }
        }

        if (rows.length === 0) {
            errors.push("Sheet is empty - cannot check for orphaned activities");
            return { errors: errors };
        }

        // Step 3: Extract all activities from sheet (both ticked and unticked)
        const sheetActivities = [];
        let currentActivity = null;

        for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            const cells = row.values || [];
            const get = (col) => cells[col]?.formattedValue?.trim() || "";
            const rowNum = r + 1;

            // Check if this row starts a new activity (has UPLOAD checkbox)
            if (get(columns_order.UPLOAD)) {
                if (currentActivity) {
                    sheetActivities.push(currentActivity);
                }

                // Start new activity
                currentActivity = {
                    week: parseInt(get(columns_order.WEEK_NO)) || null,
                    day: parseInt(get(columns_order.DAY_NO)) || null,
                    seq: parseInt(get(columns_order.SEQ_NO)) || null,
                    activityType: get(columns_order.ACTIVITY_TYPE) || null,
                    alias: get(columns_order.ALIAS) || null
                };
            } else if (currentActivity) {
                // Update activity info if empty and found in current row
                if (!currentActivity.week && get(columns_order.WEEK_NO)) {
                    currentActivity.week = parseInt(get(columns_order.WEEK_NO));
                }
                if (!currentActivity.day && get(columns_order.DAY_NO)) {
                    currentActivity.day = parseInt(get(columns_order.DAY_NO));
                }
                if (!currentActivity.seq && get(columns_order.SEQ_NO)) {
                    currentActivity.seq = parseInt(get(columns_order.SEQ_NO));
                }
                if (!currentActivity.activityType && get(columns_order.ACTIVITY_TYPE)) {
                    currentActivity.activityType = get(columns_order.ACTIVITY_TYPE);
                }
            }
        }

        // Don't forget the last activity
        if (currentActivity) {
            sheetActivities.push(currentActivity);
        }

        // Step 4: Find lessons in DB that don't exist in sheet
        const lessonsToDelete = [];

        for (const dbLesson of existingLessons) {
            const matchFound = sheetActivities.some(sheetActivity =>
                sheetActivity.week === dbLesson.weekNumber &&
                sheetActivity.day === dbLesson.dayNumber &&
                sheetActivity.seq === dbLesson.SequenceNumber &&
                sheetActivity.activityType?.toLowerCase() === dbLesson.activity?.toLowerCase()
            );

            if (!matchFound) {
                lessonsToDelete.push({
                    lessonId: dbLesson.LessonId,
                    week: dbLesson.weekNumber,
                    day: dbLesson.dayNumber,
                    seq: dbLesson.SequenceNumber,
                    activityType: dbLesson.activity,
                    alias: dbLesson.activityAlias,
                    lessonType: dbLesson.lessonType
                });
            }
        }

        // Step 5: Process results based on mode
        if (processDelete) {
            // Actually delete the lessons
            let deletedCount = 0;
            for (const lessonToDelete of lessonsToDelete) {
                try {
                    await lessonRepository.deleteLesson(lessonToDelete.lessonId);
                    deletedCount++;
                } catch (deleteError) {
                    errors.push(`Failed to delete activity: ${lessonToDelete.alias} (${deleteError.message})`);
                }
            }

            return {
                errors: errors,
                deletionSummary: {
                    totalToDelete: lessonsToDelete.length,
                    totalDeleted: deletedCount,
                    lessonsToDelete: lessonsToDelete
                }
            };
        } else {
            return {
                errors: errors,
                deletionSummary: {
                    totalToDelete: lessonsToDelete.length,
                    totalDeleted: 0,
                    lessonsToDelete: lessonsToDelete
                }
            };
        }

    } catch (error) {
        error.fileName = 'contentIngestionService.js';
        throw error;
    }
};


export default {
    validateIngestionService,
    processIngestionService,
    deleteActivitiesService
};