import { sendMessage } from "./whatsappUtils.js";
import { createActivityLog } from "./createActivityLogUtils.js";


const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const removeHTMLTags = (text) => {
    return text.replace(/<[^>]*>?/gm, '');
};

const extractTranscript = (results) => {
    if (!results || !results.words) {
        return "";
    }

    const words = Object.values(results.words);
    const transcriptWords = words.filter(word =>
        word &&
        word.PronunciationAssessment &&
        word.PronunciationAssessment.ErrorType !== 'Omission'
    );

    const transcript = transcriptWords.map(word => word.Word).join(" ");

    // Capitalize first letter of the first word if it's alphabetic
    if (transcript.length > 0 && /[a-zA-Z]/.test(transcript[0])) {
        return transcript[0].toUpperCase() + transcript.slice(1);
    }

    return transcript;
};

const extractMispronouncedWords = (results) => {
    if (!results || !results.words) {
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
    if (activityType === "listenAndSpeak" || activityType === "watchAndSpeak" || activityType === "watchAndAudio" || activityType === "conversationalQuestionsBot" || activityType === "conversationalMonologueBot" || activityType === "conversationalAgencyBot" || activityType === "read" || activityType === "speakingPractice" || activityType === "feedbackAudio") {
        if (acceptableMessagesList.includes("audio") && messageType === "audio") {
            return true;
        } else if (messageContent.toLowerCase() == "next" && activityType === "feedbackAudio") {
            return true;
        } else if (messageContent.toLowerCase() == "next" && (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3")) {
            return true;
        }
    }
    if (activityType === "watchAndImage" && messageType === "image") {
        return true;
    }
    if (activityType === "watchAndImage" && messageType != "image") {
        await sendMessage(userMobileNumber, "Image bhejain.");
        await createActivityLog(userMobileNumber, "text", "outbound", "Image bhejain.", null);
        return false;
    }
    if (messageType === "text" && acceptableMessagesList.includes("text")) {
        return true;
    }
    if (acceptableMessagesList.includes("yes") && acceptableMessagesList.includes("no")) {
        if (messageContent.toLowerCase() == "yes" || messageContent.toLowerCase() == "no" || messageContent.toLowerCase() == "no, try again") {
            return true;
        } else {
            await sendMessage(userMobileNumber, "yes or no type kerain.");
            await createActivityLog(userMobileNumber, "text", "outbound", "yes or no type kerain.", null);
            return false;
        }
    }
    if (acceptableMessagesList.includes(messageContent.toLowerCase())) {
        return true;
    }

    // If list has "option a", "option b", "option c" then "option a", "option b", "option c" type kerain.
    if (acceptableMessagesList.includes("option a") && acceptableMessagesList.includes("option b") && acceptableMessagesList.includes("option c")) {
        await sendMessage(userMobileNumber, "option a, option b, ya option c mein se koi aik button press kerain.");
        await createActivityLog(userMobileNumber, "text", "outbound", "option a, option b, ya option c mein se koi aik button press kerain.", null);
        return false;
    }
    // If list has "a", "b", "c" then "a", "b", "c" type kerain.
    if (acceptableMessagesList.includes("a") && acceptableMessagesList.includes("b") && acceptableMessagesList.includes("c")) {
        if (messageContent.toLowerCase() == "next" && (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3")) {
            return true;
        }
        await sendMessage(userMobileNumber, "a, b, ya c mein se koi aik button press kerain.");
        await createActivityLog(userMobileNumber, "text", "outbound", "a, b, ya c mein se koi aik button press kerain.", null);
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
        await sendMessage(userMobileNumber, "Please write: \n\nstart");
        await createActivityLog(userMobileNumber, "text", "outbound", "Please write: \n\nstart", null);
        return false;
    }
    // Write customized message based on the acceptable messages list
    let message = "Please write: \n\n";
    if (acceptableMessagesList.length > 1) {
        for (let i = 0; i < acceptableMessagesList.length; i++) {
            message += "\n" + acceptableMessagesList[i];
            if (i < acceptableMessagesList.length - 1) {
                message += "\nor";
            }
        }
    } else {
        message += acceptableMessagesList[0];
    }
    await sendMessage(userMobileNumber, message);
    await createActivityLog(userMobileNumber, "text", "outbound", message, null);
    return false;
};

const getAcceptableMessagesList = async (activityType) => {
    if (activityType === "listenAndSpeak" || activityType === "watchAndSpeak" || activityType === "watchAndAudio" || activityType === "conversationalQuestionsBot" || activityType === "conversationalMonologueBot" || activityType === "conversationalAgencyBot" || activityType === "speakingPractice" || activityType === "feedbackAudio") {
        return ["audio"];
    } else if (activityType === "watchAndImage") {
        return ["image"];
    }
};


export {
    sleep,
    removeHTMLTags,
    extractTranscript,
    extractMispronouncedWords,
    getAudioBufferFromAudioFileUrl,
    convertNumberToEmoji,
    checkUserMessageAndAcceptableMessages,
    getAcceptableMessagesList
};