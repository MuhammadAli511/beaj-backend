import { sendButtonMessage, sendMessage } from "./whatsappUtils.js";
import { createActivityLog } from "./createActivityLogUtils.js";
import waProfileRepository from "../repositories/waProfileRepository.js";
import speakActivityQuestionRepository from "../repositories/speakActivityQuestionRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import dotenv from 'dotenv';
dotenv.config();

const studentBotPhoneNumberId = process.env.STUDENT_BOT_PHONE_NUMBER_ID;
const teacherBotPhoneNumberId = process.env.TEACHER_BOT_PHONE_NUMBER_ID;
const marketingBotPhoneNumberId = process.env.MARKETING_BOT_PHONE_NUMBER_ID;

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const extractTranscript = (results) => {
    if (!results?.words) {
        return "";
    }

    const words = Object.values(results.words);
    const transcriptWords = words.filter(word => word?.PronunciationAssessment?.ErrorType !== 'Omission');

    const transcript = transcriptWords.map(word => word?.Word ?? "").join(" ");

    // Capitalize first letter of the first word if it's alphabetic
    if (transcript.length > 0 && /[a-zA-Z]/.test(transcript[0])) {
        return transcript[0].toUpperCase() + transcript.slice(1);
    }

    return transcript;
};


const extractMessageContent = async (message, userMobileNumber) => {
    let messageContent = null;
    let inboundUploadedImage = null;
    let buttonId = null;
    
    switch (message.type) {
        case "image":
            inboundUploadedImage = await createActivityLog(userMobileNumber, "image", "inbound", message, null);
            messageContent = await retrieveMediaURL(message.image.id);
            break;
        case "audio":
            await createActivityLog(userMobileNumber, "audio", "inbound", message, null);
            messageContent = await retrieveMediaURL(message.audio.id);
            break;
        case "video":
            await createActivityLog(userMobileNumber, "video", "inbound", message, null);
            messageContent = await retrieveMediaURL(message.video.id);
            break;
        case "text":
            messageContent = message.text?.body.toLowerCase().trim() || "";
            createActivityLog(userMobileNumber, "text", "inbound", message.text?.body, null);
            break;
        case "interactive":
            messageContent = message.interactive.button_reply.title.toLowerCase().trim();
            createActivityLog(userMobileNumber, "template", "inbound", messageContent, null);
            buttonId = message.interactive.button_reply.id;
            break;
        case "button":
            messageContent = message.button.text.toLowerCase().trim();
            createActivityLog(userMobileNumber, "template", "inbound", messageContent, null);
            break;
        default:
            return null;
    }
    
    return { messageContent, inboundUploadedImage, buttonId };
};


const getProfileTypeFromBotId = (botPhoneNumberId) => {
    if (botPhoneNumberId === teacherBotPhoneNumberId) {
        return "teacher";
    } else if (botPhoneNumberId === studentBotPhoneNumberId) {
        return "student";
    } else if (botPhoneNumberId === marketingBotPhoneNumberId) {
        return "marketing";
    } else {
        throw new Error(`Unhandled botPhoneNumberId ${botPhoneNumberId}`);
    }
};


const getLevelFromCourseName = (courseName) => {
    if (courseName == "Free Trial - Kids - Level 1") {
        return 1;
    } else if (courseName == "Free Trial - Kids - Level 3") {
        return 3;
    } else if (courseName.includes("Grade 1") || courseName.includes("Grade 2")) {
        return 1;
    } else if (courseName.includes("Grade 3") || courseName.includes("Grade 4")) {
        return 2;
    } else if (courseName.includes("Grade 5") || courseName.includes("Grade 6")) {
        return 3;
    } else if (courseName.includes("Grade 7")) {
        return 4;
    } else if (courseName.includes("Level 1")) {
        return 1;
    } else if (courseName.includes("Level 2")) {
        return 2;
    } else if (courseName.includes("Level 3")) {
        return 3;
    } else if (courseName.includes("Level 4")) {
        return 4;
    } else {
        return 4;
    }
};

const extractMispronouncedWords = (results) => {
    if (!results?.words) {
        return [];
    }

    const words = Object.values(results.words);
    const mispronouncedWords = words.filter(word => {
        return word &&
            word.PronunciationAssessment &&
            (word.PronunciationAssessment.ErrorType == 'Mispronunciation' ||
                word.PronunciationAssessment.AccuracyScore < 70);
    });

    return mispronouncedWords;
};

const getAudioBufferFromAudioFileUrl = async (audioUrl) => {
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
};

const convertNumberToEmoji = async (number) => {
    const emojiMap = {
        '0': '0️⃣',
        '1': '1️⃣',
        '2': '2️⃣',
        '3': '3️⃣',
        '4': '4️⃣',
        '5': '5️⃣',
        '6': '6️⃣',
        '7': '7️⃣',
        '8': '8️⃣',
        '9': '9️⃣'
    };

    return number.toString().split('').map(digit => emojiMap[digit]).join('');
};

const checkUserMessageAndAcceptableMessages = async (profileId, userMobileNumber, currentUserState, messageType, messageContent) => {
    const acceptableMessagesList = currentUserState.dataValues.acceptableMessages;
    const activityType = currentUserState.dataValues.activityType;
    const persona = currentUserState.dataValues.persona;
    if (!acceptableMessagesList) {
        return true;
    }
    if (currentUserState.dataValues.engagement_type == "Choose User") {
        const profiles = await waProfileRepository.getAllSortOnProfileId(userMobileNumber);
        const userMetadata = await waUsersMetadataRepository.getByPhoneNumber(userMobileNumber);

        // Check if user sent a valid letter based on number of profiles
        const validLetters = Array.from({ length: profiles.length }, (_, i) => String.fromCharCode(65 + i));
        if (messageContent && (messageType === "text" || messageType === "button" || messageType === "interactive") && validLetters.includes(messageContent.toUpperCase())) {
            return true;
        }

        // If not valid, show choose user options
        for (let i = 0; i < profiles.length; i += 3) {
            const profileChunk = profiles.slice(i, i + 3);
            let profileMessage = "Choose user:\n";

            // Create message for this chunk
            profileChunk.forEach((profile, chunkIndex) => {
                const globalIndex = i + chunkIndex;
                const matchingUser = userMetadata.find(user => user.dataValues.profile_id === profile.dataValues.profile_id);
                profileMessage += `${String.fromCharCode(65 + globalIndex)}) ${matchingUser.dataValues.name}\n`;
            });

            // Create buttons for this chunk
            const buttons = profileChunk.map((profile, chunkIndex) => {
                const globalIndex = i + chunkIndex;
                return { id: String(profile.dataValues.profile_id), title: String.fromCharCode(65 + globalIndex) };
            });

            await sendButtonMessage(userMobileNumber, profileMessage.trim(), buttons);
            await createActivityLog(userMobileNumber, "template", "outbound", profileMessage.trim(), null);
            await sleep(1000);
        }
        return false;
    }
    if (acceptableMessagesList.includes("image") && messageType != "image") {
        if (acceptableMessagesList.includes("start again") && messageContent.toLowerCase() == "start again") {
            return true;
        }
        await sendMessage(userMobileNumber, "Please send an image.");
        await createActivityLog(userMobileNumber, "text", "outbound", "Please send an image.", null);
        return false;
    }
    if (acceptableMessagesList.includes("image") && messageType == "image") {
        return true;
    }
    if (activityType === "listenAndSpeak" || activityType === "watchAndSpeak" || activityType === "watchAndAudio" ||
        activityType === "conversationalQuestionsBot" || activityType === "conversationalMonologueBot" ||
        activityType === "conversationalAgencyBot" || activityType === "read" || activityType === "speakingPractice" ||
        activityType === "feedbackAudio" || activityType === "assessmentWatchAndSpeak"
    ) {
        if (acceptableMessagesList.includes("audio") && messageType === "audio") {
            return true;
        } else if (messageType == "text" && messageContent.toLowerCase() == "next" && activityType === "feedbackAudio") {
            return true;
        } else if (messageType == "text" && messageContent.toLowerCase() == "next" && (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3")) {
            return true;
        } else if ((messageType == "text" || messageType == "button" || messageType == "interactive") && messageContent.toLowerCase() == "next activity" && activityType === "watchAndAudio" && persona == "kid") {
            return true;
        }
    }
    if (messageType === "text" && acceptableMessagesList.includes("text")) {
        return true;
    }
    if ((messageType == "text" || messageType == "button" || messageType == "interactive") && acceptableMessagesList.includes(messageContent.toLowerCase())) {
        return true;
    }
    // If list has "option a", "option b", "option c" then "option a", "option b", "option c" type kerain.
    if (acceptableMessagesList.includes("option a") && acceptableMessagesList.includes("option b") && acceptableMessagesList.includes("option c")) {
        await sendButtonMessage(userMobileNumber, "Please select an option:", [{ id: "option a", title: "Option A" }, { id: "option b", title: "Option B" }, { id: "option c", title: "Option C" }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "Please select an option: (Option A, Option B, Option C)", null);
        return false;
    }
    // If list has "a", "b", "c" then "a", "b", "c" type kerain.
    if (acceptableMessagesList.includes("a") && acceptableMessagesList.includes("b") && acceptableMessagesList.includes("c")) {
        if ((messageType == "text" || messageType == "button" || messageType == "interactive") && messageContent.toLowerCase() == "next" && (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3")) {
            return true;
        }
        await sendButtonMessage(userMobileNumber, "Please select an option:", [{ id: "a", title: "A" }, { id: "b", title: "B" }, { id: "c", title: "C" }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "Please select an option: (A, B, C)", null);
        return false;
    }
    // If list has "audio"
    if (acceptableMessagesList.includes("audio")) {
        await sendMessage(userMobileNumber, "Voice message record karke bhejain.");
        await createActivityLog(userMobileNumber, "text", "outbound", "Voice message record karke bhejain.", null);
        return false;
    }
    // If list has "text"
    if (acceptableMessagesList.includes("text")) {
        await sendMessage(userMobileNumber, "Text message type kerain.");
        await createActivityLog(userMobileNumber, "text", "outbound", "Text message type kerain.", null);
        return false;
    }
    if (acceptableMessagesList.includes("start")) {
        await sendButtonMessage(userMobileNumber, "Please click on the start button:", [{ id: "start", title: "Start" }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "Please click on the start button:", null);
        return false;
    }
    if (acceptableMessagesList.includes("start now!") && acceptableMessagesList.includes("change user")) {
        await sendButtonMessage(userMobileNumber, "Click on Start Now! 👇", [{ id: "start_now", title: "Start Now!" }, { id: "change_user", title: "Change User" }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "Click on Start Now! 👇", null);
        return false;
    }
    if (acceptableMessagesList.includes("start now!")) {
        await sendButtonMessage(userMobileNumber, "Click on Start Now! 👇", [{ id: "start_now", title: "Start Now!" }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "Click on Start Now! 👇", null);
        return false;
    }
    // Kids flow
    if (acceptableMessagesList.includes("start part b") && acceptableMessagesList.includes("change user")) {
        await sendButtonMessage(userMobileNumber, "Are you ready?", [{ id: "start_part_b", title: "Start Part B" }, { id: "change_user", title: "Change User" }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "Are you ready?", null);
        return false;
    }
    if (acceptableMessagesList.includes("start next game") && acceptableMessagesList.includes("change user")) {
        await sendButtonMessage(userMobileNumber, "Ready to start your next game?", [{ id: "start_next_game", title: "Start Next Game" }, { id: "change_user", title: "Change User" }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "Ready to start your next game?", null);
        return false;
    }
    if (acceptableMessagesList.includes("start next lesson") && acceptableMessagesList.includes("change user")) {
        await sendButtonMessage(userMobileNumber, "Are you ready to start your next lesson?", [{ id: "start_next_lesson", title: "Start Next Lesson" }, { id: "change_user", title: "Change User" }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "Are you ready to start your next lesson?", null);
        return false;
    }
    if (acceptableMessagesList.includes("start practice") && acceptableMessagesList.includes("change user")) {
        await sendButtonMessage(userMobileNumber, "Are you ready to start practice?", [{ id: "start_practice", title: "Start Practice" }, { id: "change_user", title: "Change User" }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "Are you ready to start practice?", null);
        return false;
    }
    if (acceptableMessagesList.includes("start questions") && acceptableMessagesList.includes("change user")) {
        await sendButtonMessage(userMobileNumber, "👇 Click on the button below to start questions!", [{ id: "start_questions", title: "Start Questions" }, { id: "change_user", title: "Change User" }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "👇 Click on the button below to start questions!", null);
        return false;
    }
    if (acceptableMessagesList.includes("let's start") && acceptableMessagesList.includes("change user")) {
        await sendButtonMessage(userMobileNumber, "Are you ready?", [{ id: "let_s_start", title: "Let's Start" }, { id: "change_user", title: "Change User" }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "Are you ready?", null);
        return false;
    }
    const buttonOptions = acceptableMessagesList.map(message => ({
        id: message.replace(/\s+/g, '_'),
        title: message.charAt(0).toUpperCase() + message.slice(1)
    }));
    const limitedButtonOptions = buttonOptions.slice(0, 3);
    let logMessage = "Please select an option: (" + buttonOptions.map(option => option.title).join(", ") + ")";
    await sendButtonMessage(userMobileNumber, "Please select an option:", limitedButtonOptions);
    await createActivityLog(userMobileNumber, "template", "outbound", logMessage, null);
    return false;
};

const getAcceptableMessagesList = async (activityType) => {
    if (
        activityType === "listenAndSpeak" || activityType === "watchAndSpeak" || activityType === "watchAndAudio" ||
        activityType === "conversationalQuestionsBot" || activityType === "conversationalMonologueBot" ||
        activityType === "conversationalAgencyBot" || activityType === "speakingPractice" ||
        activityType === "feedbackAudio" || activityType === "assessmentWatchAndSpeak"
    ) {
        return ["audio"];
    } else if (activityType === "watchAndImage") {
        return ["image"];
    }
};

const getDaysPerWeek = async (profileId) => {
    const profile = await waProfileRepository.getByProfileId(profileId);
    return profile.dataValues.profile_type === 'teacher' ? 6 : 5;
};

const getTotalLessonsForCourse = async (profileId) => {
    const daysPerWeek = await getDaysPerWeek(profileId);
    return 4 * daysPerWeek;
};

const difficultyLevelCalculation = async (profileId, userMobileNumber, currentUserState, messageContent) => {
    if (messageContent != 'easy' && messageContent != 'hard') {
        const difficultyLevelExists = await speakActivityQuestionRepository.checkIfDifficultyLevelExists(currentUserState.dataValues.currentLessonId);
        if (difficultyLevelExists) {
            await sendButtonMessage(userMobileNumber, "Select Difficulty Level", [{ id: "easy", title: "Easy" }, { id: "hard", title: "Hard" }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Select Difficulty Level", null);
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["easy", "hard"]);
            return false;
        } else {
            await waUserProgressRepository.updateDifficultyLevel(profileId, userMobileNumber, null);
        }
    } else if (messageContent == 'easy') {
        await waUserProgressRepository.updateDifficultyLevel(profileId, userMobileNumber, 'easy');
    } else if (messageContent == 'hard') {
        await waUserProgressRepository.updateDifficultyLevel(profileId, userMobileNumber, 'hard');
    }
    return true;
};



export {
    sleep,
    extractTranscript,
    extractMispronouncedWords,
    getAudioBufferFromAudioFileUrl,
    convertNumberToEmoji,
    checkUserMessageAndAcceptableMessages,
    getAcceptableMessagesList,
    getDaysPerWeek,
    getTotalLessonsForCourse,
    difficultyLevelCalculation,
    getLevelFromCourseName,
    extractMessageContent,
    getProfileTypeFromBotId
};