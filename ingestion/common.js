import { containsUrl, validateDriveUrl } from "../utils/sheetUtils.js";
import lessonRepository from "../repositories/lessonRepository.js";
import { getDriveMediaUrl, compressAudio } from "../utils/sheetUtils.js";

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
    // For "SKIP" status, both remain 0

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

    // TEXT INSTRUCTION
    if (containsUrl(activity.textInstruction)) {
        errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have text instruction that is not a url`);
    }

    // AUDIO INSTRUCTION
    if (activity.audioInstruction) {
        const res = await validateDriveUrl(activity.audioInstruction, "audio");
        if (!res.valid) {
            errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have audio instruction that is a valid audio file`);
        }
    }

    // COMPLETION STICKER
    if (containsUrl(activity.completionSticker)) {
        errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have completion sticker that is not a url`);
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
            if (!res.valid) {
                errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have question video that is a valid video file`);
            }
        }

        // If questionAudio exists should be a valid audio url
        if (question.questionAudio) {
            const res = await validateDriveUrl(question.questionAudio, "audio");
            if (!res.valid) {
                errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have question audio that is a valid audio file`);
            }
        }

        // If questionImage exists should be a valid image url
        if (question.questionImage) {
            const res = await validateDriveUrl(question.questionImage, "image");
            if (!res.valid) {
                errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have question image that is a valid image file`);
            }
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
                if (!res.valid) {
                    errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have custom feedback image that is a valid image file`);
                }
            }

            // If customFeedbackAudio exists should be a valid audio url
            if (answer.customFeedbackAudio) {
                const res = await validateDriveUrl(answer.customFeedbackAudio, "audio");
                if (!res.valid) {
                    errors.push(`Activity from "${activity.startRow}" to "${activity.endRow}" should have custom feedback audio that is a valid audio file`);
                }
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
    let audioFile, compressedAudioUrl;
    if (activity.audioInstruction) {
        audioFile = await getDriveMediaUrl(activity.audioInstruction);
        compressedAudioUrl = await compressAudio(audioFile);
    }
    if (exists) {
        lessonCreation = await lessonRepository.updateByCourseWeekDaySeq(activity.courseId, activity.week, activity.day, activity.seq, activity.activityType, activity.alias, activity.text, activity.textInstruction, compressedAudioUrl);
    } else {
        lessonCreation = await lessonRepository.create("week", activity.day, activity.activityType, activity.alias, activity.week, activity.text, activity.courseId, activity.seq, "Active", activity.textInstruction, compressedAudioUrl);
    }
    return lessonCreation;
}

export { commonValidation, commonIngestion };