import { google } from "googleapis"
import { readFile } from "fs/promises";

const getDriveObj = async () => {
    const creds = JSON.parse(await readFile(new URL("../my_cred.json", import.meta.url), "utf-8"));
    const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ["https://www.googleapis.com/auth/drive"],
    })

    const authClient = await auth.getClient();
    const drive = google.drive({ version: "v3", auth: authClient });
    return drive;
};

const getSheetsObj = async () => {
    const creds = JSON.parse(await readFile(new URL("../my_cred.json", import.meta.url), "utf-8"));
    const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: authClient });
    return sheets;
};

const getAuthSheetClient = async () => {
    const creds = JSON.parse(await readFile(new URL("../my_cred.json", import.meta.url), "utf-8"));
    const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return auth.getClient();
};

// Function to get the media URL from the Google Drive URL
const getDriveMediaUrl = async (driveUrl) => {
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
        const drive = await getDriveObj();


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
};

// Function to validate the Google Drive URL
const validateDriveUrl = async (driveUrl, expectedType = null) => {
    if (!driveUrl || driveUrl.trim() === "") return { valid: true, accessible: true }

    const fileId = extractFileId(driveUrl)
    if (!fileId) {
        return { valid: false, accessible: false, error: "Invalid Google Drive URL format" }
    }

    try {
        const drive = await getDriveObj();

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
};

// Function to validate the checkbox format
const isValidCheckbox = (value) => {
    if (!value) return true // Empty is valid (unchecked)
    const normalizedValue = value.toString().toLowerCase().trim()
    return ["true", "false", "yes", "no", "1", "0", "checked", "unchecked"].includes(normalizedValue)
};

// Function to validate if the text contains URLs
const containsUrl = (text) => {
    if (!text) return false
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|edu|gov)[^\s]*)/i
    return urlRegex.test(text)
};

// Function to validate if the cell is highlighted
const isCellHighlighted = (bg) => {
    if (!bg) return 0 // no color = white
    const r = bg.red ?? 1
    const g = bg.green ?? 1
    const b = bg.blue ?? 1

    // Google Sheets default white is {1,1,1}
    const isWhite = r > 0.99 && g > 0.99 && b > 0.99
    return !isWhite
};

// Function to validate if a value is numeric
const isNumeric = (value) => {
    if (!value || value === "") return false
    return !isNaN(value) && !isNaN(Number.parseFloat(value))
};


// Function to extract the file ID from the Google Drive URL
const extractFileId = (driveUrl = "") => {
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
};

// Function to convert the stream to a buffer
const streamToBuffer = (stream) => {
    return new Promise((resolve, reject) => {
        const chunks = []
        stream.on("data", (chunk) => chunks.push(chunk))
        stream.on("end", () => resolve(Buffer.concat(chunks)))
        stream.on("error", reject)
    })
};

export {
    getDriveMediaUrl,
    validateDriveUrl,
    isValidCheckbox,
    containsUrl,
    isCellHighlighted,
    isNumeric,
    extractFileId,
    streamToBuffer,
    getDriveObj,
    getSheetsObj,
    getAuthSheetClient
};