import { getSheetsObj, getAuthSheetClient, isCellHighlighted } from "../utils/sheetUtils.js";
import { toCamelCase } from "../utils/utils.js";
import { activity_types, columns_order } from "../constants/constants.js";
import ingestion from '../ingestion/index.js';


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
                    if (currentActivity) {
                        currentActivity.questions = extractStructuredActivityData(rows, currentActivity.startRow, currentActivity.endRow);
                        activities.push(currentActivity);
                    }

                    // Start new activity
                    currentActivity = {
                        startRow: rowNum,
                        endRow: rowNum,
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

            // Filter out activities with ticked checkboxes (upload === "TRUE") and group by type
            const untickedActivities = activities.filter(activity => activity.upload?.toLowerCase() === "false");
            const skippedActivities = activities.filter(activity => activity.upload?.toLowerCase() === "true");

            // Add activity grouping information to valid messages
            valid.push(`success: true, Total Activities Count: ${activities.length}`);
            valid.push(`success: true, Activities to Process (unticked): ${untickedActivities.length}`);

            if (skippedActivities.length > 0) {
                valid.push(`success: true, Skipped ${skippedActivities.length} activities with ticked checkboxes (upload = TRUE)`);
            }

            untickedActivities.forEach((activity, index) => {
                const rowRange = activity.startRow === activity.endRow
                    ? `Row ${activity.startRow}`
                    : `Rows ${activity.startRow}-${activity.endRow}`;
                valid.push(`success: true, Activity ${index + 1}: ${activity.alias || 'No Alias'} (${activity.activityType || 'No Type'}) - ${rowRange} - ${activity.questions.length} questions`);
            });

            valid.push(`success: true, All activities successfully extracted and grouped!`);

            // Create validation calls for all activity types dynamically (only unticked activities)
            const activityTypeFilters = Object.fromEntries(
                activity_types.map(type => [
                    `${toCamelCase(type)}Activities`,
                    untickedActivities.filter(activity => activity.activityType?.toLowerCase() === type.toLowerCase())
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
            let totalToDelete = 0;
            let allValidationErrors = [];
            let activityTypeCounts = {};

            Object.entries(filteredValidationResults).forEach(([activityType, result]) => {
                if (result && typeof result === 'object') {
                    const createCount = result.toCreateCount || 0;
                    const updateCount = result.toUpdateCount || 0;
                    const deleteCount = result.toDeleteCount || 0;

                    // Track individual activity type counts
                    activityTypeCounts[activityType] = {
                        toCreateCount: createCount,
                        toUpdateCount: updateCount,
                        toDeleteCount: deleteCount,
                        totalCount: createCount + updateCount + deleteCount
                    };

                    // Add to totals
                    totalToCreate += createCount;
                    totalToUpdate += updateCount;
                    totalToDelete += deleteCount;

                    if (result.errors && Array.isArray(result.errors)) {
                        allValidationErrors = allValidationErrors.concat(result.errors);
                    }

                    // Add individual activity type summary to valid messages (only if there are activities)
                    if (createCount > 0 || updateCount > 0 || deleteCount > 0) {
                        const activityTypeName = activityType.replace('Validation', '').replace(/([A-Z])/g, ' $1').trim();
                        valid.push(`success: true, ${activityTypeName} - Create: ${createCount}, Update: ${updateCount}, Delete: ${deleteCount}`);
                    }
                }
            });

            // Add overall validation summary to valid messages after validation is complete
            valid.push(`success: true, TOTAL Summary - To Create: ${totalToCreate}, To Update: ${totalToUpdate}, To Delete: ${totalToDelete}`);


            return {
                valid: valid,
                errors: errors.concat(allValidationErrors),
                warnings: warnings,
                activities: activities,
                validationSummary: {
                    totalToCreate: totalToCreate,
                    totalToUpdate: totalToUpdate,
                    totalToDelete: totalToDelete,
                    totalAll: totalToCreate + totalToUpdate + totalToDelete,
                    activityTypeCounts: activityTypeCounts,
                    validationResults: filteredValidationResults
                }
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

        // Filter out activities with ticked checkboxes (upload === "TRUE") and group by type
        const untickedActivities = activities.filter(activity => activity.upload?.toLowerCase() === "false");
        const skippedActivities = activities.filter(activity => activity.upload?.toLowerCase() === "true");

        if (skippedActivities.length > 0) {
            valid.push(`success: true, Skipped ${skippedActivities.length} activities with ticked checkboxes (upload = TRUE)`);
        }

        // Filter activities by type for ingestion dynamically (only unticked activities)
        const activityTypeFilters = Object.fromEntries(
            activity_types.map(type => [
                `${toCamelCase(type)}Activities`,
                untickedActivities.filter(activity => activity.activityType?.toLowerCase() === type.toLowerCase())
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

        return {
            valid: valid,
            errors: errors,
            warnings: warnings,
            ingestionResults: filteredIngestionResults
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