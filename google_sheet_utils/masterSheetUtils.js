import { google } from "googleapis";
import { readFile } from "fs/promises";
import { Readable } from "stream";
import contentIngestionUtils from "../utils/contentIngestionUtils.js";

const creds = JSON.parse(
  await readFile(new URL("../my_cred.json", import.meta.url), "utf-8")
);
const sheets = google.sheets("v4");

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
};

const REQUIRED_COLUMNS = [
  'UPLOAD', 'WEEK_NO', 'DAY_NO', 'SEQ_NO', 'ALIAS', 'ACTIVITY_TYPE',
  'TEXT_INSTRUCTION', 'AUDIO_INSTRUCTION', 'COMPLETION_STICKER',
  'Q_NO', 'DIFFICULTY_LEVEL', 'Q_TEXT', 'Q_VIDEO_LINK', 'Q_AUDIO_LINK',
  'Q_IMAGE_LINK', 'ANSWER', 'CF_TEXT', 'CF_IMAGE', 'CF_AUDIO'
];

const ACTIVITY_TYPES = [
  "watchandaudio","video","videoend","mcqs","feedbackaudio","listenandspeak",
      "watchandspeak","assessmentwatchandspeak","assessmentmcqs","feedbackmcqs",
      "speakingpractice","conversationalquestionsbot","read","watchandimage",
      "conversationalmonologuebot","conversationalagencybot"
];

const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const authClient = await auth.getClient();
const drive = google.drive({ version: 'v3', auth: authClient });

// Convert Node.js stream → Buffer
function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

function extractFileId(driveUrl = "") {
  try {
    // Pattern: /d/<id>/
    const fileIdMatch = driveUrl.match(/\/d\/([a-zA-Z0-9_-]{16,})/);
    if (fileIdMatch) return fileIdMatch[1];

    // Pattern: open?id=<id>
    const openIdMatch = driveUrl.match(/[?&]id=([a-zA-Z0-9_-]{16,})/);
    if (openIdMatch) return openIdMatch[1];

    // Raw ID directly
    if (/^[a-zA-Z0-9_-]{16,}$/.test(driveUrl)) return driveUrl;

    return null;
  } catch {
    return null;
  }
}

// Download file from Google Drive
export async function getDriveMediaUrl(driveUrl) {
  // Return null if no URL provided
  if (!driveUrl || driveUrl.trim() === "") {
    return null;
  }

  const fileId = extractFileId(driveUrl);
  if (!fileId) {
    console.warn(`Invalid Google Drive URL: ${driveUrl}`);
    return null;
  }

  try {
    const res = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "stream" }
    );

    const buffer = await streamToBuffer(res.data);

    // Get metadata for original filename & mimetype
    const meta = await drive.files.get({ 
      fileId, 
      fields: "name, mimeType", 
      supportsAllDrives: true 
    });

    return {
      buffer,
      originalname: meta.data.name,
      mimetype: meta.data.mimeType,
      size: buffer.length,
    };
  } catch (error) {
    console.error(`Error downloading file from Google Drive (${driveUrl}):`, error.message);
    return null;
  }
}

// Validate if URL is accessible
async function validateDriveUrl(driveUrl, expectedType = null) {
  if (!driveUrl || driveUrl.trim() === "") return { valid: true, accessible: true };

  const fileId = extractFileId(driveUrl);
  if (!fileId) {
    return { valid: false, accessible: false, error: 'Invalid Google Drive URL format' };
  }

  try {
    const meta = await drive.files.get({ 
      fileId, 
      fields: "name, mimeType, trashed", 
      supportsAllDrives: true 
    });

    if (meta.data.trashed) {
      return { valid: true, accessible: false, error: 'File is in trash' };
    }

    const mimeType = meta.data.mimeType;
    let typeValid = true;
    let typeError = '';

    if (expectedType) {
      switch (expectedType) {
        case 'video':
          typeValid = mimeType.startsWith('video/');
          typeError = typeValid ? '' : `Expected video file, got ${mimeType}`;
          break;
        case 'audio':
          typeValid = mimeType.startsWith('audio/');
          typeError = typeValid ? '' : `Expected audio file, got ${mimeType}`;
          break;
        case 'image':
          typeValid = mimeType.startsWith('image/');
          typeError = typeValid ? '' : `Expected image file, got ${mimeType}`;
          break;
      }
    }

    return { 
      valid: true, 
      accessible: true, 
      typeValid, 
      typeError,
      fileName: meta.data.name,
      mimeType: meta.data.mimeType
    };
  } catch (error) {
    return { 
      valid: true, 
      accessible: false, 
      error: `Cannot access file: ${error.message}` 
    };
  }
}

// Validate checkbox format
function isValidCheckbox(value) {
  if (!value) return true; // Empty is valid (unchecked)
  const normalizedValue = value.toString().toLowerCase().trim();
  return ['true', 'false', 'yes', 'no', '1', '0', 'checked', 'unchecked'].includes(normalizedValue);
}

// Validate if text contains URLs
function containsUrl(text) {
  if (!text) return false;
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|edu|gov)[^\s]*)/i;
  return urlRegex.test(text);
}

function isCellHighlighted(bg) {
  if (!bg) return 0; // no color = white
  const r = bg.red ?? 1;
  const g = bg.green ?? 1;
  const b = bg.blue ?? 1;

  // Google Sheets default white is {1,1,1}
  const isWhite = r > 0.99 && g > 0.99 && b > 0.99;
  return !isWhite;
}

const masterSheetUtils = async (courseId, spreadsheetId, sheetTitle = "Content Ingestion") => {
  try {
    // const spreadsheetId = "1Nat0B3coOFoIeF_aO-vY-KHuqQxtjLYKx5lNPFBJndg";
    // console.log("🚀 Starting comprehensive sheet validation...");
    // const validationResults = await validateSheetData(spreadsheetId, sheetTitle);
    
    // Step 2: Display validation results
    // displayValidationResults(validationResults);
    
    // Step 3: Stop if validation failed
    // if (!validationResults.dataValid) {
    //   throw new Error("Validation failed. Please fix the issues in the sheet before proceeding.");
    // }
    
    // // Step 4: If validation passed, proceed with normal processing
    // console.log("🎯 Validation successful! Starting data processing...");

    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const authClient = await auth.getClient();
    // const spreadsheetId = "1Nat0B3coOFoIeF_aO-vY-KHuqQxtjLYKx5lNPFBJndg";

    const res = await sheets.spreadsheets.get({
      auth: authClient,
      spreadsheetId,
      ranges: [sheetTitle],
      includeGridData: true,
    });

    const sheet = res.data.sheets?.[0];
    const rows = sheet.data?.[0]?.rowData ?? [];

    let activities = [];
    let currentActivity = null;
    let currentQuestion = null;
    let currentDifficulty = null;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const cells = row.values || [];
      const get = (col) => cells[col]?.formattedValue?.trim() || "";

      // ---- ACTIVITY LEVEL ----
      if (get(COLUMNS.UPLOAD)) {
        if (currentActivity) {
          activities.push(currentActivity);
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
        };
        currentQuestion = null;
        currentDifficulty = null;
      }

      if (!currentActivity) continue;

      if (get(COLUMNS.WEEK_NO)) currentActivity.week = get(COLUMNS.WEEK_NO);
      if (get(COLUMNS.DAY_NO)) currentActivity.day = get(COLUMNS.DAY_NO);

      // ---- QUESTION LEVEL ----
      const qNo = get(COLUMNS.Q_NO);
      const qText = get(COLUMNS.Q_TEXT);
      const qVideo = get(COLUMNS.Q_VIDEO_LINK);
      const qAudio = get(COLUMNS.Q_AUDIO_LINK);
      const qImage = get(COLUMNS.Q_IMAGE_LINK);

      if (qNo) {
        currentQuestion = {
          qNo,
          qText,
          difficulties: [],
        };
        currentActivity.questions.push(currentQuestion);
        currentDifficulty = null;
      } else if (!currentQuestion && (qText || qVideo || qAudio || qImage)) {
        currentQuestion = {
          qNo: "",
          qText,
          difficulties: [],
        };
        currentActivity.questions.push(currentQuestion);
        currentDifficulty = null;
      } else if (currentQuestion && qText) {
        currentQuestion.qText = qText;
      }

      // ---- DIFFICULTY LEVEL - FIXED ----
      const difficulty = get(COLUMNS.DIFFICULTY_LEVEL);
      if (difficulty && currentQuestion) {
        let foundDifficulty = currentQuestion.difficulties.find(
          (d) => d.difficulty === difficulty
        );

        if (!foundDifficulty) {
          const videoUrl = get(COLUMNS.Q_VIDEO_LINK);
          const audioUrl = get(COLUMNS.Q_AUDIO_LINK);
          const imageUrl = get(COLUMNS.Q_IMAGE_LINK);

          foundDifficulty = {
            difficulty,
            qVideo: videoUrl ? await getDriveMediaUrl(videoUrl) : null,
            qAudio: audioUrl ? await getDriveMediaUrl(audioUrl) : null,
            qImage: imageUrl ? await getDriveMediaUrl(imageUrl) : null,
            answers: [],
          };
          currentQuestion.difficulties.push(foundDifficulty);
        }
        currentDifficulty = foundDifficulty;
      } else if (!difficulty && currentQuestion && (qVideo || qAudio || qImage)) {
        if (!currentDifficulty) {
          currentDifficulty = {
            difficulty: "",
            qVideo: qVideo ? await getDriveMediaUrl(qVideo) : null,
            qAudio: qAudio ? await getDriveMediaUrl(qAudio) : null,
            qImage: qImage ? await getDriveMediaUrl(qImage) : null,
            answers: [],
          };
          currentQuestion.difficulties.push(currentDifficulty);
        }
      }

      // ---- ANSWERS LEVEL - FIXED ----
      const hasAnswerData =
        get(COLUMNS.ANSWER) !== "" ||
        get(COLUMNS.CF_TEXT) !== "" ||
        get(COLUMNS.CF_IMAGE) !== "" ||
        get(COLUMNS.CF_AUDIO) !== "";

      if (hasAnswerData && currentQuestion) {
        if (!currentDifficulty) {
          currentDifficulty = {
            difficulty: "",
            qVideo: qVideo ? await getDriveMediaUrl(qVideo) : null,
            qAudio: qAudio ? await getDriveMediaUrl(qAudio) : null,
            qImage: qImage ? await getDriveMediaUrl(qImage) : null,
            answers: [],
          };
          currentQuestion.difficulties.push(currentDifficulty);
        }

        const cfImageUrl = get(COLUMNS.CF_IMAGE);
        const cfAudioUrl = get(COLUMNS.CF_AUDIO);

        const answerCell = cells[COLUMNS.ANSWER];
        const bg = answerCell?.effectiveFormat?.backgroundColor;
        const isCorrect = isCellHighlighted(bg);

        currentDifficulty.answers.push({
          aText: get(COLUMNS.ANSWER) || "",
          cfText: get(COLUMNS.CF_TEXT) || "",
          cfImage: cfImageUrl ? await getDriveMediaUrl(cfImageUrl) : null,
          cfAudio: cfAudioUrl ? await getDriveMediaUrl(cfAudioUrl) : null,
          isCorrect,
        });
      }
    }

    if (currentActivity) activities.push(currentActivity);

    return await processActivities(activities, courseId);
  } catch (error) {
    console.error("Error in MasterSheetUtils:", error);
    error.fileName = "MasterSheetUtils.js";
    throw error; // Re-throw to maintain your error handling flow
  }
};

// Main validation function
async function validateSheetData(spreadsheetId, sheetTitle) {
  const validationResults = {
    sheetAccessible: false,
    sheetTabExists: false,
    columnsValid: false,
    dataValid: true,
    issues: [],
    warnings: [],
    summary: {
      totalActivities: 0,
      validActivities: 0,
      totalUrls: 0,
      validUrls: 0,
      duplicateActivities: 0
    }
  };

  try {
    console.log("🔍 Starting sheet validation...");
    
    // Step 1: Validate sheet accessibility
    console.log("📋 Validating sheet accessibility...");
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const authClient = await auth.getClient();
    
    try {
      const sheetInfo = await sheets.spreadsheets.get({
        auth: authClient,
        spreadsheetId,
      });
      
      validationResults.sheetAccessible = true;
      console.log("✅ Sheet is accessible");

      // Step 2: Validate sheet tab exists
      const sheetTab = sheetInfo.data.sheets?.find(s => s.properties.title === sheetTitle);
      if (!sheetTab) {
        validationResults.issues.push(`Sheet tab '${sheetTitle}' not found`);
        return validationResults;
      }
      
      validationResults.sheetTabExists = true;
      console.log(`✅ Sheet tab '${sheetTitle}' found`);

    } catch (error) {
      validationResults.issues.push(`Cannot access spreadsheet: ${error.message}`);
      return validationResults;
    }

    // Step 3: Get sheet data with formatting
    const res = await sheets.spreadsheets.get({
      auth: authClient,
      spreadsheetId,
      ranges: [sheetTitle],
      includeGridData: true,
    });

    const sheet = res.data.sheets?.[0];
    const rows = sheet.data?.[0]?.rowData ?? [];

    if (rows.length === 0) {
      validationResults.issues.push("Sheet is empty");
      return validationResults;
    }

    // Step 4: Validate columns
    console.log("🔍 Validating columns...");
    const headerRow = rows[0];
    const headers = headerRow.values || [];
    
    if (headers.length < REQUIRED_COLUMNS.length) {
      validationResults.issues.push(`Insufficient columns. Expected ${REQUIRED_COLUMNS.length}, found ${headers.length}`);
    } else {
      validationResults.columnsValid = true;
      console.log("✅ All required columns present");
    }

    // Step 5: Parse and validate activities
    console.log("🔍 Validating activity data...");
    let activities = [];
    let currentActivity = null;
    let activityKeys = new Set(); // For duplicate detection
    let urlValidations = []; // Batch URL validations

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const cells = row.values || [];
      const get = (col) => cells[col]?.formattedValue?.trim() || "";
      const rowNum = r + 1;

      // Activity level validation
      if (get(COLUMNS.UPLOAD)) {
        if (currentActivity) {
          activities.push(currentActivity);
        }

        const week = get(COLUMNS.WEEK_NO);
        const day = get(COLUMNS.DAY_NO);
        const seq = get(COLUMNS.SEQ_NO);
        const alias = get(COLUMNS.ALIAS);
        const activityType = get(COLUMNS.ACTIVITY_TYPE);
        const textInstruction = get(COLUMNS.TEXT_INSTRUCTION);
        const audioInstruction = get(COLUMNS.AUDIO_INSTRUCTION);
        const completionSticker = get(COLUMNS.COMPLETION_STICKER);
        const upload = get(COLUMNS.UPLOAD);

        // Validate upload checkbox
        if (!isValidCheckbox(upload)) {
          validationResults.issues.push(`Row ${rowNum}: Invalid upload checkbox value '${upload}'`);
        }

        // Validate required fields
        if (!week) validationResults.issues.push(`Row ${rowNum}: Missing week number`);
        if (!day) validationResults.issues.push(`Row ${rowNum}: Missing day number`);
        if (!seq) validationResults.issues.push(`Row ${rowNum}: Missing sequence number`);
        if (!alias) validationResults.issues.push(`Row ${rowNum}: Missing alias`);
        if (!activityType) validationResults.issues.push(`Row ${rowNum}: Missing activity type`);

        // Validate numeric fields
        if (week && isNaN(parseInt(week))) {
          validationResults.issues.push(`Row ${rowNum}: Week number must be numeric, got '${week}'`);
        }
        if (day && isNaN(parseInt(day))) {
          validationResults.issues.push(`Row ${rowNum}: Day number must be numeric, got '${day}'`);
        }
        if (seq && isNaN(parseInt(seq))) {
          validationResults.issues.push(`Row ${rowNum}: Sequence number must be numeric, got '${seq}'`);
        }

        // Validate activity type
        if (activityType && !ACTIVITY_TYPES.includes(activityType)) {
          validationResults.warnings.push(`Row ${rowNum}: Unknown activity type '${activityType}'`);
        }

        // Validate text instruction doesn't contain URLs
        if (containsUrl(textInstruction)) {
          validationResults.warnings.push(`Row ${rowNum}: Text instruction contains URL, should be plain text`);
        }

        // Check for duplicates
        const activityKey = `${week}-${day}-${seq}`;
        if (activityKeys.has(activityKey)) {
          validationResults.issues.push(`Row ${rowNum}: Duplicate activity with Week ${week}, Day ${day}, Seq ${seq}`);
          validationResults.summary.duplicateActivities++;
        } else {
          activityKeys.add(activityKey);
        }

        // Queue URL validations
        if (audioInstruction) {
          urlValidations.push({
            url: audioInstruction,
            type: 'audio',
            location: `Row ${rowNum} Audio Instruction`,
            rowNum
          });
        }
        
        if (completionSticker) {
          urlValidations.push({
            url: completionSticker,
            type: 'image',
            location: `Row ${rowNum} Completion Sticker`,
            rowNum
          });
        }

        currentActivity = {
          rowNum,
          upload, week, day, seq, alias, activityType,
          textInstruction, audioInstruction, completionSticker,
          questions: [],
        };
        validationResults.summary.totalActivities++;
      }

      // Question and media validation
      if (currentActivity) {
        const qVideo = get(COLUMNS.Q_VIDEO_LINK);
        const qAudio = get(COLUMNS.Q_AUDIO_LINK);
        const qImage = get(COLUMNS.Q_IMAGE_LINK);
        const cfImage = get(COLUMNS.CF_IMAGE);
        const cfAudio = get(COLUMNS.CF_AUDIO);

        // Queue media URL validations
        if (qVideo) {
          urlValidations.push({
            url: qVideo,
            type: 'video',
            location: `Row ${rowNum} Question Video`,
            rowNum
          });
        }
        if (qAudio) {
          urlValidations.push({
            url: qAudio,
            type: 'audio',
            location: `Row ${rowNum} Question Audio`,
            rowNum
          });
        }
        if (qImage) {
          urlValidations.push({
            url: qImage,
            type: 'image',
            location: `Row ${rowNum} Question Image`,
            rowNum
          });
        }
        if (cfImage) {
          urlValidations.push({
            url: cfImage,
            type: 'image',
            location: `Row ${rowNum} CF Image`,
            rowNum
          });
        }
        if (cfAudio) {
          urlValidations.push({
            url: cfAudio,
            type: 'audio',
            location: `Row ${rowNum} CF Audio`,
            rowNum
          });
        }
      }
    }

    if (currentActivity) activities.push(currentActivity);
    validationResults.summary.validActivities = activities.length;

    // Step 6: Batch validate all URLs
    console.log(`🔍 Validating ${urlValidations.length} media URLs...`);
    validationResults.summary.totalUrls = urlValidations.length;
    
    for (const urlCheck of urlValidations) {
      try {
        const result = await validateDriveUrl(urlCheck.url, urlCheck.type);
        
        if (!result.valid) {
          validationResults.issues.push(`${urlCheck.location}: ${result.error}`);
        } else if (!result.accessible) {
          validationResults.issues.push(`${urlCheck.location}: ${result.error}`);
        } else if (!result.typeValid) {
          validationResults.issues.push(`${urlCheck.location}: ${result.typeError}`);
        } else {
          validationResults.summary.validUrls++;
        }
      } catch (error) {
        validationResults.issues.push(`${urlCheck.location}: Validation failed - ${error.message}`);
      }
    }

    // Step 7: Final validation summary
    if (validationResults.issues.length > 0) {
      validationResults.dataValid = false;
    }

    return validationResults;

  } catch (error) {
    validationResults.issues.push(`Validation failed: ${error.message}`);
    return validationResults;
  }
}

// Display validation results
function displayValidationResults(results) {
  console.log("\n" + "=".repeat(60));
  console.log("📊 VALIDATION RESULTS");
  console.log("=".repeat(60));
  
  console.log(`📋 Sheet Accessible: ${results.sheetAccessible ? '✅' : '❌'}`);
  console.log(`📑 Sheet Tab Exists: ${results.sheetTabExists ? '✅' : '❌'}`);
  console.log(`📝 Columns Valid: ${results.columnsValid ? '✅' : '❌'}`);
  console.log(`📊 Data Valid: ${results.dataValid ? '✅' : '❌'}`);
  
  console.log("\n📈 SUMMARY:");
  console.log(`   Total Activities: ${results.summary.totalActivities}`);
  console.log(`   Valid Activities: ${results.summary.validActivities}`);
  console.log(`   Duplicate Activities: ${results.summary.duplicateActivities}`);
  console.log(`   Total URLs: ${results.summary.totalUrls}`);
  console.log(`   Valid URLs: ${results.summary.validUrls}`);
  
  if (results.issues.length > 0) {
    console.log("\n❌ ISSUES FOUND:");
    results.issues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log("\n⚠️ WARNINGS:");
    results.warnings.forEach((warning, index) => {
      console.log(`   ${index + 1}. ${warning}`);
    });
  }
  
  console.log("=".repeat(60));
  
  if (results.dataValid) {
    console.log("🎉 VALIDATION SUCCESSFUL - Ready to process activities!");
  } else {
    console.log("💥 VALIDATION FAILED - Please fix the issues before proceeding.");
  }
  console.log("=".repeat(60) + "\n");
}

// Process activities by delegating to contentIngestionUtils
async function processActivities(activities, courseId) {
  let results = [];
  let successCount = 0;
  let errorCount = 0;

  for (const activity of activities) {
    if (activity.upload && activity.upload.toLowerCase() === "false") {
      try {
        console.log(`Processing ${activity.activityType} activity: ${activity.alias}`);
        
        const result = await contentIngestionUtils.processActivity(activity, courseId);
        
        if (result.success) {
          successCount++;
          console.log(`Successfully processed activity: ${activity.activityType}`);
        } else {
          errorCount++;
          console.error(`Error processing activity ${activity.activityType}:`, result.error);
        }
        
        results.push(result);
        
      } catch (activityError) {
        console.error(`Error processing activity ${activity.alias}:`, activityError);
        errorCount++;
        results.push({
          success: false,
          activity: activity.alias,
          error: activityError.message
        });
      }
    } else {
      console.log(`Skipping activity ${activity.alias} - upload flag not set to 'yes'`);
    }
  }

  console.log(`Processing Summary: ${successCount} successful, ${errorCount} errors`);
  return results;
}


// Validate ingestion function for API
const validateIngestion = async (spreadsheetId, sheetTitle = "Content Ingestion") => {
  try {
    console.log("🚀 Starting comprehensive sheet validation...");
    const validationResults = await validateSheetData(spreadsheetId, sheetTitle);
    
    // Convert validation results to string format for frontend
    const validationLog = formatValidationResultsAsString(validationResults);
    
    return {
      success: validationResults.dataValid,
      valid: validationResults.dataValid,
      log: validationLog,
      summary: validationResults.summary,
      issues: validationResults.issues,
      warnings: validationResults.warnings,
      details: {
        sheetAccessible: validationResults.sheetAccessible,
        sheetTabExists: validationResults.sheetTabExists,
        columnsValid: validationResults.columnsValid,
        dataValid: validationResults.dataValid
      }
    };
  } catch (error) {
    console.error("❌ Error in validation:", error);
    return {
      success: false,
      valid: false,
      log: `❌ Validation Error: ${error.message}`,
      summary: {
        totalActivities: 0,
        validActivities: 0,
        totalUrls: 0,
        validUrls: 0,
        duplicateActivities: 0
      },
      issues: [error.message],
      warnings: [],
      details: {
        sheetAccessible: false,
        sheetTabExists: false,
        columnsValid: false,
        dataValid: false
      }
    };
  }
};

// Process ingestion function for API
const processIngestion = async (courseId, spreadsheetId, sheetTitle = "Content Ingestion") => {
  try {
    // First validate the sheet
    // console.log("🚀 Starting sheet processing with validation...");
    // const validationResults = await validateSheetData(spreadsheetId, sheetTitle);
    
    // if (!validationResults.dataValid) {
    //   const validationLog = formatValidationResultsAsString(validationResults);
    //   return {
    //     success: false,
    //     log: validationLog,
    //     error: "Validation failed. Please fix the issues in the sheet before proceeding.",
    //     results: []
    //   };
    // }
    
    // console.log("🎯 Validation successful! Starting data processing...");
    
    // Proceed with processing if validation passed
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const authClient = await auth.getClient();

    const res = await sheets.spreadsheets.get({
      auth: authClient,
      spreadsheetId,
      ranges: [sheetTitle],
      includeGridData: true,
    });

    const sheet = res.data.sheets?.[0];
    const rows = sheet.data?.[0]?.rowData ?? [];

    let activities = [];
    let currentActivity = null;
    let currentQuestion = null;
    let currentDifficulty = null;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const cells = row.values || [];
      const get = (col) => cells[col]?.formattedValue?.trim() || "";

      // ---- ACTIVITY LEVEL ----
      if (get(COLUMNS.UPLOAD)) {
        if (currentActivity) {
          activities.push(currentActivity);
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
        };
        currentQuestion = null;
        currentDifficulty = null;
      }

      if (!currentActivity) continue;

      if (get(COLUMNS.WEEK_NO)) currentActivity.week = get(COLUMNS.WEEK_NO);
      if (get(COLUMNS.DAY_NO)) currentActivity.day = get(COLUMNS.DAY_NO);

      // ---- QUESTION LEVEL ----
      const qNo = get(COLUMNS.Q_NO);
      const qText = get(COLUMNS.Q_TEXT);
      const qVideo = get(COLUMNS.Q_VIDEO_LINK);
      const qAudio = get(COLUMNS.Q_AUDIO_LINK);
      const qImage = get(COLUMNS.Q_IMAGE_LINK);

      if (qNo) {
        currentQuestion = {
          qNo,
          qText,
          difficulties: [],
        };
        currentActivity.questions.push(currentQuestion);
        currentDifficulty = null;
      } else if (!currentQuestion && (qText || qVideo || qAudio || qImage)) {
        currentQuestion = {
          qNo: "",
          qText,
          difficulties: [],
        };
        currentActivity.questions.push(currentQuestion);
        currentDifficulty = null;
      } else if (currentQuestion && qText) {
        currentQuestion.qText = qText;
      }

      // ---- DIFFICULTY LEVEL - FIXED ----
      const difficulty = get(COLUMNS.DIFFICULTY_LEVEL);
      if (difficulty && currentQuestion) {
        let foundDifficulty = currentQuestion.difficulties.find(
          (d) => d.difficulty === difficulty
        );

        if (!foundDifficulty) {
          const videoUrl = get(COLUMNS.Q_VIDEO_LINK);
          const audioUrl = get(COLUMNS.Q_AUDIO_LINK);
          const imageUrl = get(COLUMNS.Q_IMAGE_LINK);

          foundDifficulty = {
            difficulty,
            qVideo: videoUrl ? await getDriveMediaUrl(videoUrl) : null,
            qAudio: audioUrl ? await getDriveMediaUrl(audioUrl) : null,
            qImage: imageUrl ? await getDriveMediaUrl(imageUrl) : null,
            answers: [],
          };
          currentQuestion.difficulties.push(foundDifficulty);
        }
        currentDifficulty = foundDifficulty;
      } else if (!difficulty && currentQuestion && (qVideo || qAudio || qImage)) {
        if (!currentDifficulty) {
          currentDifficulty = {
            difficulty: "",
            qVideo: qVideo ? await getDriveMediaUrl(qVideo) : null,
            qAudio: qAudio ? await getDriveMediaUrl(qAudio) : null,
            qImage: qImage ? await getDriveMediaUrl(qImage) : null,
            answers: [],
          };
          currentQuestion.difficulties.push(currentDifficulty);
        }
      }

      // ---- ANSWERS LEVEL - FIXED ----
      const hasAnswerData =
        get(COLUMNS.ANSWER) !== "" ||
        get(COLUMNS.CF_TEXT) !== "" ||
        get(COLUMNS.CF_IMAGE) !== "" ||
        get(COLUMNS.CF_AUDIO) !== "";

      if (hasAnswerData && currentQuestion) {
        if (!currentDifficulty) {
          currentDifficulty = {
            difficulty: "",
            qVideo: qVideo ? await getDriveMediaUrl(qVideo) : null,
            qAudio: qAudio ? await getDriveMediaUrl(qAudio) : null,
            qImage: qImage ? await getDriveMediaUrl(qImage) : null,
            answers: [],
          };
          currentQuestion.difficulties.push(currentDifficulty);
        }

        const cfImageUrl = get(COLUMNS.CF_IMAGE);
        const cfAudioUrl = get(COLUMNS.CF_AUDIO);

        const answerCell = cells[COLUMNS.ANSWER];
        const bg = answerCell?.effectiveFormat?.backgroundColor;
        const isCorrect = isCellHighlighted(bg);

        currentDifficulty.answers.push({
          aText: get(COLUMNS.ANSWER) || "",
          cfText: get(COLUMNS.CF_TEXT) || "",
          cfImage: cfImageUrl ? await getDriveMediaUrl(cfImageUrl) : null,
          cfAudio: cfAudioUrl ? await getDriveMediaUrl(cfAudioUrl) : null,
          isCorrect,
        });
      }
    }

    if (currentActivity) activities.push(currentActivity);

    const processResults = await processActivities(activities, courseId);
    
    return {
      success: true,
      log: "🎯 Sheet processing completed successfully!",
      results: processResults
    };
    
  } catch (error) {
    console.error("❌ Error in processing:", error);
    return {
      success: false,
      log: `❌ Processing Error: ${error.message}`,
      error: error.message,
      results: []
    };
  }
};

// Format validation results as string for frontend display
function formatValidationResultsAsString(results) {
  let log = "";
  
  log += "=".repeat(60) + "\n";
  log += "📊 VALIDATION RESULTS\n";
  log += "=".repeat(60) + "\n";
  
  log += `📋 Sheet Accessible: ${results.sheetAccessible ? '✅' : '❌'}\n`;
  log += `📑 Sheet Tab Exists: ${results.sheetTabExists ? '✅' : '❌'}\n`;
  log += `📝 Columns Valid: ${results.columnsValid ? '✅' : '❌'}\n`;
  log += `📊 Data Valid: ${results.dataValid ? '✅' : '❌'}\n`;
  
  log += "\n📈 SUMMARY:\n";
  log += `   Total Activities: ${results.summary.totalActivities}\n`;
  log += `   Valid Activities: ${results.summary.validActivities}\n`;
  log += `   Duplicate Activities: ${results.summary.duplicateActivities}\n`;
  log += `   Total URLs: ${results.summary.totalUrls}\n`;
  log += `   Valid URLs: ${results.summary.validUrls}\n`;
  
  if (results.issues.length > 0) {
    log += "\n❌ ISSUES FOUND:\n";
    results.issues.forEach((issue, index) => {
      log += `   ${index + 1}. ${issue}\n`;
    });
  }
  
  if (results.warnings.length > 0) {
    log += "\n⚠️ WARNINGS:\n";
    results.warnings.forEach((warning, index) => {
      log += `   ${index + 1}. ${warning}\n`;
    });
  }
  
  log += "=".repeat(60) + "\n";
  
  if (results.dataValid) {
    log += "🎉 VALIDATION SUCCESSFUL - Ready to process activities!\n";
  } else {
    log += "💥 VALIDATION FAILED - Please fix the issues before proceeding.\n";
  }
  log += "=".repeat(60) + "\n";
  
  return log;
}


export { validateIngestion, processIngestion, validateSheetData, displayValidationResults };

export default { validateIngestion, processIngestion, masterSheetUtils };