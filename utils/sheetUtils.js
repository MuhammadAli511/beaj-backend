import { google } from "googleapis"
import { readFile } from "fs/promises";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { createWriteStream, createReadStream, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import azureBlobStorage from "./azureBlobStorage.js";

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

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

// Function to compress video if it's larger than 15MB
const compressVideo = async (videoFileObject) => {
    const MAX_SIZE_MB = 15;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    try {
        // Check if compression is needed
        if (videoFileObject.size <= MAX_SIZE_BYTES) {
            console.log('Video is already under 15MB, uploading without compression');
            return await azureBlobStorage.uploadToBlobStorage(videoFileObject);
        }

        console.log(`Video size: ${(videoFileObject.size / (1024 * 1024)).toFixed(2)}MB - compression needed`);

        // Calculate compression ratio for proportional reduction
        // If 100MB needs to become 15MB, that's a reduction to 15% of original
        // We'll use this same percentage for all videos
        const targetSizeRatio = MAX_SIZE_MB / (videoFileObject.size / (1024 * 1024));
        console.log(`Target compression ratio: ${(targetSizeRatio * 100).toFixed(1)}%`);

        // Create temporary files
        const timestamp = Date.now();
        const randomDigits = Math.floor(100000 + Math.random() * 900000); // 6 digit random number
        const tempInputPath = join(tmpdir(), `input_${timestamp}_${randomDigits}.mp4`);
        const tempOutputPath = join(tmpdir(), `output_${timestamp}_${randomDigits}.mp4`);

        // Write input buffer to temporary file
        const inputStream = createWriteStream(tempInputPath);
        inputStream.write(videoFileObject.buffer);
        inputStream.end();

        await new Promise((resolve, reject) => {
            inputStream.on('finish', resolve);
            inputStream.on('error', reject);
        });

        // Compress video using ffmpeg
        await new Promise((resolve, reject) => {
            ffmpeg(tempInputPath)
                .output(tempOutputPath)
                .videoCodec('libx264')
                .audioCodec('aac')
                .outputOptions([
                    '-preset', 'medium',
                    '-crf', '28', // Higher CRF = more compression
                    '-movflags', '+faststart',
                    '-maxrate', '1M',
                    '-bufsize', '2M'
                ])
                .on('end', () => {
                    console.log('Video compression completed');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('FFmpeg compression error:', err);
                    reject(err);
                })
                .on('progress', (progress) => {
                    console.log(`Compression progress: ${progress.percent?.toFixed(1)}%`);
                })
                .run();
        });

        // Read compressed video
        const compressedBuffer = await new Promise((resolve, reject) => {
            const chunks = [];
            const readStream = createReadStream(tempOutputPath);

            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => resolve(Buffer.concat(chunks)));
            readStream.on('error', reject);
        });

        console.log(`Compressed video size: ${(compressedBuffer.length / (1024 * 1024)).toFixed(2)}MB`);

        // Create file object for upload with custom filename
        const compressedFileObject = {
            buffer: compressedBuffer,
            size: compressedBuffer.length,
            originalname: `${timestamp}_${randomDigits}.mp4`,
            mimetype: 'video/mp4'
        };

        // Upload to Azure blob storage
        const uploadedUrl = await azureBlobStorage.uploadToBlobStorage(compressedFileObject);

        // Cleanup temporary files
        try {
            unlinkSync(tempInputPath);
            unlinkSync(tempOutputPath);
        } catch (cleanupError) {
            console.warn('Failed to cleanup temporary files:', cleanupError.message);
        }

        return uploadedUrl;

    } catch (error) {
        console.error('Video compression error:', error);

        // Cleanup temporary files in case of error
        try {
            const timestamp = Date.now();
            const randomDigits = Math.floor(100000 + Math.random() * 900000);
            const tempInputPath = join(tmpdir(), `input_${timestamp}_${randomDigits}.mp4`);
            const tempOutputPath = join(tmpdir(), `output_${timestamp}_${randomDigits}.mp4`);
            unlinkSync(tempInputPath);
            unlinkSync(tempOutputPath);
        } catch (cleanupError) {
            // Ignore cleanup errors during error handling
        }

        throw new Error(`Failed to compress video: ${error.message}`);
    }
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
    getAuthSheetClient,
    compressVideo
};