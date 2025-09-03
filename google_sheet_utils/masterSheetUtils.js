import { google } from "googleapis"
import { readFile } from "fs/promises"
import contentIngestionUtils from "../utils/contentIngestionUtils.js"

const creds = JSON.parse(await readFile(new URL("../my_cred.json", import.meta.url), "utf-8"))
const sheets = google.sheets("v4")

const COLUMNS = {
  UPLOAD: 0,
  WEEK_NO: 1,
  DAY_NO: 2,
  SEQ_NO: 3,
  ALIAS: 4,
  ACTIVITY_TYPE: 5,
  TEXT_INSTRUCTION: 6,
  AUDIO_INSTRUCTION: 7,
  COMPLETION_STICKER: 8,
  Q_NO: 9,
  DIFFICULTY_LEVEL: 10,
  Q_TEXT: 11,
  Q_VIDEO_LINK: 12,
  Q_AUDIO_LINK: 13,
  Q_IMAGE_LINK: 14,
  ANSWER: 15,
  CF_TEXT: 16,
  CF_IMAGE: 17,
  CF_AUDIO: 18,
}

const REQUIRED_COLUMNS = [
  "UPLOAD",
  "WEEK_NO",
  "DAY_NO",
  "SEQ_NO",
  "ALIAS",
  "ACTIVITY_TYPE",
  "TEXT_INSTRUCTION",
  "AUDIO_INSTRUCTION",
  "COMPLETION_STICKER",
  "Q_NO",
  "DIFFICULTY_LEVEL",
  "Q_TEXT",
  "Q_VIDEO_LINK",
  "Q_AUDIO_LINK",
  "Q_IMAGE_LINK",
  "ANSWER",
  "CF_TEXT",
  "CF_IMAGE",
  "CF_AUDIO",
]

const ACTIVITY_TYPES = [
  "watchandaudio",
  "video",
  "videoend",
  "mcqs",
  "feedbackaudio",
  "listenandspeak",
  "watchandspeak",
  "assessmentwatchandspeak",
  "assessmentmcqs",
  "feedbackmcqs",
  "speakingpractice",
  "conversationalquestionsbot",
  "read",
  "watchandimage",
  "conversationalmonologuebot",
  "conversationalagencybot",
  "watch",
  "watchend",
]

const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ["https://www.googleapis.com/auth/drive"],
})

const authClient = await auth.getClient()
const drive = google.drive({ version: "v3", auth: authClient })

// Convert Node.js stream → Buffer
function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on("data", (chunk) => chunks.push(chunk))
    stream.on("end", () => resolve(Buffer.concat(chunks)))
    stream.on("error", reject)
  })
}

function extractFileId(driveUrl = "") {
  try {
    // Pattern: /d/<id>/
    const fileIdMatch = driveUrl.match(/\/d\/([a-zA-Z0-9_-]{16,})/)
    if (fileIdMatch) return fileIdMatch[1]

    // Pattern: open?id=<id>
    const openIdMatch = driveUrl.match(/[?&]id=([a-zA-Z0-9_-]{16,})/)
    if (openIdMatch) return openIdMatch[1]

    // Raw ID directly
    if (/^[a-zA-Z0-9_-]{16,}$/.test(driveUrl)) return driveUrl

    return null
  } catch {
    return null
  }
}

// Download file from Google Drive
export async function getDriveMediaUrl(driveUrl) {
  // Return null if no URL provided
  if (!driveUrl || driveUrl.trim() === "") {
    return null
  }

  const fileId = extractFileId(driveUrl)
  if (!fileId) {
    console.warn(`Invalid Google Drive URL: ${driveUrl}`)
    return null
  }

  try {
    const res = await drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "stream" })

    const buffer = await streamToBuffer(res.data)

    // Get metadata for original filename & mimetype
    const meta = await drive.files.get({
      fileId,
      fields: "name, mimeType",
      supportsAllDrives: true,
    })

    return {
      buffer,
      originalname: meta.data.name,
      mimetype: meta.data.mimeType,
      size: buffer.length,
    }
  } catch (error) {
    console.error(`Error downloading file from Google Drive (${driveUrl}):`, error.message)
    return null
  }
}

// Validate if URL is accessible
async function validateDriveUrl(driveUrl, expectedType = null) {
  if (!driveUrl || driveUrl.trim() === "") return { valid: true, accessible: true }

  const fileId = extractFileId(driveUrl)
  if (!fileId) {
    return { valid: false, accessible: false, error: "Invalid Google Drive URL format" }
  }

  try {
    const meta = await drive.files.get({
      fileId,
      fields: "name, mimeType, trashed",
      supportsAllDrives: true,
    })

    if (meta.data.trashed) {
      return { valid: true, accessible: false, error: "File is in trash" }
    }

    const mimeType = meta.data.mimeType
    let typeValid = true
    let typeError = ""

    if (expectedType) {
      switch (expectedType) {
        case "video":
          typeValid = mimeType.startsWith("video/")
          typeError = typeValid ? "" : `Expected video file, got ${mimeType}`
          break
        case "audio":
          typeValid = mimeType.startsWith("audio/")
          typeError = typeValid ? "" : `Expected audio file, got ${mimeType}`
          break
        case "image":
          typeValid = mimeType.startsWith("image/")
          typeError = typeValid ? "" : `Expected image file, got ${mimeType}`
          break
      }
    }
    return {
      valid: true,
      accessible: true,
      typeValid,
      typeError,
      fileName: meta.data.name,
      mimeType: meta.data.mimeType,
    }
  } catch (error) {
    return {
      valid: true,
      accessible: false,
      error: `Cannot access file: ${error.message}`,
    }
  }
}

// Validate checkbox format
function isValidCheckbox(value) {
  if (!value) return true // Empty is valid (unchecked)
  const normalizedValue = value.toString().toLowerCase().trim()
  return ["true", "false", "yes", "no", "1", "0", "checked", "unchecked"].includes(normalizedValue)
}

// Validate if text contains URLs
function containsUrl(text) {
  if (!text) return false
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|edu|gov)[^\s]*)/i
  return urlRegex.test(text)
}

function isCellHighlighted(bg) {
  if (!bg) return 0 // no color = white
  const r = bg.red ?? 1
  const g = bg.green ?? 1
  const b = bg.blue ?? 1

  // Google Sheets default white is {1,1,1}
  const isWhite = r > 0.99 && g > 0.99 && b > 0.99
  return !isWhite
}

const authSheet = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
})

const authSheetClient = await authSheet.getClient()

// Helper function to validate if a value is numeric
function isNumeric(value) {
  if (!value || value === "") return false
  return !isNaN(value) && !isNaN(Number.parseFloat(value))
}

async function readSpreadsheetData(spreadsheetId, sheetTitle) {
  const res = await sheets.spreadsheets.get({
    auth: authSheetClient,
    spreadsheetId,
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
    if (get(COLUMNS.UPLOAD)) {
      if (currentActivity) {
        activities.push(currentActivity)
      }
      currentActivity = {
        upload: get(COLUMNS.UPLOAD),
        week: get(COLUMNS.WEEK_NO),
        day: get(COLUMNS.DAY_NO),
        seq: get(COLUMNS.SEQ_NO),
        alias: get(COLUMNS.ALIAS),
        activityType: get(COLUMNS.ACTIVITY_TYPE),
        textInstruction: get(COLUMNS.TEXT_INSTRUCTION),
        audioInstruction: get(COLUMNS.AUDIO_INSTRUCTION),
        completionSticker: get(COLUMNS.COMPLETION_STICKER),
        questions: [],
      }
      currentQuestion = null
      currentDifficulty = null
    }

    if (!currentActivity) continue

    if (get(COLUMNS.WEEK_NO)) currentActivity.week = get(COLUMNS.WEEK_NO)
    if (get(COLUMNS.DAY_NO)) currentActivity.day = get(COLUMNS.DAY_NO)

    // ---- QUESTION LEVEL ----
    const qNo = get(COLUMNS.Q_NO)
    const qText = get(COLUMNS.Q_TEXT)
    const qVideo = get(COLUMNS.Q_VIDEO_LINK)
    const qAudio = get(COLUMNS.Q_AUDIO_LINK)
    const qImage = get(COLUMNS.Q_IMAGE_LINK)

    if (qNo) {
      currentQuestion = {
        qNo,
        qText,
        difficulties: [],
      }
      currentActivity.questions.push(currentQuestion)
      currentDifficulty = null
    } else if (!currentQuestion && (qText || qVideo || qAudio || qImage)) {
      currentQuestion = {
        qNo: "",
        qText,
        difficulties: [],
      }
      currentActivity.questions.push(currentQuestion)
      currentDifficulty = null
    } else if (currentQuestion && qText) {
      currentQuestion.qText = qText
    }

    // ---- DIFFICULTY LEVEL - FIXED ----
    const difficulty = get(COLUMNS.DIFFICULTY_LEVEL)
    if (difficulty && currentQuestion) {
      let foundDifficulty = currentQuestion.difficulties.find((d) => d.difficulty === difficulty)

      if (!foundDifficulty) {
        const videoUrl = get(COLUMNS.Q_VIDEO_LINK)
        const audioUrl = get(COLUMNS.Q_AUDIO_LINK)
        const imageUrl = get(COLUMNS.Q_IMAGE_LINK)

        foundDifficulty = {
          difficulty,
          qVideo: videoUrl ? await getDriveMediaUrl(videoUrl) : null,
          qAudio: audioUrl ? await getDriveMediaUrl(audioUrl) : null,
          qImage: imageUrl ? await getDriveMediaUrl(imageUrl) : null,
          answers: [],
        }
        currentQuestion.difficulties.push(foundDifficulty)
      }
      currentDifficulty = foundDifficulty
    } else if (!difficulty && currentQuestion && (qVideo || qAudio || qImage)) {
      if (!currentDifficulty) {
        currentDifficulty = {
          difficulty: "",
          qVideo: qVideo ? await getDriveMediaUrl(qVideo) : null,
          qAudio: qAudio ? await getDriveMediaUrl(qAudio) : null,
          qImage: qImage ? await getDriveMediaUrl(qImage) : null,
          answers: [],
        }
        currentQuestion.difficulties.push(currentDifficulty)
      }
    }

    // ---- ANSWERS LEVEL - FIXED ----
    const hasAnswerData =
      get(COLUMNS.ANSWER) !== "" ||
      get(COLUMNS.CF_TEXT) !== "" ||
      get(COLUMNS.CF_IMAGE) !== "" ||
      get(COLUMNS.CF_AUDIO) !== ""

    if (hasAnswerData && currentQuestion) {
      if (!currentDifficulty) {
        currentDifficulty = {
          difficulty: "",
          qVideo: qVideo ? await getDriveMediaUrl(qVideo) : null,
          qAudio: qAudio ? await getDriveMediaUrl(qAudio) : null,
          qImage: qImage ? await getDriveMediaUrl(qImage) : null,
          answers: [],
        }
        currentQuestion.difficulties.push(currentDifficulty)
      }

      const cfImageUrl = get(COLUMNS.CF_IMAGE)
      const cfAudioUrl = get(COLUMNS.CF_AUDIO)

      const answerCell = cells[COLUMNS.ANSWER]
      const bg = answerCell?.effectiveFormat?.backgroundColor
      const isCorrect = isCellHighlighted(bg)

      currentDifficulty.answers.push({
        aText: get(COLUMNS.ANSWER) || "",
        cfText: get(COLUMNS.CF_TEXT) || "",
        cfImage: cfImageUrl ? await getDriveMediaUrl(cfImageUrl) : null,
        cfAudio: cfAudioUrl ? await getDriveMediaUrl(cfAudioUrl) : null,
        isCorrect,
      })
    }
  }

  if (currentActivity) activities.push(currentActivity)
  return activities
}

const validateIngestion = async (spreadsheetId, sheetTitle) => {
  let valid = [], errors = [], warnings = [];

  try {
    console.log("Starting comprehensive validation...")
    try {
      const sheetInfo = await sheets.spreadsheets.get({
        auth: authSheetClient,
        spreadsheetId,
      })

      // Check if sheet tab exists
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


    // Step 2: Get sheet data with formatting
    const res = await sheets.spreadsheets.get({
      auth: authSheetClient,
      spreadsheetId,
      ranges: [sheetTitle],
      includeGridData: true,
    })

    const sheet = res.data.sheets?.[0]
    const rows = sheet.data?.[0]?.rowData ?? []

    if (rows.length === 0) {
      errors.push("success: false, Sheet is empty")
      return { valid: valid, errors: errors, warnings: warnings }
    }

    const activities = []
    const activityKeys = new Set() // For duplicate detection
    let currentActivity = null

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]
      const cells = row.values || []
      const get = (col) => cells[col]?.formattedValue?.trim() || ""
      const rowNum = r + 1

      // Activity level validation
      if (get(COLUMNS.UPLOAD)) {
        if (currentActivity) {
          activities.push(currentActivity)
        }

        const upload = get(COLUMNS.UPLOAD)
        const week = get(COLUMNS.WEEK_NO)
        const day = get(COLUMNS.DAY_NO)
        const seq = get(COLUMNS.SEQ_NO)
        const alias = get(COLUMNS.ALIAS)
        const activityType = get(COLUMNS.ACTIVITY_TYPE).toLowerCase();
        const textInstruction = get(COLUMNS.TEXT_INSTRUCTION)
        const audioInstruction = get(COLUMNS.AUDIO_INSTRUCTION)
        const completionSticker = get(COLUMNS.COMPLETION_STICKER)

        // Validate upload checkbox
        if (!isValidCheckbox(upload)) {
          errors.push(`success: false, Row ${rowNum}: Invalid UPLOAD checkbox format "${upload}"`)
        }

        // Validate required fields
        if (!week || !isNumeric(week)) {
          errors.push(`success: false, Row ${rowNum}: WEEK_NO must be a valid number, got "${week}"`)
        }
        if (!day || !isNumeric(day)) {
          errors.push(`success: false, Row ${rowNum}: DAY_NO must be a valid number, got "${day}"`)
        }
        if (!seq || !isNumeric(seq)) {
          errors.push(`success: false, Row ${rowNum}: SEQ_NO must be a valid number, got "${seq}"`)
        }
        if (!alias) {
          errors.push(`success: false, Row ${rowNum}: ALIAS is required`)
        }
        if (!activityType) {
          errors.push(`success: false, Row ${rowNum}: ACTIVITY_TYPE is required`)
        } else if (!ACTIVITY_TYPES.includes(activityType)) {
          errors.push(
            `success: false, Row ${rowNum}: Invalid ACTIVITY_TYPE "${activityType}"`
          )
        }

        // Check for duplicates (week + day + seq combination)
        if (week && day && seq) {
          const activityKey = `${week}-${day}-${seq}`
          if (activityKeys.has(activityKey)) {
            errors.push(`success: false, Row ${rowNum}: Duplicate Lesson found for Week ${week}, Day ${day}, Seq ${seq}`)
          } else {
            activityKeys.add(activityKey)
          }
        }

        // Validate text instruction doesn't contain URLs
        if (textInstruction && containsUrl(textInstruction)) {
          errors.push(`success: false, Row ${rowNum}: TEXT_INSTRUCTION contains URLs, should be plain text`)
        }

        currentActivity = {
          rowNum,
          upload,
          week,
          day,
          seq,
          alias,
          activityType,
          textInstruction,
          audioInstruction,
          completionSticker,
          questions: [],
        }
      }

      if (!currentActivity) continue

      // Question level validation
      const qNo = get(COLUMNS.Q_NO)
      const qText = get(COLUMNS.Q_TEXT)
      const qVideo = get(COLUMNS.Q_VIDEO_LINK)
      const qAudio = get(COLUMNS.Q_AUDIO_LINK)
      const qImage = get(COLUMNS.Q_IMAGE_LINK)

      if (qNo || qText || qVideo || qAudio || qImage) {
        // Validate question text doesn't contain URLs
        if (qText && containsUrl(qText)) {
          errors.push(`success: false, Row ${rowNum}: Q_TEXT contains URLs, should be plain text.`)
        }

        currentActivity.questions.push({
          rowNum,
          qNo,
          qText,
          qVideo,
          qAudio,
          qImage,
          difficulty: get(COLUMNS.DIFFICULTY_LEVEL),
          answer: get(COLUMNS.ANSWER),
          cfText: get(COLUMNS.CF_TEXT),
          cfImage: get(COLUMNS.CF_IMAGE),
          cfAudio: get(COLUMNS.CF_AUDIO),
        })
      }
    }

    if (currentActivity) {
      activities.push(currentActivity)
    }

    const mediaValidationPromises = []

    for (const activity of activities) {
      // Validate audio instruction URL
      if (activity.audioInstruction) {
        mediaValidationPromises.push(
          validateDriveUrl(activity.audioInstruction, "audio").then((result) => ({
            type: "audio_instruction",
            rowNum: activity.rowNum,
            url: activity.audioInstruction,
            ...result,
          })),
        )
      }

      // Validate completion sticker URL
      if (activity.completionSticker) {
        mediaValidationPromises.push(
          validateDriveUrl(activity.completionSticker, "image").then((result) => ({
            type: "completion_sticker",
            rowNum: activity.rowNum,
            url: activity.completionSticker,
            ...result,
          })),
        )
      }

      // Validate question media URLs
      for (const question of activity.questions) {
        if (question.qVideo) {
          mediaValidationPromises.push(
            validateDriveUrl(question.qVideo, "video").then((result) => ({
              type: "question_video",
              rowNum: question.rowNum,
              url: question.qVideo,
              ...result,
            })),
          )
        }

        if (question.qAudio) {
          mediaValidationPromises.push(
            validateDriveUrl(question.qAudio, "audio").then((result) => ({
              type: "question_audio",
              rowNum: question.rowNum,
              url: question.qAudio,
              ...result,
            })),
          )
        }

        if (question.qImage) {
          mediaValidationPromises.push(
            validateDriveUrl(question.qImage, "image").then((result) => ({
              type: "question_image",
              rowNum: question.rowNum,
              url: question.qImage,
              ...result,
            })),
          )
        }

        if (question.cfImage) {
          mediaValidationPromises.push(
            validateDriveUrl(question.cfImage, "image").then((result) => ({
              type: "feedback_image",
              rowNum: question.rowNum,
              url: question.cfImage,
              ...result,
            })),
          )
        }

        if (question.cfAudio) {
          mediaValidationPromises.push(
            validateDriveUrl(question.cfAudio, "audio").then((result) => ({
              type: "feedback_audio",
              rowNum: question.rowNum,
              url: question.cfAudio,
              ...result,
            })),
          )
        }

        // Validate feedback text doesn't contain URLs
        if (question.cfText && containsUrl(question.cfText)) {
          validationErrors.push(`Row ${question.rowNum}: CF_TEXT contains URLs, should be plain text`)
        }
      }
    }

    // Process all media validation promises
    if (mediaValidationPromises.length > 0) {
      const mediaResults = await Promise.all(mediaValidationPromises)

      for (const result of mediaResults) {
        if (!result.valid) {
          errors.push(`success: false, Row ${result.rowNum}: Invalid ${result.type} URL format - ${result.error}`)
        } else if (!result.accessible) {
          errors.push(`success: false, Row ${result.rowNum}: Cannot access ${result.type} file - ${result.error}`)
        } else if (result.typeValid === false) {
          errors.push(`success: false, Row ${result.rowNum}: ${result.typeError} for ${result.type}`)
        }
      }
    }

    if (errors.length === 0) {
      valid.push(`success: true, Activities Count: ${activities.length}`)
      valid.push(`success: true, All validations passed successfully!`)
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
}

const processIngestion = async (courseId, spreadsheetId, sheetTitle) => {
  try {
    console.log("Starting ingestion process...")

    // If validation passed, proceed with the original processing
    const activities = await readSpreadsheetData(spreadsheetId, sheetTitle)
    return await processActivities(activities, courseId)
  } catch (error) {
    console.error("Error in processIngestion:", error)
    error.fileName = "MasterSheetUtils.js"
    throw error
  }
}

async function processActivities(activities, courseId) {
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

        if(success){
          valid.push(raw_result);
          successCount++
        }
        else{
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
}

export { validateIngestion, processIngestion }
