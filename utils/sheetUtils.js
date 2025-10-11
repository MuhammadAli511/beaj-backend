import { google } from "googleapis"
import { readFile } from "fs/promises";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { createWriteStream, createReadStream, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import azureBlobStorage from "./azureBlobStorage.js";
import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import sharp from "sharp";

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

// Helper to get service account email
const getServiceAccountEmail = async () => {
    try {
        const creds = JSON.parse(await readFile(new URL("../my_cred.json", import.meta.url), "utf-8"));
        return creds.client_email || null;
    } catch (error) {
        return null;
    }
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
        // Check specifically for permission errors (403 or 404)
        if (error.code === 403 || error.code === 404) {
            return {
                valid: true,
                accessible: false,
                needsPermission: true,
                error: `No view access to file. Please grant view access to the service account.`,
                fileUrl: driveUrl
            }
        }
        
        // Other errors (network issues, etc.)
        return {
            valid: true,
            accessible: false,
            needsPermission: false,
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

// Function to compress video if it's larger than 10MB
const compressVideo = async (videoFileObject, compress_size = "10MB") => {

    // Convert compress_size (string like "10MB", "100KB") → numeric MB value
  let compressSizeStr = String(compress_size).toLowerCase().trim();
  let MAX_SIZE_MB = 10; // default

  const sizeMatch = compressSizeStr.match(/^([\d.]+)\s*(mb|kb)$/i);
  if (sizeMatch) {
    const value = parseFloat(sizeMatch[1]);
    const unit = sizeMatch[2];
    MAX_SIZE_MB = unit === "kb" ? value / 1024 : value; // KB → MB conversion
  }

  const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

  try {
    const timestamp = Date.now();
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const fileNameFinal = `${timestamp}_${randomDigits}.mp4`;

    const videoSizeMB = (videoFileObject.size / (1024 * 1024)).toFixed(2);
    console.log(`Video size: ${videoSizeMB}MB`);

    // If already below target size → upload directly
    if (videoFileObject.size <= MAX_SIZE_BYTES) {
      console.log(`Video under ${MAX_SIZE_MB}MB, uploading without compression`);
      return await azureBlobStorage.uploadToBlobStorage(
        videoFileObject.buffer,
        fileNameFinal,
        "video/mp4"
      );
    }

    // Create temp paths
    const tempInputPath = join(tmpdir(), `input_${timestamp}_${randomDigits}.mp4`);
    const tempOutputPath = join(tmpdir(), `output_${timestamp}_${randomDigits}.mp4`);

    // Write buffer to temp file
    await new Promise((resolve, reject) => {
      const stream = createWriteStream(tempInputPath);
      stream.write(videoFileObject.buffer);
      stream.end();
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    console.log(`Compression target: ${MAX_SIZE_MB}MB`);

    // Calculate proportional compression ratio
    const targetSizeRatio = MAX_SIZE_MB / (videoFileObject.size / (1024 * 1024));
    const estimatedCRF = Math.min(40, Math.max(25, 32 / targetSizeRatio)); // adaptive CRF
    const targetResolution = targetSizeRatio < 0.3 ? 360 : 480; // lower resolution if big reduction needed

    console.log(`Target CRF: ${estimatedCRF.toFixed(1)}, scale=${targetResolution}p`);

    await new Promise((resolve, reject) => {
      ffmpeg(tempInputPath)
        .output(tempOutputPath)
        .videoCodec("libx264")
        .audioCodec("aac")
        .outputOptions([
          "-preset", "medium",
          "-crf", `${estimatedCRF}`,
          "-movflags", "+faststart",
          "-maxrate", `${Math.floor(800 * targetSizeRatio)}k`,
          "-bufsize", `${Math.floor(1600 * targetSizeRatio)}k`,
          "-vf", `scale=-2:${targetResolution}`,
          "-r", "24",
          "-g", "48",
          "-pix_fmt", "yuv420p"
        ])
        .audioBitrate(`${Math.floor(96 * targetSizeRatio)}k`)
        .audioChannels(1)
        .audioFrequency(44100)
        .on("end", () => {
          console.log("Video compression completed successfully");
          resolve();
        })
        .on("error", (err) => {
          console.error("Video compression failed:", err.message);
          reject(err);
        })
        .run();
    });

    // Read compressed buffer
    const compressedBuffer = await new Promise((resolve, reject) => {
      const chunks = [];
      const readStream = createReadStream(tempOutputPath);
      readStream.on("data", (chunk) => chunks.push(chunk));
      readStream.on("end", () => resolve(Buffer.concat(chunks)));
      readStream.on("error", reject);
    });

    const finalSizeMB = (compressedBuffer.length / (1024 * 1024)).toFixed(2);
    console.log(`Final video size: ${finalSizeMB}MB`);

    // If final size still larger than limit, optionally retry smaller res
    if (compressedBuffer.length > MAX_SIZE_BYTES) {
      console.warn(
        `Video still above ${MAX_SIZE_MB}MB (${finalSizeMB}MB), reattempting with stronger compression...`
      );

      // Retry once more with lower scale and higher CRF
      const retryOutputPath = join(tmpdir(), `retry_${timestamp}_${randomDigits}.mp4`);
      await new Promise((resolve, reject) => {
        ffmpeg(tempInputPath)
          .output(retryOutputPath)
          .videoCodec("libx264")
          .audioCodec("aac")
          .outputOptions([
            "-preset", "medium",
            "-crf", "38",
            "-movflags", "+faststart",
            "-maxrate", "600k",
            "-bufsize", "1.2M",
            "-vf", "scale=-2:360",
            "-r", "20",
            "-pix_fmt", "yuv420p"
          ])
          .audioBitrate("64k")
          .audioChannels(1)
          .audioFrequency(22050)
          .on("end", resolve)
          .on("error", reject)
          .run();
      });

      const retryBuffer = await new Promise((resolve, reject) => {
        const chunks = [];
        const readStream = createReadStream(retryOutputPath);
        readStream.on("data", (chunk) => chunks.push(chunk));
        readStream.on("end", () => resolve(Buffer.concat(chunks)));
        readStream.on("error", reject);
      });

      console.log(`Retry result size: ${(retryBuffer.length / (1024 * 1024)).toFixed(2)}MB`);
      if (retryBuffer.length < compressedBuffer.length) {
        console.log("Retry succeeded in reducing size further");
        compressedBuffer.set(retryBuffer);
      }

      if (existsSync(retryOutputPath)) unlinkSync(retryOutputPath);
    }

    // Upload to Azure
    const uploadedUrl = await azureBlobStorage.uploadToBlobStorage(
      compressedBuffer,
      fileNameFinal,
      "video/mp4"
    );

    // Cleanup
    try {
      if (existsSync(tempInputPath)) unlinkSync(tempInputPath);
      if (existsSync(tempOutputPath)) unlinkSync(tempOutputPath);
    } catch (cleanupErr) {
      console.warn("🧹 Cleanup warning:", cleanupErr.message);
    }

    return uploadedUrl;

  } catch (err) {
    console.error("Video compression error:", err.message);
    throw new Error(`Failed to compress video: ${err.message}`);
  }
};

// Function to compress audio if it's larger than 10MB
const compressAudio = async (audioFileObject) => {
    const MAX_SIZE_MB = 10;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    try {
        const timestamp = Date.now();
        const randomDigits = Math.floor(100000 + Math.random() * 900000);
        const fileNameFinal = `${timestamp}_${randomDigits}.mp3`;

        // Check if compression is needed
        if (audioFileObject.size <= MAX_SIZE_BYTES) {
            console.log('Audio is already under 10MB, uploading without compression');
            return await azureBlobStorage.uploadToBlobStorage(audioFileObject.buffer, fileNameFinal, "audio/mpeg");
        }

        console.log(`Audio size: ${(audioFileObject.size / (1024 * 1024)).toFixed(2)}MB - compression needed`);

        // Create temporary files
        const tempInputPath = join(tmpdir(), `input_${timestamp}_${randomDigits}.audio`);
        const tempOutputPath = join(tmpdir(), `output_${timestamp}_${randomDigits}.mp3`);

        // Write input buffer to temporary file
        const inputStream = createWriteStream(tempInputPath);
        inputStream.write(audioFileObject.buffer);
        inputStream.end();

        await new Promise((resolve, reject) => {
            inputStream.on('finish', resolve);
            inputStream.on('error', reject);
        });

        // Try multiple compression strategies to achieve target size
        const AUDIO_TARGET_MB = 5;
        const AUDIO_TARGET_BYTES = AUDIO_TARGET_MB * 1024 * 1024;
        let compressionSuccessful = false;
        let finalOutputPath = tempOutputPath;

        // Strategy 1: Ultra-aggressive MP3 compression for 5MB target
        try {
            console.log('Attempting ultra-aggressive MP3 compression for 5MB target...');
            await new Promise((resolve, reject) => {
                ffmpeg(tempInputPath)
                    .output(tempOutputPath)
                    .audioCodec('libmp3lame')
                    .audioBitrate('24k') // Very low bitrate for 5MB target
                    .audioChannels(1) // Mono
                    .audioFrequency(12000) // Low sample rate
                    .outputOptions(['-f', 'mp3', '-compression_level', '9', '-q:a', '9']) // Maximum compression, lowest quality
                    .on('end', () => {
                        console.log('Ultra-aggressive MP3 compression completed');
                        compressionSuccessful = true;
                        resolve();
                    })
                    .on('error', (err) => {
                        console.log('Ultra-aggressive MP3 failed, trying extreme compression...');
                        reject(err);
                    })
                    .run();
            });

            // Check if Strategy 1 result meets target
            const strategy1Buffer = await new Promise((resolve, reject) => {
                const chunks = [];
                const readStream = createReadStream(tempOutputPath);
                readStream.on('data', (chunk) => chunks.push(chunk));
                readStream.on('end', () => resolve(Buffer.concat(chunks)));
                readStream.on('error', reject);
            });

            console.log(`Strategy 1 result: ${(strategy1Buffer.length / (1024 * 1024)).toFixed(2)}MB`);
            if (strategy1Buffer.length <= AUDIO_TARGET_BYTES) {
                console.log('Strategy 1 achieved target size!');
                finalOutputPath = tempOutputPath;
            } else {
                console.log('Strategy 1 result still over target, trying Strategy 2...');
                compressionSuccessful = false; // Reset to try next strategy
            }
        } catch (strategy1Error) {
            console.log('Strategy 1 failed, trying Strategy 2...');
            compressionSuccessful = false;
        }

        // Strategy 2: Extreme AAC compression (if Strategy 1 didn't meet target)
        if (!compressionSuccessful) {
            try {
                const aacOutputPath = join(tmpdir(), `output_aac_${timestamp}_${randomDigits}.mp3`);
                console.log('Attempting extreme AAC compression...');
                await new Promise((resolve, reject) => {
                    ffmpeg(tempInputPath)
                        .output(aacOutputPath)
                        .audioCodec('aac')
                        .audioBitrate('16k') // Extremely low bitrate for 5MB target
                        .audioChannels(1) // Mono
                        .audioFrequency(8000) // Very low sample rate
                        .outputOptions(['-f', 'mp3', '-strict', 'experimental', '-b:a', '16k'])
                        .on('end', () => {
                            console.log('Extreme AAC to MP3 compression completed');
                            compressionSuccessful = true;
                            resolve();
                        })
                        .on('error', (err) => {
                            console.log('AAC failed, trying emergency MP3 codec...');
                            reject(err);
                        })
                        .run();
                });

                // Check if Strategy 2 result meets target
                const strategy2Buffer = await new Promise((resolve, reject) => {
                    const chunks = [];
                    const readStream = createReadStream(aacOutputPath);
                    readStream.on('data', (chunk) => chunks.push(chunk));
                    readStream.on('end', () => resolve(Buffer.concat(chunks)));
                    readStream.on('error', reject);
                });

                console.log(`Strategy 2 result: ${(strategy2Buffer.length / (1024 * 1024)).toFixed(2)}MB`);
                if (strategy2Buffer.length <= AUDIO_TARGET_BYTES) {
                    console.log('Strategy 2 achieved target size!');
                    finalOutputPath = aacOutputPath;
                } else {
                    console.log('Strategy 2 result still over target, trying Strategy 3...');
                    compressionSuccessful = false; // Reset to try next strategy
                }
            } catch (strategy2Error) {
                console.log('Strategy 2 failed, trying Strategy 3...');
                compressionSuccessful = false;
            }
        }

        // Strategy 3: Emergency MP3 compression (last resort)
        if (!compressionSuccessful) {
            try {
                const emergencyOutputPath = join(tmpdir(), `output_emergency_${timestamp}_${randomDigits}.mp3`);
                console.log('Attempting emergency MP3 compression...');
                await new Promise((resolve, reject) => {
                    ffmpeg(tempInputPath)
                        .output(emergencyOutputPath)
                        .audioCodec('mp3')
                        .audioBitrate('12k') // Extremely low bitrate for emergency compression
                        .audioChannels(1) // Mono
                        .audioFrequency(6000) // Very low sample rate
                        .outputOptions(['-f', 'mp3', '-q:a', '9']) // Lowest quality
                        .on('end', () => {
                            console.log('Emergency MP3 compression completed');
                            compressionSuccessful = true;
                            resolve();
                        })
                        .on('error', (err) => {
                            console.log('All MP3 strategies failed - only MP3 output supported');
                            reject(err);
                        })
                        .run();
                });

                // Check if Strategy 3 result meets target
                const strategy3Buffer = await new Promise((resolve, reject) => {
                    const chunks = [];
                    const readStream = createReadStream(emergencyOutputPath);
                    readStream.on('data', (chunk) => chunks.push(chunk));
                    readStream.on('end', () => resolve(Buffer.concat(chunks)));
                    readStream.on('error', reject);
                });

                console.log(`Strategy 3 result: ${(strategy3Buffer.length / (1024 * 1024)).toFixed(2)}MB`);
                if (strategy3Buffer.length <= AUDIO_TARGET_BYTES) {
                    console.log('Strategy 3 achieved target size!');
                    finalOutputPath = emergencyOutputPath;
                } else {
                    console.log('Strategy 3 result still over target - all strategies failed');
                    compressionSuccessful = false;
                }
            } catch (strategy3Error) {
                console.log('Strategy 3 failed - all strategies failed');
                compressionSuccessful = false;
            }
        }

        if (!compressionSuccessful) {
            throw new Error('All audio compression strategies failed - only MP3 output supported');
        }

        // Read the final compressed audio
        const compressedBuffer = await new Promise((resolve, reject) => {
            const chunks = [];
            const readStream = createReadStream(finalOutputPath);

            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => resolve(Buffer.concat(chunks)));
            readStream.on('error', reject);
        });

        console.log(`Final compressed audio size: ${(compressedBuffer.length / (1024 * 1024)).toFixed(2)}MB`);

        // Final safety check - if compression made file larger, use original
        if (compressedBuffer.length >= audioFileObject.size) {
            console.log(`Warning: Compressed audio (${(compressedBuffer.length / (1024 * 1024)).toFixed(2)}MB) is larger than original (${(audioFileObject.size / (1024 * 1024)).toFixed(2)}MB). Using original file.`);
            const originalFileObject = {
                buffer: audioFileObject.buffer,
                size: audioFileObject.size,
                originalname: audioFileObject.originalname,
                mimetype: audioFileObject.mimetype
            };
            return await azureBlobStorage.uploadToBlobStorage(originalFileObject.buffer, fileNameFinal, "audio/mpeg");
        }

        // Create file object for upload with custom filename
        const compressedFileObject = {
            buffer: compressedBuffer,
            size: compressedBuffer.length,
            originalname: `${timestamp}_${randomDigits}.mp3`,
            mimetype: 'audio/mpeg'
        };

        // Upload to Azure blob storage
        const uploadedUrl = await azureBlobStorage.uploadToBlobStorage(compressedFileObject.buffer, fileNameFinal, "audio/mpeg");

        // Cleanup temporary files
        try {
            unlinkSync(tempInputPath);
            unlinkSync(tempOutputPath);
            // Also cleanup any alternative output files that might exist
            const aacPath = join(tmpdir(), `output_aac_${timestamp}_${randomDigits}.mp3`);
            const emergencyPath = join(tmpdir(), `output_emergency_${timestamp}_${randomDigits}.mp3`);
            if (fs.existsSync(aacPath)) unlinkSync(aacPath);
            if (fs.existsSync(emergencyPath)) unlinkSync(emergencyPath);
        } catch (cleanupError) {
            console.warn('Failed to cleanup temporary files:', cleanupError.message);
        }

        return uploadedUrl;

    } catch (error) {
        console.error('Audio compression error:', error);

        // Cleanup temporary files in case of error
        try {
            const timestamp = Date.now();
            const randomDigits = Math.floor(100000 + Math.random() * 900000);
            const tempInputPath = join(tmpdir(), `input_${timestamp}_${randomDigits}.audio`);
            const tempOutputPath = join(tmpdir(), `output_${timestamp}_${randomDigits}.mp3`);
            if (existsSync(tempInputPath)) unlinkSync(tempInputPath);
            if (existsSync(tempOutputPath)) unlinkSync(tempOutputPath);
        } catch (cleanupError) {
            // Ignore cleanup errors during error handling
        }

        throw new Error(`Failed to compress audio: ${error.message}`);
    }
};

// Function to compress image if it's larger than 1MB
const compressImage = async (imageFileObject) => {
    if(imageFileObject.mimetype === 'image/webp') {
        return compressSticker(imageFileObject);
    }
    const MAX_SIZE_MB = 1;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    try {
        const timestamp = Date.now();
        const randomDigits = Math.floor(100000 + Math.random() * 900000);
        const fileNameFinal = `${timestamp}_${randomDigits}.jpg`;

        // Check if compression is needed
        if (imageFileObject.size <= MAX_SIZE_BYTES) {
            console.log('Image is already under 1MB, uploading without compression');
            return await azureBlobStorage.uploadToBlobStorage(imageFileObject.buffer, fileNameFinal, "image/jpeg");
        }

        console.log(`Image size: ${(imageFileObject.size / (1024 * 1024)).toFixed(2)}MB - compression needed`);

        // Load image using canvas
        const image = await loadImage(imageFileObject.buffer);

        console.log(`Original dimensions: ${image.width}x${image.height} (preserving dimensions)`);

        // Create canvas with original dimensions
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');

        // Draw image at original size
        ctx.drawImage(image, 0, 0, image.width, image.height);

        // Try different quality levels until we get under the size limit
        let quality = 0.8;
        let compressedBuffer;
        let attempts = 0;
        const maxAttempts = 5;

        do {
            compressedBuffer = canvas.toBuffer('image/jpeg', { quality });
            console.log(`Attempt ${attempts + 1}: Quality ${quality}, Size: ${(compressedBuffer.length / (1024 * 1024)).toFixed(2)}MB`);

            if (compressedBuffer.length <= MAX_SIZE_BYTES) {
                break;
            }

            quality -= 0.1; // Reduce quality by 10% each attempt
            attempts++;
        } while (quality > 0.1 && attempts < maxAttempts);

        // If still too large after quality reduction, try progressive JPEG with lower quality
        if (compressedBuffer.length > MAX_SIZE_BYTES) {
            console.log('Trying progressive JPEG with lower quality...');
            compressedBuffer = canvas.toBuffer('image/jpeg', {
                quality: 0.5,
                progressive: true,
                chromaSubsampling: '4:2:0'
            });
            console.log(`Final progressive JPEG size: ${(compressedBuffer.length / (1024 * 1024)).toFixed(2)}MB`);
        }

        // Final check before uploading - if still too large, throw error
        if (compressedBuffer.length > MAX_SIZE_BYTES) {
            throw new Error(`Image compression failed: Could not reduce image below ${MAX_SIZE_MB}MB limit after trying all quality levels and progressive JPEG`);
        }

        // Create file object for upload with custom filename
        const compressedFileObject = {
            buffer: compressedBuffer,
            size: compressedBuffer.length,
            originalname: `${timestamp}_${randomDigits}.jpg`,
            mimetype: 'image/jpeg'
        };

        // Upload to Azure blob storage
        const uploadedUrl = await azureBlobStorage.uploadToBlobStorage(compressedFileObject.buffer, fileNameFinal, "image/jpeg");

        console.log(`Final compressed image size: ${(compressedBuffer.length / (1024 * 1024)).toFixed(2)}MB`);

        // Check if final compressed image meets target size
        const IMAGE_TARGET_MB = 1;
        const IMAGE_TARGET_BYTES = IMAGE_TARGET_MB * 1024 * 1024;

        if (compressedBuffer.length >= IMAGE_TARGET_BYTES) {
            throw new Error(`Image compression failed: Final size ${(compressedBuffer.length / (1024 * 1024)).toFixed(2)}MB exceeds ${IMAGE_TARGET_MB}MB target limit`);
        }

        // Additional safety check - if compression made file larger, throw error
        if (compressedBuffer.length >= imageFileObject.size) {
            console.log(`Warning: Compressed image (${(compressedBuffer.length / (1024 * 1024)).toFixed(2)}MB) is larger than original (${(imageFileObject.size / (1024 * 1024)).toFixed(2)}MB)`);
            // Check if original file meets target
            if (imageFileObject.size >= IMAGE_TARGET_BYTES) {
                throw new Error(`Original image file ${(imageFileObject.size / (1024 * 1024)).toFixed(2)}MB exceeds ${IMAGE_TARGET_MB}MB target limit`);
            }
        }

        return uploadedUrl;

    } catch (error) {
        console.error('Image compression error:', error);
        throw new Error(`Failed to compress image: ${error.message}`);
    }
};


const parseStartEndInstruction = async (cellValue) => {
    if (!cellValue || typeof cellValue !== "string") return {};

    const lines = cellValue
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean);

    const result = {
        textInstruction: null,
        textInstructionCaption: null,
        imageInstruction: null,
        imageInstructionCaption: null,
        audioInstruction: null,
        audioInstructionCaption: null,
        videoInstruction: null,
        videoInstructionCaption: null,
        videoSize: null,
        pdfInstruction: null,
        pdfInstructionCaption: null,
    };

    for (const line of lines) {
        // Match pattern with optional Caption and Size (in any order)
        const match = line.match(
            /^(\w+):\s*(https?:\/\/[^\s]+)(?:\s*\(Caption:\s*([^)]+)\))?(?:\s*\(Size:\s*([^)]+)\))?/i
        );

        if (!match) continue;

        let [, type, value, caption, size] = match;
        type = type.toLowerCase().trim();
        value = value?.trim() || null;
        caption = caption?.trim() || null;
        size = size?.trim() || null;

        switch (type) {
            case "text":
                if (value) result.textInstruction = value;
                if (caption) result.textInstructionCaption = caption;
                break;

            case "image":
                if (value) result.imageInstruction = value;
                if (caption) result.imageInstructionCaption = caption;
                break;

            case "audio":
                if (value) result.audioInstruction = value;
                if (caption) result.audioInstructionCaption = caption;
                break;

            case "video":
                if (value) result.videoInstruction = value;
                if (caption) result.videoInstructionCaption = caption;
                if (size) result.videoSize = size;
                break;

            case "pdf":
                if (value) result.pdfInstruction = value;
                if (caption) result.pdfInstructionCaption = caption;
                break;
        }
    }

    return result;
};

const isAnswerBold = (answerCell) => {
    if (!answerCell) return false;

    // Method 1: Check if entire cell is bold (when there are no textFormatRuns)
    // This is the most common case for uniformly formatted cells
    if (!answerCell.textFormatRuns || answerCell.textFormatRuns.length === 0) {
        // Check effectiveFormat first (this includes inherited formatting)
        if (answerCell.effectiveFormat?.textFormat?.bold === true) {
            return true;
        }
        // Check userEnteredFormat as fallback
        if (answerCell.userEnteredFormat?.textFormat?.bold === true) {
            return true;
        }
        return false;
    }

    // Method 2: Check textFormatRuns for partially formatted cells
    // If textFormatRuns exist, check if any run has bold formatting
    for (const run of answerCell.textFormatRuns) {
        if (run.format?.bold === true) {
            return true;
        }
    }

    return false;
};


// const isAnswerBold = (cellText, answerText, textRuns) => {
//     if (!cellText || !answerText || !Array.isArray(textRuns)) return false;

//     const startIndex = cellText.indexOf(answerText);
//     if (startIndex === -1) return false;
//     const endIndex = startIndex + answerText.length;

//     for (const run of textRuns) {
//         const runStart = run.startIndex ?? 0;
//         const runBold = run.format?.bold === true;

//         if (runStart >= startIndex && runStart < endIndex && runBold) {
//             return true;
//         }
//     }
//     return false;
// };

const compressSticker = async (stickerFileObject) => {
    const MAX_SIZE_KB = 100;
    const MAX_SIZE_BYTES = MAX_SIZE_KB * 1024;

    if (!stickerFileObject || !stickerFileObject.buffer) {
        throw new Error("Invalid sticker file object (missing buffer)");
    }

    const timestamp = Date.now();
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const fileNameFinal = `${timestamp}_${randomDigits}.webp`;

    const originalSizeKB = (stickerFileObject.buffer.length / 1024).toFixed(2);
    console.log(`Sticker size: ${originalSizeKB}KB`);

    // Case 1: Already under 100KB
    if (stickerFileObject.buffer.length <= MAX_SIZE_BYTES) {
        return await azureBlobStorage.uploadToBlobStorage(
            stickerFileObject.buffer,
            fileNameFinal,
            "image/webp"
        );
    }

    // Case 2: Compress with sharp
    let quality = 90;
    let compressedBuffer = await sharp(stickerFileObject.buffer)
        .webp({ quality })
        .toBuffer();

    let attempts = 0;
    while (compressedBuffer.length > MAX_SIZE_BYTES && quality > 10 && attempts < 8) {
        quality -= 10;
        attempts++;
        compressedBuffer = await sharp(stickerFileObject.buffer)
            .webp({ quality })
            .toBuffer();
        console.log(
            `Quality Attempt ${attempts}: Quality=${quality}, Size=${(compressedBuffer.length / 1024).toFixed(2)}KB`
        );
    }

    // If still too large → resize
    let resizeAttempts = 0;
    let width = 512; // default resize base
    while (compressedBuffer.length > MAX_SIZE_BYTES && resizeAttempts < 5) {
        resizeAttempts++;
        width = Math.floor(width * 0.8);

        compressedBuffer = await sharp(stickerFileObject.buffer)
            .resize({ width })
            .webp({ quality })
            .toBuffer();

        console.log(
            `Resize Attempt ${resizeAttempts}: Width=${width}, Size=${(compressedBuffer.length / 1024).toFixed(2)}KB`
        );
    }

    if (compressedBuffer.length > MAX_SIZE_BYTES) {
        throw new Error(
            `Sticker compression failed: could not reduce below ${MAX_SIZE_KB}KB (final ${(compressedBuffer.length / 1024).toFixed(2)}KB)`
        );
    }

    // Upload to Azure
    const uploadedUrl = await azureBlobStorage.uploadToBlobStorage(
        compressedBuffer,
        fileNameFinal,
        "image/webp"
    );

    console.log(`Final sticker size: ${(compressedBuffer.length / 1024).toFixed(2)}KB`);
    return uploadedUrl;
};

const normalizeInt = (val) => {
  if (val === undefined || val === null || val === "") return null;
  return parseInt(val, 10);
};

const normalizeBool = (val) => {
  if (val === undefined || val === null || val === "") return false;
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    if (val.toLowerCase() === "true") return true;
    if (val.toLowerCase() === "false") return false;
  }
  return false;
};

const getVideoUrlAndSize = (cell) => {
    if (!cell) return { url: "", size: "" };
    
    let url = "";
    let size = "";
    
    // STEP 1: Extract the URL from smart chip or hyperlink
    if (cell.chipRuns && cell.chipRuns.length > 0) {
        for (const chipRun of cell.chipRuns) {
            const chip = chipRun.chip;
            if (chip?.richLinkProperties?.uri) {
                url = chip.richLinkProperties.uri.trim();
                break;
            }
        }
    } else if (cell.hyperlink) {
        url = cell.hyperlink.trim();
    } else {
        // Try to extract URL from formattedValue as fallback
        const formattedValue = cell.formattedValue?.trim() || "";
        const urlMatch = formattedValue.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
            url = urlMatch[0].trim();
        }
    }
    
    // STEP 2: Extract size from formattedValue (works for both chips and regular links)
    const formattedValue = cell.formattedValue?.trim() || "";
    
    // Pattern 1: (size: 9MB) or (size:9MB)
    let sizeMatch = formattedValue.match(/\(\s*size:\s*([^)]+)\)/i);
    if (sizeMatch) {
        size = sizeMatch[1].trim();
    } else {
        // Pattern 2: size: 9MB or size:9MB without parentheses
        sizeMatch = formattedValue.match(/size:\s*(\S+)/i);
        if (sizeMatch) {
            size = sizeMatch[1].trim();
        }
    }
    
    return { url, size };
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
    compressVideo,
    compressAudio,
    compressImage,
    parseStartEndInstruction,
    isAnswerBold,
    compressSticker,
    getServiceAccountEmail,
    normalizeInt,
    normalizeBool,
    getVideoUrlAndSize,
};