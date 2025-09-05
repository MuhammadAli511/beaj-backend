import { getSheetsObj, getAuthSheetClient } from "../utils/sheetUtils.js";
import { isValidCheckbox, isNumeric, containsUrl, isCellHighlighted } from "../utils/sheetUtils.js";
import { activity_types, columns_order } from "../constants/constants.js";
import { validateDriveUrl, getDriveMediaUrl } from "../utils/sheetUtils.js";
import contentIngestionUtils from "../utils/contentIngestionUtils.js";



const validateIngestionService = async (sheetId, sheetTitle) => {
    try {
        let valid = [], errors = [], warnings = [];
        const sheets = await getSheetsObj();
        const authSheetClient = await getAuthSheetClient();
        try {
            // Step 1: Check if sheet is accessible and tab exists
            try {
                const sheetInfo = sheets.spreadsheets.get({
                    auth: authSheetClient,
                    spreadsheetId: sheetId,
                })

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








            // const activities = [];
            // const activityKeys = new Set();
            // let currentActivity = null;

            // for (let r = 1; r < rows.length; r++) {
            //     const row = rows[r];
            //     const cells = row.values || [];
            //     const get = (col) => cells[col]?.formattedValue?.trim() || "";
            //     const rowNum = r + 1;

            //     // Activity level validation
            //     if (get(columns_order.UPLOAD)) {
            //         if (currentActivity) {
            //             activities.push(currentActivity);
            //         }

            //         const upload = get(columns_order.UPLOAD);
            //         const week = get(columns_order.WEEK_NO);
            //         const day = get(columns_order.DAY_NO);
            //         const seq = get(columns_order.SEQ_NO);
            //         const alias = get(columns_order.ALIAS);
            //         const activityType = get(columns_order.ACTIVITY_TYPE).toLowerCase();
            //         const textInstruction = get(columns_order.TEXT_INSTRUCTION);
            //         const audioInstruction = get(columns_order.AUDIO_INSTRUCTION);
            //         const completionSticker = get(columns_order.COMPLETION_STICKER);

            //         if (!isValidCheckbox(upload)) {
            //             errors.push(`success: false, Row ${rowNum}: Invalid UPLOAD checkbox format "${upload}"`)
            //         }

            //         // LESSON TABLE FIELDS
            //         if (!week || !isNumeric(week)) {
            //             errors.push(`success: false, Row ${rowNum}: WEEK_NO must be a valid number, got "${week}"`)
            //         }
            //         if (!day || !isNumeric(day)) {
            //             errors.push(`success: false, Row ${rowNum}: DAY_NO must be a valid number, got "${day}"`)
            //         }
            //         if (!seq || !isNumeric(seq)) {
            //             errors.push(`success: false, Row ${rowNum}: SEQ_NO must be a valid number, got "${seq}"`)
            //         }
            //         if (!activityType) {
            //             errors.push(`success: false, Row ${rowNum}: ACTIVITY_TYPE is required`)
            //         } else if (!activity_types.includes(activityType)) {
            //             errors.push(`success: false, Row ${rowNum}: Invalid ACTIVITY_TYPE "${activityType}"`)
            //         }

            //         // DUPLICATE LESSON CHECK
            //         if (week && day && seq) {
            //             const activityKey = `${week}-${day}-${seq}`
            //             if (activityKeys.has(activityKey)) {
            //                 errors.push(`success: false, Row ${rowNum}: Duplicate Lesson found for Week ${week}, Day ${day}, Seq ${seq}`)
            //             } else {
            //                 activityKeys.add(activityKey)
            //             }
            //         }

            //         // TEXT INSTRUCTIONS
            //         if (textInstruction && containsUrl(textInstruction)) {
            //             errors.push(`success: false, Row ${rowNum}: TEXT_INSTRUCTION contains URLs, should be plain text`)
            //         }

            //         currentActivity = {
            //             rowNum,
            //             upload,
            //             week,
            //             day,
            //             seq,
            //             alias,
            //             activityType,
            //             textInstruction,
            //             audioInstruction,
            //             completionSticker,
            //             questions: [],
            //         }
            //     }

            //     if (!currentActivity) continue

            //     // Question level validation
            //     const questionNumber = get(columns_order.Q_NO);
            //     const questionText = get(columns_order.Q_TEXT);
            //     const questionVideo = get(columns_order.Q_VIDEO_LINK);
            //     const questionAudio = get(columns_order.Q_AUDIO_LINK);
            //     const questionImage = get(columns_order.Q_IMAGE_LINK);
            //     const difficulty = get(columns_order.DIFFICULTY_LEVEL);
            //     const answer = get(columns_order.ANSWER);
            //     const cfText = get(columns_order.CF_TEXT);
            //     const cfImage = get(columns_order.CF_IMAGE);
            //     const cfAudio = get(columns_order.CF_AUDIO);

            //     if (questionNumber || questionText || questionVideo || questionAudio || questionImage) {
            //         // QUESTION NUMBER - If exists should be a valid number
            //         if (questionNumber && !isNumeric(questionNumber)) {
            //             errors.push(`success: false, Row ${rowNum}: Q_NO must be a valid number, got "${questionNumber}"`)
            //         }

            //         // QUESTION TEXT - Should not contain URLs
            //         if (questionText && containsUrl(questionText)) {
            //             errors.push(`success: false, Row ${rowNum}: Q_TEXT contains URLs, should be plain text.`)
            //         }

            //         // DIFFICULTY LEVEL - Either should have all three "easy", "medium", "hard" or empty
            //         if (difficulty && !["easy", "medium", "hard"].includes(difficulty)) {
            //             errors.push(`success: false, Row ${rowNum}: DIFFICULTY_LEVEL must be either "easy", "medium", "hard" or empty, got "${difficulty}"`)
            //         }

            //         // ANSWER - Should not contain URLs
            //         if (answer && containsUrl(answer)) {
            //             errors.push(`success: false, Row ${rowNum}: ANSWER contains URLs, should be plain text.`)
            //         }

            //         // CF TEXT - Should not contain URLs
            //         if (cfText && containsUrl(cfText)) {
            //             errors.push(`success: false, Row ${rowNum}: CF_TEXT contains URLs, should be plain text.`)
            //         }

            //         currentActivity.questions.push({
            //             rowNum,
            //             questionNumber,
            //             questionText,
            //             questionVideo,
            //             questionAudio,
            //             questionImage,
            //             difficulty,
            //             answer,
            //             cfText,
            //             cfImage,
            //             cfAudio,
            //         })
            //     }
            // }

            // if (currentActivity) {
            //     activities.push(currentActivity)
            // }

            // const mediaValidationPromises = []

            // for (const activity of activities) {
            //     // AUDIO INSTRUCTION
            //     if (activity.audioInstruction) {
            //         mediaValidationPromises.push(
            //             validateDriveUrl(activity.audioInstruction, "audio").then((result) => ({
            //                 type: "audio_instruction",
            //                 rowNum: activity.rowNum,
            //                 url: activity.audioInstruction,
            //                 ...result,
            //             })),
            //         )
            //     }

            //     // COMPLETION STICKER
            //     if (activity.completionSticker) {
            //         mediaValidationPromises.push(
            //             validateDriveUrl(activity.completionSticker, "image").then((result) => ({
            //                 type: "completion_sticker",
            //                 rowNum: activity.rowNum,
            //                 url: activity.completionSticker,
            //                 ...result,
            //             })),
            //         )
            //     }

            //     // QUESTION MEDIA
            //     for (const question of activity.questions) {
            //         // QUESTION VIDEO
            //         if (question.questionVideo) {
            //             mediaValidationPromises.push(
            //                 validateDriveUrl(question.questionVideo, "video").then((result) => ({
            //                     type: "question_video",
            //                     rowNum: question.rowNum,
            //                     url: question.questionVideo,
            //                     ...result,
            //                 })),
            //             )
            //         }

            //         // QUESTION AUDIO
            //         if (question.questionAudio) {
            //             mediaValidationPromises.push(
            //                 validateDriveUrl(question.questionAudio, "audio").then((result) => ({
            //                     type: "question_audio",
            //                     rowNum: question.rowNum,
            //                     url: question.questionAudio,
            //                     ...result,
            //                 })),
            //             )
            //         }

            //         // QUESTION IMAGE
            //         if (question.questionImage) {
            //             mediaValidationPromises.push(
            //                 validateDriveUrl(question.questionImage, "image").then((result) => ({
            //                     type: "question_image",
            //                     rowNum: question.rowNum,
            //                     url: question.questionImage,
            //                     ...result,
            //                 })),
            //             )
            //         }

            //         // CUSTOM FEEDBACK IMAGE
            //         if (question.cfImage) {
            //             mediaValidationPromises.push(
            //                 validateDriveUrl(question.cfImage, "image").then((result) => ({
            //                     type: "feedback_image",
            //                     rowNum: question.rowNum,
            //                     url: question.cfImage,
            //                     ...result,
            //                 })),
            //             )
            //         }

            //         // CUSTOM FEEDBACK AUDIO
            //         if (question.cfAudio) {
            //             mediaValidationPromises.push(
            //                 validateDriveUrl(question.cfAudio, "audio").then((result) => ({
            //                     type: "feedback_audio",
            //                     rowNum: question.rowNum,
            //                     url: question.cfAudio,
            //                     ...result,
            //                 })),
            //             )
            //         }
            //     }
            // }

            // // PROCESS ALL MEDIA VALIDATION PROMISES
            // if (mediaValidationPromises.length > 0) {
            //     const mediaResults = await Promise.all(mediaValidationPromises)

            //     for (const result of mediaResults) {
            //         if (!result.valid) {
            //             errors.push(`success: false, Row ${result.rowNum}: Invalid ${result.type} URL format - ${result.error}`);
            //         } else if (!result.accessible) {
            //             errors.push(`success: false, Row ${result.rowNum}: Cannot access ${result.type} file - ${result.error}`);
            //         } else if (result.typeValid === false) {
            //             errors.push(`success: false, Row ${result.rowNum}: ${result.typeError} for ${result.type}`);
            //         }
            //     }
            // }

            if (errors.length === 0) {
                valid.push(`success: true, Activities Count: ${activities.length}`);
                valid.push(`success: true, All validations passed successfully!`);
                return {
                    valid: valid,
                    errors: [],
                    warnings: warnings,
                }
            } else {
                return {
                    valid: valid,
                    errors: errors,
                    warnings: warnings,
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

const readSpreadsheetData = async (sheetId, sheetTitle) => {
    const sheets = await getSheetsObj();
    const authSheetClient = await getAuthSheetClient();
    const res = sheets.spreadsheets.get({
        auth: authSheetClient,
        spreadsheetId: sheetId,
        ranges: [sheetTitle],
        includeGridData: true,
    })

    const sheet = res.data.sheets?.[0]
    const rows = sheet.data?.[0]?.rowData ?? []

    const activities = []
    let currentActivity = null
    let currentQuestion = null
    let currentDifficulty = null

    for (let r = 1; r < rows.length; r++) {
        const row = rows[r]
        const cells = row.values || []
        const get = (col) => cells[col]?.formattedValue?.trim() || ""

        // ---- ACTIVITY LEVEL ----
        if (get(columns_order.UPLOAD)) {
            if (currentActivity) {
                activities.push(currentActivity)
            }
            currentActivity = {
                upload: get(columns_order.UPLOAD),
                week: get(columns_order.WEEK_NO),
                day: get(columns_order.DAY_NO),
                seq: get(columns_order.SEQ_NO),
                alias: get(columns_order.ALIAS),
                activityType: get(columns_order.ACTIVITY_TYPE),
                textInstruction: get(columns_order.TEXT_INSTRUCTION),
                audioInstruction: get(columns_order.AUDIO_INSTRUCTION),
                completionSticker: get(columns_order.COMPLETION_STICKER),
                questions: [],
            }
            currentQuestion = null
            currentDifficulty = null
        }

        if (!currentActivity) continue

        if (get(columns_order.WEEK_NO)) currentActivity.week = get(columns_order.WEEK_NO)
        if (get(columns_order.DAY_NO)) currentActivity.day = get(columns_order.DAY_NO)

        // ---- QUESTION LEVEL ----
        const questionNumber = get(columns_order.Q_NO)
        const questionText = get(columns_order.Q_TEXT)
        const questionVideo = get(columns_order.Q_VIDEO_LINK)
        const questionAudio = get(columns_order.Q_AUDIO_LINK)
        const questionImage = get(columns_order.Q_IMAGE_LINK)

        if (questionNumber) {
            currentQuestion = {
                questionNumber,
                questionText,
                difficulties: [],
            }
            currentActivity.questions.push(currentQuestion)
            currentDifficulty = null
        } else if (!currentQuestion && (questionText || questionVideo || questionAudio || questionImage)) {
            currentQuestion = {
                questionNumber: "",
                questionText,
                difficulties: [],
            }
            currentActivity.questions.push(currentQuestion)
            currentDifficulty = null
        } else if (currentQuestion && questionText) {
            currentQuestion.questionText = questionText
        }

        // ---- DIFFICULTY LEVEL - FIXED ----
        const difficulty = get(columns_order.DIFFICULTY_LEVEL)
        if (difficulty && currentQuestion) {
            let foundDifficulty = currentQuestion.difficulties.find((d) => d.difficulty === difficulty)

            if (!foundDifficulty) {
                const videoUrl = get(columns_order.Q_VIDEO_LINK)
                const audioUrl = get(columns_order.Q_AUDIO_LINK)
                const imageUrl = get(columns_order.Q_IMAGE_LINK)

                foundDifficulty = {
                    difficulty,
                    questionVideo: videoUrl ? await getDriveMediaUrl(videoUrl) : null,
                    questionAudio: audioUrl ? await getDriveMediaUrl(audioUrl) : null,
                    questionImage: imageUrl ? await getDriveMediaUrl(imageUrl) : null,
                    answers: [],
                }
                currentQuestion.difficulties.push(foundDifficulty)
            }
            currentDifficulty = foundDifficulty
        } else if (!difficulty && currentQuestion && (questionVideo || questionAudio || questionImage)) {
            if (!currentDifficulty) {
                currentDifficulty = {
                    difficulty: "",
                    questionVideo: questionVideo ? await getDriveMediaUrl(questionVideo) : null,
                    questionAudio: questionAudio ? await getDriveMediaUrl(questionAudio) : null,
                    questionImage: questionImage ? await getDriveMediaUrl(questionImage) : null,
                    answers: [],
                }
                currentQuestion.difficulties.push(currentDifficulty)
            }
        }

        // ---- ANSWERS LEVEL - FIXED ----
        const hasAnswerData =
            get(columns_order.ANSWER) !== "" ||
            get(columns_order.CF_TEXT) !== "" ||
            get(columns_order.CF_IMAGE) !== "" ||
            get(columns_order.CF_AUDIO) !== ""

        if (hasAnswerData && currentQuestion) {
            if (!currentDifficulty) {
                currentDifficulty = {
                    difficulty: "",
                    questionVideo: questionVideo ? await getDriveMediaUrl(questionVideo) : null,
                    questionAudio: questionAudio ? await getDriveMediaUrl(questionAudio) : null,
                    questionImage: questionImage ? await getDriveMediaUrl(questionImage) : null,
                    answers: [],
                }
                currentQuestion.difficulties.push(currentDifficulty)
            }

            const cfImageUrl = get(columns_order.CF_IMAGE)
            const cfAudioUrl = get(columns_order.CF_AUDIO)

            const answerCell = cells[columns_order.ANSWER]
            const bg = answerCell?.effectiveFormat?.backgroundColor
            const isCorrect = isCellHighlighted(bg)

            currentDifficulty.answers.push({
                aText: get(columns_order.ANSWER) || "",
                cfText: get(columns_order.CF_TEXT) || "",
                cfImage: cfImageUrl ? await getDriveMediaUrl(cfImageUrl) : null,
                cfAudio: cfAudioUrl ? await getDriveMediaUrl(cfAudioUrl) : null,
                isCorrect,
            })
        }
    }

    if (currentActivity) activities.push(currentActivity)
    return activities
};

const processActivities = async (activities, courseId) => {
    const results = []
    let valid = [], errors = [], warnings = []
    let successCount = 0
    let errorCount = 0

    for (const activity of activities) {
        if (activity.upload && activity.upload.toLowerCase() === "false") {
            try {
                const raw_result = await contentIngestionUtils.processActivity(activity, courseId);
                let successMatch = raw_result.match(/success:\s*(true|false)/);
                let success = successMatch ? successMatch[1] === "true" : false;

                if (success) {
                    valid.push(raw_result);
                    successCount++
                }
                else {
                    errors.push(raw_result);
                    errorCount++
                }
                results.push(raw_result)
            } catch (activityError) {
                errorCount++
                errors.push(`success: false, activity: ${activity.alias}, error: ${activityError.message}`)
            }
        } else {
            warnings.push(`Skipping activity ${activity.activityType} - ${activity.alias} - upload flag unchecked`)
        }
    }
    valid.push(`${successCount} Successfully Created.`);
    errors.push(`${errorCount} Errors Occurred.`);
    warnings.push(`${warnings.length} Warnings Occurred.`);

    return {
        valid: valid,
        errors: errors,
        warnings: warnings
    }
};

const processIngestionService = async (courseId, sheetId, sheetTitle) => {
    try {
        const activities = await readSpreadsheetData(sheetId, sheetTitle);
        return await processActivities(activities, courseId);
    } catch (error) {
        error.fileName = 'contentIngestionService.js';
        throw error;
    }
};


export default {
    validateIngestionService,
    processIngestionService,
};