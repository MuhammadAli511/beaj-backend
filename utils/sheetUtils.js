import { google } from "googleapis"
import { readFile } from "fs/promises";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { createWriteStream, createReadStream, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import azureBlobStorage from "./azureBlobStorage.js";
import { createCanvas, loadImage } from "canvas";

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

// Function to compress video if it's larger than 10MB
const compressVideo = async (videoFileObject) => {
    const MAX_SIZE_MB = 10;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    try {
        const timestamp = Date.now();
        const randomDigits = Math.floor(100000 + Math.random() * 900000);
        const fileNameFinal = `${timestamp}_${randomDigits}.mp4`;

        // Check if compression is needed
        if (videoFileObject.size <= MAX_SIZE_BYTES) {
            console.log('Video is already under 10MB, uploading without compression');
            return await azureBlobStorage.uploadToBlobStorage(videoFileObject.buffer, fileNameFinal, "video/mp4");
        }

        console.log(`Video size: ${(videoFileObject.size / (1024 * 1024)).toFixed(2)}MB - compression needed`);

        // Calculate compression ratio for proportional reduction
        // If 100MB needs to become 10MB, that's a reduction to 10% of original
        // We'll use this same percentage for all videos
        const targetSizeRatio = MAX_SIZE_MB / (videoFileObject.size / (1024 * 1024));
        console.log(`Target compression ratio: ${(targetSizeRatio * 100).toFixed(1)}%`);

        // Create temporary files
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

        // Try multiple compression strategies to achieve target size
        let compressionSuccessful = false;
        let finalOutputPath = tempOutputPath;

        // Strategy 1: Ultra-aggressive compression
        try {
            console.log('Attempting ultra-aggressive video compression...');
            await new Promise((resolve, reject) => {
                ffmpeg(tempInputPath)
                    .output(tempOutputPath)
                    .videoCodec('libx264')
                    .audioCodec('aac')
                    .outputOptions([
                        '-preset', 'veryslow', // Maximum compression quality
                        '-crf', '45', // Very high CRF for maximum compression
                        '-movflags', '+faststart',
                        '-maxrate', '400k', // Very low max bitrate
                        '-bufsize', '800k', // Low buffer size
                        '-vf', 'scale=-2:360', // Scale to 360p height max for maximum compression
                        '-r', '15', // Very low frame rate
                        '-g', '30', // Keyframe interval
                        '-keyint_min', '15', // Minimum keyframe interval
                        '-sc_threshold', '0', // Disable scene change detection
                        '-pix_fmt', 'yuv420p' // Standard pixel format
                    ])
                    .audioBitrate('48k') // Very low audio bitrate
                    .audioChannels(1) // Mono audio
                    .audioFrequency(22050) // Lower sample rate
                    .on('end', () => {
                        console.log('Ultra-aggressive video compression completed');
                        compressionSuccessful = true;
                        resolve();
                    })
                    .on('error', (err) => {
                        console.log('Ultra-aggressive compression failed, trying maximum compression...');
                        reject(err);
                    })
                    .on('progress', (progress) => {
                        console.log(`Ultra-aggressive compression progress: ${progress.percent?.toFixed(1)}%`);
                    })
                    .run();
            });
        } catch (aggressiveError) {
            console.log('Aggressive compression failed, trying very aggressive settings...');

            // Strategy 2: Maximum compression (lowest quality)
            try {
                const veryAggressiveOutputPath = join(tmpdir(), `output_very_aggressive_${timestamp}_${randomDigits}.mp4`);
                await new Promise((resolve, reject) => {
                    ffmpeg(tempInputPath)
                        .output(veryAggressiveOutputPath)
                        .videoCodec('libx264')
                        .audioCodec('aac')
                        .outputOptions([
                            '-preset', 'ultrafast', // Fast encoding for maximum compression
                            '-crf', '51', // Maximum CRF for maximum compression (almost lossy)
                            '-movflags', '+faststart',
                            '-maxrate', '250k', // Extremely low bitrate
                            '-bufsize', '500k',
                            '-vf', 'scale=-2:240', // Scale to 240p for maximum compression
                            '-r', '10', // Very low frame rate
                            '-g', '20',
                            '-keyint_min', '10',
                            '-pix_fmt', 'yuv420p',
                            '-sc_threshold', '0' // Disable scene change detection
                        ])
                        .audioBitrate('32k') // Extremely low audio bitrate
                        .audioChannels(1) // Mono audio
                        .audioFrequency(16000) // Very low sample rate
                        .on('end', () => {
                            console.log('Maximum compression video completed');
                            compressionSuccessful = true;
                            finalOutputPath = veryAggressiveOutputPath;
                            resolve();
                        })
                        .on('error', (err) => {
                            console.log('Maximum compression failed, trying basic compression...');
                            reject(err);
                        })
                        .on('progress', (progress) => {
                            console.log(`Maximum compression progress: ${progress.percent?.toFixed(1)}%`);
                        })
                        .run();
                });
            } catch (veryAggressiveError) {
                console.log('Very aggressive compression failed, trying basic approach...');

                // Strategy 3: Emergency compression (last resort, very low quality)
                try {
                    const basicOutputPath = join(tmpdir(), `output_basic_${timestamp}_${randomDigits}.mp4`);
                    await new Promise((resolve, reject) => {
                        ffmpeg(tempInputPath)
                            .output(basicOutputPath)
                            .videoCodec('libx264')
                            .audioCodec('aac')
                            .outputOptions([
                                '-preset', 'ultrafast',
                                '-crf', '40', // High CRF for compression
                                '-movflags', '+faststart',
                                '-maxrate', '300k',
                                '-bufsize', '600k',
                                '-vf', 'scale=-2:320', // Scale to 320p
                                '-r', '12', // Low frame rate
                                '-g', '24',
                                '-keyint_min', '12'
                            ])
                            .audioBitrate('40k') // Low audio bitrate
                            .audioChannels(1) // Mono
                            .audioFrequency(22050)
                            .on('end', () => {
                                console.log('Emergency video compression completed');
                                compressionSuccessful = true;
                                finalOutputPath = basicOutputPath;
                                resolve();
                            })
                            .on('error', (err) => {
                                console.error('All video compression strategies failed');
                                reject(err);
                            })
                            .on('progress', (progress) => {
                                console.log(`Emergency compression progress: ${progress.percent?.toFixed(1)}%`);
                            })
                            .run();
                    });
                } catch (basicError) {
                    throw new Error('All video compression strategies failed');
                }
            }
        }

        if (!compressionSuccessful) {
            throw new Error('Video compression failed with all strategies');
        }

        // Read compressed video
        const compressedBuffer = await new Promise((resolve, reject) => {
            const chunks = [];
            const readStream = createReadStream(finalOutputPath);

            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => resolve(Buffer.concat(chunks)));
            readStream.on('error', reject);
        });

        console.log(`Compressed video size: ${(compressedBuffer.length / (1024 * 1024)).toFixed(2)}MB`);

        // Check if compression actually reduced file size and meets target
        const VIDEO_TARGET_MB = 10;
        const VIDEO_TARGET_BYTES = VIDEO_TARGET_MB * 1024 * 1024;

        if (compressedBuffer.length >= VIDEO_TARGET_BYTES) {
            throw new Error(`Video compression failed: Final size ${(compressedBuffer.length / (1024 * 1024)).toFixed(2)}MB exceeds ${VIDEO_TARGET_MB}MB target limit`);
        }

        if (compressedBuffer.length >= videoFileObject.size) {
            console.log(`Warning: Compressed video (${(compressedBuffer.length / (1024 * 1024)).toFixed(2)}MB) is larger than original (${(videoFileObject.size / (1024 * 1024)).toFixed(2)}MB). Using original file.`);
            // Check if original file meets target
            if (videoFileObject.size >= VIDEO_TARGET_BYTES) {
                throw new Error(`Original video file ${(videoFileObject.size / (1024 * 1024)).toFixed(2)}MB exceeds ${VIDEO_TARGET_MB}MB target limit`);
            }
            // Use original file instead
            const originalFileObject = {
                buffer: videoFileObject.buffer,
                size: videoFileObject.size,
                originalname: videoFileObject.originalname,
                mimetype: videoFileObject.mimetype
            };
            return await azureBlobStorage.uploadToBlobStorage(originalFileObject.buffer, fileNameFinal, "video/mp4");
        }

        // Create file object for upload with custom filename
        const compressedFileObject = {
            buffer: compressedBuffer,
            size: compressedBuffer.length,
            originalname: `${timestamp}_${randomDigits}.mp4`,
            mimetype: 'video/mp4'
        };

        // Upload to Azure blob storage
        const uploadedUrl = await azureBlobStorage.uploadToBlobStorage(compressedFileObject.buffer, fileNameFinal, "video/mp4");

        // Cleanup temporary files
        try {
            unlinkSync(tempInputPath);
            unlinkSync(tempOutputPath);
            // Also cleanup any alternative output files that might exist
            const veryAggressivePath = join(tmpdir(), `output_very_aggressive_${timestamp}_${randomDigits}.mp4`);
            const basicPath = join(tmpdir(), `output_basic_${timestamp}_${randomDigits}.mp4`);
            if (existsSync(veryAggressivePath)) unlinkSync(veryAggressivePath);
            if (existsSync(basicPath)) unlinkSync(basicPath);
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

        // Try multiple compression strategies in order of preference
        let compressionSuccessful = false;

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
                    .on('progress', (progress) => {
                        console.log(`Ultra-aggressive MP3 compression progress: ${progress.percent?.toFixed(1)}%`);
                    })
                    .run();
            });
        } catch (mp3Error) {
            console.log('MP3 with libmp3lame failed, trying AAC codec...');

            // Strategy 2: Extreme AAC compression for 5MB target
            try {
                await new Promise((resolve, reject) => {
                    ffmpeg(tempInputPath)
                        .output(tempOutputPath)
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
                            console.log('AAC failed, trying basic MP3 codec...');
                            reject(err);
                        })
                        .on('progress', (progress) => {
                            console.log(`Extreme AAC compression progress: ${progress.percent?.toFixed(1)}%`);
                        })
                        .run();
                });
            } catch (aacError) {
                console.log('AAC failed, trying basic mp3 codec...');

                // Strategy 3: Emergency MP3 compression for 5MB target
                try {
                    await new Promise((resolve, reject) => {
                        ffmpeg(tempInputPath)
                            .output(tempOutputPath)
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
                                console.log('All MP3 strategies failed, trying WAV fallback...');
                                reject(err);
                            })
                            .on('progress', (progress) => {
                                console.log(`Emergency MP3 compression progress: ${progress.percent?.toFixed(1)}%`);
                            })
                            .run();
                    });
                } catch (basicError) {
                    console.log('All MP3 strategies failed, converting to WAV as last resort...');

                    // Strategy 4: Convert to WAV with compression (last resort)
                    const wavOutputPath = join(tmpdir(), `output_${timestamp}_${randomDigits}.wav`);
                    await new Promise((resolve, reject) => {
                        ffmpeg(tempInputPath)
                            .output(wavOutputPath)
                            .audioCodec('pcm_s16le')
                            .audioBitrate('128k')
                            .audioChannels(1)
                            .audioFrequency(22050)
                            .on('end', () => {
                                console.log('WAV conversion completed as fallback');
                                compressionSuccessful = true;
                                // Rename to use WAV file
                                // Rename WAV file to MP3 extension
                                const fs = require('fs');
                                fs.renameSync(wavOutputPath, tempOutputPath);
                                resolve();
                            })
                            .on('error', (err) => {
                                console.error('All compression strategies failed');
                                reject(err);
                            })
                            .run();
                    });
                }
            }
        }

        if (!compressionSuccessful) {
            throw new Error('All audio compression strategies failed');
        }

        // Read compressed audio
        const compressedBuffer = await new Promise((resolve, reject) => {
            const chunks = [];
            const readStream = createReadStream(tempOutputPath);

            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => resolve(Buffer.concat(chunks)));
            readStream.on('error', reject);
        });

        console.log(`Compressed audio size: ${(compressedBuffer.length / (1024 * 1024)).toFixed(2)}MB`);

        // Check if compression actually reduced file size and meets target
        const AUDIO_TARGET_MB = 5;
        const AUDIO_TARGET_BYTES = AUDIO_TARGET_MB * 1024 * 1024;

        if (compressedBuffer.length >= AUDIO_TARGET_BYTES) {
            throw new Error(`Audio compression failed: Final size ${(compressedBuffer.length / (1024 * 1024)).toFixed(2)}MB exceeds ${AUDIO_TARGET_MB}MB target limit`);
        }

        if (compressedBuffer.length >= audioFileObject.size) {
            console.log(`Warning: Compressed audio (${(compressedBuffer.length / (1024 * 1024)).toFixed(2)}MB) is larger than original (${(audioFileObject.size / (1024 * 1024)).toFixed(2)}MB). Using original file.`);
            // Check if original file meets target
            if (audioFileObject.size >= AUDIO_TARGET_BYTES) {
                throw new Error(`Original audio file ${(audioFileObject.size / (1024 * 1024)).toFixed(2)}MB exceeds ${AUDIO_TARGET_MB}MB target limit`);
            }
            // Use original file instead
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

        return uploadedUrl;

    } catch (error) {
        console.error('Image compression error:', error);
        throw new Error(`Failed to compress image: ${error.message}`);
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
    compressVideo,
    compressAudio,
    compressImage
};