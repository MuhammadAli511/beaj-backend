import { containsUrl, validateDriveUrl, parseStartEndInstruction, getServiceAccountEmail, normalizeBool, normalizeInt } from "../utils/sheetUtils.js";
import lessonRepository from "../repositories/lessonRepository.js";
import lessonInstructionRepository from "../repositories/lessonInstructionsRepository.js";
import { getDriveMediaUrl, compressAudio, compressVideo, compressImage, compressSticker } from "../utils/sheetUtils.js";

const commonValidation = async (activity) => {
    let errors = [];
    let toCreate = 0;
    let toUpdate = 0;

    // Use the status already determined in contentIngestionService
    if (activity.status === "CREATE") {
        toCreate = 1;
    } else if (activity.status === "UPDATE") {
        toUpdate = 1;
    }
    
    const serviceAccountEmail = await getServiceAccountEmail();

    // Helper function to add permission error with instructions
    const addPermissionError = (res, mediaType) => {
        if (res.needsPermission) {
            errors.push(`Activity from ${activity.startRow} to ${activity.endRow}: No view access to ${mediaType}. Grant view access to: "${serviceAccountEmail || 'service account'}"`);
        } else if (!res.valid || !res.accessible) {
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have a valid ${mediaType} url: ${res.error}`);
        } else if (res.typeError) {
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}": ${res.typeError}`);
        }
    };

    // WEEK, DAY, SEQ
    if (isNaN(activity.week) || activity.week <= 0) {
        errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have week number that needs to be an integer and greater than 0`);
    }
    if (isNaN(activity.day) || activity.day <= 0) {
        errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have day number that needs to be an integer and greater than 0`);
    }
    if (isNaN(activity.seq) || activity.seq <= 0) {
        errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have sequence number that needs to be an integer and greater than 0`);
    }

    // ACTIVITY ALIAS
    if (containsUrl(activity.alias)) {
        errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have alias that is not a url`);
    }

    // Parse startInstruction
    if(activity.startInstructions){
        const parsedStart = await parseStartEndInstruction(activity.startInstructions);
        
        // ---- TEXT ----
        if (parsedStart.textInstruction && containsUrl(parsedStart.textInstruction)) {
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have text instruction that is not a url`);
        }
        if (parsedStart.textInstructionCaption && containsUrl(parsedStart.textInstructionCaption)) {
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have text caption that is not a url`);
        }

        // ---- IMAGE ----
        if (parsedStart.imageInstruction) {
            const res = await validateDriveUrl(parsedStart.imageInstruction, "image");
            addPermissionError(res, "image");
        }
        if (parsedStart.imageInstructionCaption && containsUrl(parsedStart.imageInstructionCaption)) {
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have image text caption that is not a url`);
        }

        // ---- AUDIO ----
        if (parsedStart.audioInstruction) {
            const res = await validateDriveUrl(parsedStart.audioInstruction, "audio");
            addPermissionError(res, "audio");
        }
        if (parsedStart.audioInstructionCaption && containsUrl(parsedStart.audioInstructionCaption)) {
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have audio text caption that is not a url`);
        }

        // ---- VIDEO ----
        if (parsedStart.videoInstruction) {
            const res = await validateDriveUrl(parsedStart.videoInstruction, "video");
            addPermissionError(res, "video");
        }
        if (parsedStart.videoInstructionCaption && containsUrl(parsedStart.videoInstructionCaption)) {
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have video text caption that is not a url`);
        }

        // ---- PDF ----
        if (parsedStart.pdfInstruction) {
            const res = await validateDriveUrl(parsedStart.pdfInstruction, "pdf");
            addPermissionError(res, "pdf");
        }
        if (parsedStart.pdfInstructionCaption && containsUrl(parsedStart.pdfInstructionCaption)) {
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have pdf text caption that is not a url`);
        }
    }
    
    // parse End Instructions
    if(activity.endInstructions){
        const parsedEnd = await parseStartEndInstruction(activity.endInstructions);

        // ---- TEXT ----
        if (parsedEnd.textInstruction && containsUrl(parsedEnd.textInstruction)) {
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have text instruction that is not a url`);
        }
        if (parsedEnd.textInstructionCaption && containsUrl(parsedEnd.textInstructionCaption)) {
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have text caption that is not a url`);
        }

        // ---- IMAGE ----
        if (parsedEnd.imageInstruction) {
            const res = await validateDriveUrl(parsedEnd.imageInstruction, "image");
            addPermissionError(res, "image");
        }
        if (parsedEnd.imageInstructionCaption && containsUrl(parsedEnd.imageInstructionCaption)) {
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have image text caption that is not a url`);
        }

        // ---- AUDIO ----
        if (parsedEnd.audioInstruction) {
            const res = await validateDriveUrl(parsedEnd.audioInstruction, "audio");
            addPermissionError(res, "audio");
        }
        if (parsedEnd.audioInstructionCaption && containsUrl(parsedEnd.audioInstructionCaption)) {
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have audio text caption that is not a url`);
        }

        // ---- VIDEO ----
        if (parsedEnd.videoInstruction) {
            const res = await validateDriveUrl(parsedEnd.videoInstruction, "video");
            addPermissionError(res, "video");
        }
        if (parsedEnd.videoInstructionCaption && containsUrl(parsedEnd.videoInstructionCaption)) {
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have video text caption that is not a url`);
        }

        // ---- PDF ----
        if (parsedEnd.pdfInstruction) {
            const res = await validateDriveUrl(parsedEnd.pdfInstruction, "pdf");
            addPermissionError(res, "pdf");
        }
        if (parsedEnd.pdfInstructionCaption && containsUrl(parsedEnd.pdfInstructionCaption)) {
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have pdf text caption that is not a url`);
        }
    }
    
    // Skip on First Question
    if (activity.skipOnFirstQuestion && activity.skipOnFirstQuestion.toLowerCase() !== "true" && activity.skipOnFirstQuestion.toLowerCase() !== "false") {
       errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have Skip on First Question that needs to be True/False`);
    }

    // Skip on Start
    if (activity.skipOnStart && activity.skipOnStart.toLowerCase() !== "true" && activity.skipOnStart.toLowerCase() !== "false") {
        errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have Skip on Start Activity that needs to be True/False`);

        // Skip on Start to LessonId
        if(isNaN(activity.skipOnStartToLessonId)  || activity.skipOnStartToLessonId <= 0 ){
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have Skip on Start to LessonID that needs to be an integer and greater than 0`);
        }
    }

    if(activity.skipOnStart && activity.skipOnStart.toLowerCase() == "true" && !activity.skipOnStartToLessonId){
        errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have Skip on Start to LessonID because Skip on Start is True`);
    }

    if (activity.skipOnStart && activity.skipOnStart.toLowerCase() === "true" && activity.skipOnStartToLessonId > 0) {
        try {
            const lesson = await lessonRepository.getLessonByLessonId(activity.skipOnStartToLessonId);
            if (!lesson) {
                errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" has SkipOnStartToLessonId ${activity.skipOnStartToLessonId} which does not exist in lessons table`);
            } else {
                const current = {
                    week: parseInt(activity.week, 10),
                    day: parseInt(activity.day, 10),
                    seq: parseInt(activity.seq, 10),
                };
                const target = {
                    week: parseInt(lesson.weekNumber, 10),
                    day: parseInt(lesson.dayNumber, 10),
                    seq: parseInt(lesson.SequenceNumber, 10),
                };

                let isValid = false;

                if (target.week > current.week) {
                    isValid = true;
                } else if (target.week < current.week) {
                    isValid = false;
                } else {
                    // weeks are equal
                    if (target.day > current.day) {
                        isValid = true;
                    } else if (target.day < current.day) {
                        isValid = false;
                    } else {
                        // days are equal
                        if (target.seq > current.seq) {
                            isValid = true;
                        } else {
                            isValid = false;
                        }
                    }
                }

                if (!isValid) {
                    errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" has SkipOnStartToLessonId (${activity.skipOnStartToLessonId}) that must point to a lesson strictly after the current activity (week/day/seq)`);
                }
            }
        } catch (err) {
            console.error("LessonId validation error:", err);
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" failed while validating SkipOnStartToLessonId`);
        }
    }
    
    if (activity.skipOnEveryQuestion && activity.skipOnEveryQuestion.toLowerCase() !== "true" && activity.skipOnEveryQuestion.toLowerCase() !== "false") {
       errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have Skip on Every Question that needs to be True/False`);
    }

    // COMPLETION STICKER (must be webp only)
    if (activity.completionSticker) {
        const res = await validateDriveUrl(activity.completionSticker, "image");
        if (res.needsPermission) {
            errors.push(`Row ${activity.startRow}-${activity.endRow}: No view access to completion sticker. Grant view access to: ${serviceAccountEmail || 'service account'}`);
        } else if (!res.valid || !res.accessible) {
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have a valid sticker image url: ${res.error}`);
        } else if (res.mimeType && res.mimeType !== "image/webp") {
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have a completion sticker in WEBP format only`);
        }
    }

    // QUESTIONS
    for (const question of activity.questions) {
        // If questionNumber exists should be an integer and greater than 0
        if (isNaN(question.questionNumber) || question.questionNumber <= 0) {
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have question number that needs to be an integer and greater than 0`);
        }

        // If difficultyLevel exists should be either "easy", "medium", "hard" or ""
        if (question.difficultyLevel && question.difficultyLevel !== "easy" && question.difficultyLevel !== "medium" && question.difficultyLevel !== "hard" && question.difficultyLevel !== "") {
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have difficulty level that is either "easy", "medium", "hard" or ""`);
        }

        // If questionText exists should not be a url
        if (containsUrl(question.questionText)) {
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have question text that is not a url`);
        }

        // If questionVideo exists should be a valid video url
        if (question.questionVideo) {
            const res = await validateDriveUrl(question.questionVideo, "video");
            addPermissionError(res, "question video");
        }

        // If questionAudio exists should be a valid audio url
        if (question.questionAudio) {
            const res = await validateDriveUrl(question.questionAudio, "audio");
            addPermissionError(res, "question audio");
        }

        // If questionImage exists should be a valid image url
        if (question.questionImage) {
            const res = await validateDriveUrl(question.questionImage, "image");
            addPermissionError(res, "question image");
        }

        for (const answer of question.answers) {
            // If answerText exists should not be a url
            if (containsUrl(answer.answerText)) {
                errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have answer text that is not a url`);
            }

            // If correct exists should be a boolean
            if (answer.correct !== true && answer.correct !== false) {
                errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have correct that is a boolean`);
            }

            // If customFeedbackText exists should not be a url
            if (containsUrl(answer.customFeedbackText)) {
                errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have custom feedback text that is not a url`);
            }

            // If customFeedbackImage exists should be a valid image url
            if (answer.customFeedbackImage) {
                const res = await validateDriveUrl(answer.customFeedbackImage, "image");
                addPermissionError(res, "custom feedback image");
            }

            // If customFeedbackAudio exists should be a valid audio url
            if (answer.customFeedbackAudio) {
                const res = await validateDriveUrl(answer.customFeedbackAudio, "audio");
                addPermissionError(res, "custom feedback audio");
            }
        }
    }

    return {
        errors,
        toCreate,
        toUpdate
    };
};

const commonIngestion = async (activity, exists) => {
    let lessonCreation = null;
    let audioFile, compressedAudioUrl, lessonId, stickerFile, compressStickerUrl = null, skipOnStartToLessonId = null;

    if(activity.skipOnStartToLessonId == '' || !activity.skipOnStartToLessonId ){
      skipOnStartToLessonId = null;
    }
    else{
       skipOnStartToLessonId = activity.skipOnStartToLessonId;
    }

    if (activity.audioInstruction) {
        audioFile = await getDriveMediaUrl(activity.audioInstruction);
        compressedAudioUrl = await compressAudio(audioFile);
    }

    if(activity.completionSticker){
       stickerFile = await getDriveMediaUrl(activity.completionSticker);
       compressStickerUrl = await compressSticker(stickerFile);
    }

    if (exists) {
        lessonCreation = await lessonRepository.updateByCourseWeekDaySeq(
            activity.courseId,
            activity.week,
            activity.day,
            activity.seq,
            activity.activityType,
            activity.alias,
            activity.text,
            activity.textInstruction,
            compressedAudioUrl,
            normalizeBool(activity.skipOnFirstQuestion),
            normalizeBool(activity.skipOnStart),
            normalizeInt(activity.skipOnStartToLessonId),
            normalizeBool(activity.skipOnEveryQuestion),
            compressStickerUrl,
        );
        lessonId = exists;
        await lessonInstructionRepository.deleteByLessonId(lessonId);
        
    } else {
        lessonCreation = await lessonRepository.create(
            "week",
            activity.day,
            activity.activityType,
            activity.alias,
            activity.week,
            activity.text,
            activity.courseId,
            activity.seq,
            "Active",
            activity.textInstruction,
            compressedAudioUrl,
            normalizeBool(activity.skipOnFirstQuestion),
            normalizeBool(activity.skipOnStart),
            normalizeInt(activity.skipOnStartToLessonId),
            normalizeBool(activity.skipOnEveryQuestion),
            compressStickerUrl,
        );
        lessonId = lessonCreation.LessonId || lessonCreation.dataValues?.LessonId;
    }

    if (!lessonId) {
        throw new Error(`Failed to process activity from "${activity.startRow}" to "${activity.endRow}": LessonId not found`);
    }
    // Call the Lesson Instructions Process
    await processLessonInstructions(lessonId, activity.startInstructions, activity.endInstructions);

    return lessonCreation;
};

const processLessonInstructions = async (lessonId, startInstructions, endInstructions) => {
    const startParsed = startInstructions ? await parseStartEndInstruction(startInstructions) : {};
    const endParsed = endInstructions ? await parseStartEndInstruction(endInstructions) : {};

    const insertInstructions = async (parsed, position) => {
        const entries = [
            { type: "text", value: parsed.textInstruction, caption: parsed.textInstructionCaption },
            { type: "image", value: parsed.imageInstruction, caption: parsed.imageInstructionCaption },
            { type: "audio", value: parsed.audioInstruction, caption: parsed.audioInstructionCaption },
            { type: "video", value: parsed.videoInstruction, caption: parsed.videoInstructionCaption },
            { type: "pdf", value: parsed.pdfInstruction, caption: parsed.pdfInstructionCaption },
        ];

        for (const entry of entries) {
            if (!entry.value) continue;

            let finalUrl = entry.value;
            let mediaId = null;

            try {
                if (entry.type === "image") {
                    const file = await getDriveMediaUrl(entry.value);
                    if (file) finalUrl = await compressImage(file);
                }
                if (entry.type === "audio") {
                    const file = await getDriveMediaUrl(entry.value);
                    if (file) finalUrl = await compressAudio(file);
                }
                if (entry.type === "video") {
                    const file = await getDriveMediaUrl(entry.value);
                    if (file) finalUrl = await compressVideo(file);
                }
            } catch (err) {
                console.error(`Failed to process ${entry.type} instruction for lesson ${lessonId}:`, err);
                continue;
            }

            await lessonInstructionRepository.create(
                lessonId,
                entry.type,
                position,
                finalUrl,
                mediaId,
                entry.caption || null
            );
        }
    };

    // Insert both start & end instructions
    await insertInstructions(startParsed, "start");
    await insertInstructions(endParsed, "end");
};

export { commonValidation, commonIngestion };