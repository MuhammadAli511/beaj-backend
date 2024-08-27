import { createClient } from "@deepgram/sdk";
import OpenAI from "openai";
import axios from 'axios';
import openai_prompt from "../utils/prompts.js";
import cleanTextForSpeech from "../utils/cleanText.js";
import azure_blob from "../utils/azureBlobStorage.js";
import dotenv from 'dotenv';
import { performance } from 'perf_hooks';
import audioChatRepository from '../repositories/audioChatsRepository.js';
import waUser from '../repositories/waUser.js';
import lessonRepository from '../repositories/lessonRepository.js';
import documentFileRepository from '../repositories/documentFileRepository.js';
import multipleChoiceQuestionRepository from '../repositories/multipleChoiceQuestionRepository.js';
import multipleChoiceQuestionAnswerRepository from '../repositories/multipleChoiceQuestionAnswerRepository.js';
import questionResponseRepository from '../repositories/questionResponseRepository.js';
import speakActivityQuestionRepository from '../repositories/speakActivityQuestionRepository.js';
import { mcqsResponse } from '../constants/chatbotConstants.js';


dotenv.config();
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const openai = new OpenAI(process.env.OPENAI_API_KEY);
const whatsappToken = process.env.WHATSAPP_TOKEN;
const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const whatsappVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

let activity_types_to_repeat = ['mcqs', 'watchAndSpeak', 'listenAndSpeak', 'postListenAndSpeak', 'preListenAndSpeak', 'postMCQs', 'preMCQs', 'read'];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const normalizeAnswer = (input) => {
    return input.toLowerCase().replace(/[.]/g, '').replace(/\s+/g, ' ').trim();
};

function stripHtmlTags(html) {
    // Replace list items with a newline and dash
    let text = html.replace(/<li>/g, '\n- ').replace(/<\/li>/g, '');

    // Replace paragraph breaks with newlines
    text = text.replace(/<br\s*\/?>/g, '\n').replace(/<\/?p>/g, '\n');

    // Replace remaining HTML tags with an empty string
    text = text.replace(/<[^>]*>?/gm, '');

    // Remove extra newlines
    text = text.replace(/\n{2,}/g, '\n\n').trim();

    return text;
}

const sendMessage = async (to, body) => {
    try {
        await axios.post(
            `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
            {
                messaging_product: 'whatsapp',
                to: to,
                text: { body: body },
            },
            {
                headers: {
                    Authorization: `Bearer ${whatsappToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );
    } catch (error) {
        console.error('Error sending message:', error.response ? error.response.data : error.message);
    }
};

const retrieveAudioURL = async (mediaId) => {
    const mediaResponse = await axios.get(
        `https://graph.facebook.com/v20.0/${mediaId}`,
        {
            headers: {
                Authorization: `Bearer ${whatsappToken}`,
            },
        }
    );

    const audioUrl = mediaResponse.data.url;

    const audioResponse = await axios.get(audioUrl, {
        responseType: 'arraybuffer',
        headers: {
            Authorization: `Bearer ${whatsappToken}`,
        },
    });
    return audioResponse;
};

const sendMediaMessage = async (to, mediaUrl, mediaType) => {
    try {
        if (mediaType == 'video') {
            await axios.post(
                `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'video',
                    video: { link: mediaUrl },
                },
                {
                    headers: {
                        Authorization: `Bearer ${whatsappToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        } else if (mediaType == 'audio') {
            await axios.post(
                `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'audio',
                    audio: { link: mediaUrl },
                },
                {
                    headers: {
                        Authorization: `Bearer ${whatsappToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        } else if (mediaType == 'image') {
            await axios.post(
                `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'image',
                    image: { link: mediaUrl },
                },
                {
                    headers: {
                        Authorization: `Bearer ${whatsappToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        } else {
            console.error('Invalid media type:', mediaType);
        }
    } catch (error) {
        console.error('Error sending media message:', error.response ? error.response.data : error.message);
    }
};

const sendNextLessonTemplateMessage = async (to) => {
    try {
        console.log("Phone Number:", to);
        const response = await axios.post(
            `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'template',
                template: {
                    name: 'next_lesson_emoji',
                    language: {
                        code: 'en',
                    },
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${whatsappToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        console.log('Next Lesson template message sent:', response.data);
    } catch (error) {
        console.error('Error sending Next Lesson template message:', error.response ? error.response.data : error.message);
    }
};

const sendNextVideoTemplateMessage = async (to) => {
    try {
        await axios.post(
            `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
            {
                messaging_product: 'whatsapp',
                to: to,
                type: 'template',
                template: {
                    name: 'next_video_emoji',
                    language: {
                        code: 'en',
                    },
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${whatsappToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );
    } catch (error) {
        console.error('Error sending Next Lesson template message:', error.response ? error.response.data : error.message);
    }
};

const greeting_message = async (userMobileNumber) => {
    await sendMessage(userMobileNumber, "Assalam o Alaikum. 👋\nWelcome to your English course! Get ready for fun exercises & practice! 💬");
};

const audio_feedback_message = async (message, userMobileNumber) => {
    if (message.type === 'audio') {
        try {
            const mediaId = message.audio.id;
            const audioResponse = await retrieveAudioURL(mediaId);
            const audioBuffer = audioResponse.data;

            const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
                audioBuffer,
                {
                    model: "nova-2",
                    smart_format: false,
                }
            );

            if (error) {
                console.error('Error transcribing audio:', error);
                await sendMessage(userMobileNumber, 'Sorry, there was an error processing your audio file.');
            } else {
                const transcription = result.results.channels[0].alternatives[0].transcript;
                const message = `Please wait for an answer. \n\nYou said: ${transcription}`;
                await sendMessage(userMobileNumber, message);

                const completion = await openai.chat.completions.create({
                    messages: [
                        { role: "system", content: await openai_prompt() },
                        { role: "user", content: transcription },
                    ],
                    model: "gpt-4o",
                });
                const model_response = completion.choices[0].message.content;
                const cleaned_response = await cleanTextForSpeech(model_response);
                const mp3 = await openai.audio.speech.create({
                    model: "tts-1-hd",
                    voice: "nova",
                    input: cleaned_response,
                    response_format: "opus",
                });
                const buffer = Buffer.from(await mp3.arrayBuffer());
                const audioFileUrl = await azure_blob.uploadToBlobStorage(buffer, "feedback.opus");

                await sendMediaMessage(userMobileNumber, audioFileUrl, 'audio');

            }
        } catch (err) {
            console.error('Error fetching or processing audio file:', err);
            await sendMessage(userMobileNumber, 'Sorry, there was an error processing your audio file.');
        }
    } else {
        await sendMessage(userMobileNumber, 'Sorry, I only accept audio files.');
    }
};

const update_user = async (userMobileNumber, user, startingLesson) => {
    await waUser.update(
        userMobileNumber,
        user.dataValues.persona,
        user.dataValues.engagement_type,
        user.dataValues.level,
        startingLesson.dataValues.weekNumber,
        startingLesson.dataValues.dayNumber,
        startingLesson.dataValues.SequenceNumber,
        startingLesson.dataValues.activity,
        startingLesson.dataValues.LessonId,
        null
    );
};

const send_mcq = async (userMobileNumber, user, mcq, body) => {
    const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(mcq.dataValues.Id);
    let mcqMessage = "❓❓ *Question:* ❓❓" + "\n" + mcq.QuestionText + "\n\nChoose the correct answer:";
    for (let j = 0; j < mcqAnswers.length; j++) {
        mcqMessage += "\n" + String.fromCharCode(65 + j) + ". " + mcqAnswers[j].dataValues.AnswerText;
    }
    await sendMessage(userMobileNumber, mcqMessage);
};

const sendSpeakActivityQuestion = async (userMobileNumber, user, speakActivityQuestion, body, activity) => {
    let speakActivityQuestionMediaUrl = speakActivityQuestion.dataValues.mediaFile;
    if (activity === 'watchAndSpeak') {
        const speakActivityQuestionMessage = speakActivityQuestion.dataValues.question;
        if (speakActivityQuestionMessage) {
            await sendMessage(userMobileNumber, speakActivityQuestionMessage);
        }
        await sendMediaMessage(userMobileNumber, speakActivityQuestionMediaUrl, 'video');
        await sleep(10000);
        // Next template for skipping the audio recording
        await sendNextVideoTemplateMessage(userMobileNumber);
        return;
    }
    else if (activity === 'listenAndSpeak' || activity === 'postListenAndSpeak' || activity === 'preListenAndSpeak') {
        await sendMediaMessage(userMobileNumber, speakActivityQuestionMediaUrl, 'audio');
        await sleep(8000);
        const speakActivityQuestionMessage = speakActivityQuestion.dataValues.question + "\n\nRecord your answer";
        if (speakActivityQuestionMessage) {
            await sendMessage(userMobileNumber, speakActivityQuestionMessage);
        }

    }
};

const get_lessons = async (userMobileNumber, user, startingLesson, body, userMessage, message) => {
    const activity = startingLesson.dataValues.activity;
    if (activity === 'video') {
        // Send lesson message
        let lessonMessage = "➡️ *Activity*: " + startingLesson.dataValues.activityAlias;
        lessonMessage += "\n\n📝 *Note:* Watch the video and answer the questions.";
        if (startingLesson.dataValues.text) {
            lessonMessage += "\n\n" + stripHtmlTags(startingLesson.dataValues.text);
        }
        await sendMessage(userMobileNumber, lessonMessage);

        // Send video content
        const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
        let videoURL = documentFile[0].dataValues.video;
        await sendMediaMessage(userMobileNumber, videoURL, 'video');
        await sleep(10000);
        // Next template for next lesson
        await sendNextLessonTemplateMessage(userMobileNumber);
    }
    else if (activity === 'mcqs' || activity === 'postMCQs' || activity === 'preMCQs') {
        if (user.dataValues.question_number === null) {
            // Send first MCQ
            const startingMCQ = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(startingLesson.dataValues.LessonId, null);
            await waUser.update_question(userMobileNumber, startingMCQ.dataValues.QuestionNumber);
            await send_mcq(userMobileNumber, user, startingMCQ, body);
        } else {
            // Send remaining MCQs
            const mcq = await multipleChoiceQuestionRepository.getCurrentMultipleChoiceQuestion(user.dataValues.lesson_id, user.dataValues.question_number);
            const mcqAnswers = await multipleChoiceQuestionAnswerRepository.getByQuestionId(mcq.dataValues.Id);

            let correctAnswer;
            for (let i = 0; i < mcqAnswers.length; i++) {
                if (mcqAnswers[i].dataValues.IsCorrect === true) {
                    correctAnswer = normalizeAnswer(mcqAnswers[i].dataValues.AnswerText); // Normalize the correct answer
                    break;
                }
            }

            const userInput = userMessage.trim();
            let userAnswer, userAnswerIsCorrect = false;

            if (userInput.length === 1 && /^[A-D]$/i.test(userInput)) {
                // User entered a letter (A, B, C, D)
                const index = userInput.toUpperCase().charCodeAt(0) - 65;
                if (mcqAnswers[index]) {
                    userAnswer = mcqAnswers[index].dataValues.AnswerText;
                    userAnswerIsCorrect = normalizeAnswer(userAnswer) === correctAnswer;
                }
            } else {
                // User entered full answer text or a mixed input
                const normalizedInput = normalizeAnswer(userInput);

                const foundAnswer = mcqAnswers.find(answer => normalizeAnswer(answer.dataValues.AnswerText) === normalizedInput);
                userAnswer = foundAnswer ? foundAnswer.dataValues.AnswerText : null;
                userAnswerIsCorrect = foundAnswer ? normalizeAnswer(userAnswer) === correctAnswer : false;
            }

            if (!userAnswerIsCorrect) {
                userAnswerIsCorrect = false;
            }

            const submissionDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
            await questionResponseRepository.create(
                user.dataValues.phone_number,
                user.dataValues.lesson_id,
                mcq.dataValues.Id,
                'mcqs',
                startingLesson.dataValues.activityAlias,
                userAnswer,
                null,
                userAnswerIsCorrect,
                1,
                submissionDate
            );
            const nextMCQ = await multipleChoiceQuestionRepository.getNextMultipleChoiceQuestion(user.dataValues.lesson_id, user.dataValues.question_number);
            if (nextMCQ) {
                await waUser.update_question(userMobileNumber, nextMCQ.dataValues.QuestionNumber);
                await send_mcq(userMobileNumber, user, nextMCQ, body);
            } else {
                // Give total score here
                const totalScore = await questionResponseRepository.getScore(user.dataValues.phone_number, user.dataValues.lesson_id);
                const totalQuestions = await questionResponseRepository.getTotalQuestions(user.dataValues.phone_number, user.dataValues.lesson_id);
                let message = "❗️❗️ 🎉 RESULT 🎉❗️❗️\n\nYour score is " + totalScore + " out of " + totalQuestions + "\n\n";
                message += mcqsResponse[user.dataValues.lesson_id];
                await sendMessage(userMobileNumber, message);
                await waUser.update_activity_question_lessonid(userMobileNumber, null, null);
                // Send template here for next lesson
                await sleep(2000);
                await sendNextLessonTemplateMessage(userMobileNumber);
            }
        }
    }
    else if (activity === 'listenAndSpeak' || activity === 'postListenAndSpeak' || activity === 'preListenAndSpeak') {
        if (user.dataValues.question_number === null) {
            // Send first Speak Activity Question
            const startingSpeakActivityQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(startingLesson.dataValues.LessonId, null);
            await waUser.update_question(userMobileNumber, startingSpeakActivityQuestion.dataValues.questionNumber);
            await sendSpeakActivityQuestion(userMobileNumber, user, startingSpeakActivityQuestion, body, activity);
            return;
        } else if (message.type === 'audio') {
            const speakActivityQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(user.dataValues.lesson_id, user.dataValues.question_number);
            const mediaId = message.audio.id;
            const audioResponse = await retrieveAudioURL(mediaId);
            const audioBuffer = audioResponse.data;
            const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
                audioBuffer,
                {
                    model: "nova-2",
                    smart_format: false,
                }
            );

            if (error) {
                await sendMessage(userMobileNumber, 'Sorry, there was an error processing your audio file.');
            } else {
                const transcription = result.results.channels[0].alternatives[0].transcript;
                const answersArray = speakActivityQuestion.dataValues.answer;
                let userAnswerIsCorrect = false;
                for (let i = 0; i < answersArray.length; i++) {
                    if (transcription.toLowerCase().includes(answersArray[i].toLowerCase())) {
                        userAnswerIsCorrect = true;
                        break;
                    }
                }
                if (!userAnswerIsCorrect) {
                    userAnswerIsCorrect = false;
                }
                if (userAnswerIsCorrect) {
                    await sendMessage(userMobileNumber, "✅");
                } else {
                    await sendMessage(userMobileNumber, "❌");
                }
                const userAudioFileUrl = await azure_blob.uploadToBlobStorage(audioBuffer, "audioFile.opus");
                const submissionDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
                await questionResponseRepository.create(user.dataValues.phone_number, user.dataValues.lesson_id, speakActivityQuestion.dataValues.id, activity, startingLesson.dataValues.activityAlias, transcription, userAudioFileUrl, userAnswerIsCorrect, 1, submissionDate);
                const nextSpeakActivityQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(user.dataValues.lesson_id, user.dataValues.question_number);
                if (nextSpeakActivityQuestion) {
                    await waUser.update_question(userMobileNumber, nextSpeakActivityQuestion.dataValues.questionNumber);
                    await sendSpeakActivityQuestion(userMobileNumber, user, nextSpeakActivityQuestion, body, activity);
                } else {
                    const totalScore = await questionResponseRepository.getScore(user.dataValues.phone_number, user.dataValues.lesson_id);
                    const totalQuestions = await questionResponseRepository.getTotalQuestions(user.dataValues.phone_number, user.dataValues.lesson_id);
                    // Give total score here
                    let message = "❗️❗️ 🎉 RESULT 🎉❗️❗️\n\n Your score is " + totalScore + " out of " + totalQuestions + ". Keep working hard!";
                    await sendMessage(userMobileNumber, message);
                    await waUser.update_activity_question_lessonid(userMobileNumber, null, null);
                    await sleep(2000);
                    // Send template here for next lesson
                    await sendNextLessonTemplateMessage(userMobileNumber);
                }
            }
        }
    }
    else if (activity === 'watchAndSpeak') {
        if (user.dataValues.question_number === null) {
            // Send lesson message
            let lessonMessage = "➡️ *Activity*: " + startingLesson.dataValues.activityAlias;
            lessonMessage += "\n\n📝 *Note:* Practice speaking by recording yourself. 🎤";
            if (startingLesson.dataValues.text) {
                lessonMessage += "\n\n" + stripHtmlTags(startingLesson.dataValues.text);
            }
            await sendMessage(userMobileNumber, lessonMessage);

            // Send first Speak Activity Question
            const startingSpeakActivityQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(startingLesson.dataValues.LessonId, null);
            await waUser.update_question(userMobileNumber, startingSpeakActivityQuestion.dataValues.questionNumber);
            await sendSpeakActivityQuestion(userMobileNumber, user, startingSpeakActivityQuestion, body, activity);
            return;
        } else {
            const speakActivityQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(user.dataValues.lesson_id, user.dataValues.question_number);
            if (userMessage.toLowerCase().includes('next video')) {
                const nextSpeakActivityQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(user.dataValues.lesson_id, user.dataValues.question_number);
                if (nextSpeakActivityQuestion) {
                    await waUser.update_question(userMobileNumber, nextSpeakActivityQuestion.dataValues.questionNumber);
                    await sendSpeakActivityQuestion(userMobileNumber, user, nextSpeakActivityQuestion, body, activity);
                } else {
                    await waUser.update_activity_question_lessonid(userMobileNumber, null, null);
                    // Send template here for next lesson
                    await sendNextLessonTemplateMessage(userMobileNumber);
                }
                return;
            }
            const mediaId = message.audio.id;
            const audioResponse = await retrieveAudioURL(mediaId);
            const audioBuffer = audioResponse.data;
            const userAudioFileUrl = await azure_blob.uploadToBlobStorage(audioBuffer, "audioFile.opus");
            const submissionDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
            await questionResponseRepository.create(user.dataValues.phone_number, user.dataValues.lesson_id, speakActivityQuestion.dataValues.id, activity, startingLesson.dataValues.activityAlias, null, userAudioFileUrl, true, 1, submissionDate);
            const nextSpeakActivityQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(user.dataValues.lesson_id, user.dataValues.question_number);
            if (nextSpeakActivityQuestion) {
                await waUser.update_question(userMobileNumber, nextSpeakActivityQuestion.dataValues.questionNumber);
                await sendSpeakActivityQuestion(userMobileNumber, user, nextSpeakActivityQuestion, body, activity);
            } else {
                await waUser.update_activity_question_lessonid(userMobileNumber, null, null);
                // Send template here for next lesson
                await sendNextLessonTemplateMessage(userMobileNumber);
            }
        }
    }
    else if (activity === 'read') {
        if (body.Body) {
            // Send audio content
            const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
            let englishAudio, image;
            for (let i = 0; i < documentFile.length; i++) {
                if (documentFile[i].dataValues.mediaType == 'image') {
                    image = documentFile[i].dataValues.image;
                } else if (documentFile[i].dataValues.language == 'English') {
                    englishAudio = documentFile[i].dataValues.audio;
                }
            }


            // Send lesson message
            let lessonMessage = "📝 *Note:* Read the passage and record yourself. 🎤 \n";
            if (startingLesson.dataValues.text) {
                lessonMessage += "\n\n" + stripHtmlTags(startingLesson.dataValues.text);
            }
            if (image) {
                await sendMediaMessage(userMobileNumber, image, 'image');
            } else {
                await sendMessage(userMobileNumber, lessonMessage);
            }

            await sleep(5000);
            if (englishAudio) {
                await sendMediaMessage(userMobileNumber, englishAudio, 'audio');
            }
            await sleep(10000);
            let lessonMessage2 = "📝 *Note:* Read the passage and record yourself. 🎤 \n";
            await sendMessage(userMobileNumber, lessonMessage2);
        }

        // if audio
        else if (message.type === 'audio') {
            const mediaId = message.audio.id;
            const audioResponse = await retrieveAudioURL(mediaId);
            const audioBuffer = audioResponse.data;
            const userAudioFileUrl = await azure_blob.uploadToBlobStorage(audioBuffer, "audioFile.opus");
            const submissionDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
            await questionResponseRepository.create(user.dataValues.phone_number, user.dataValues.lesson_id, 1, activity, startingLesson.dataValues.activityAlias, null, userAudioFileUrl, true, 1, submissionDate);
            // Send template here for next lesson
            await sleep(2000);
            await sendNextLessonTemplateMessage(userMobileNumber);
        }
    }
    else if (activity === 'audio') {
        // Get lesson documents
        const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
        let audio, image;
        for (let i = 0; i < documentFile.length; i++) {
            if (documentFile[i].dataValues.mediaType === 'audio') {
                audio = documentFile[i].dataValues.audio;
            } else {
                image = documentFile[i].dataValues.image;
            }
        }


        // Send lesson message
        let lessonMessage = "➡️ *Activity*: " + startingLesson.dataValues.activityAlias;
        if (startingLesson.dataValues.text) {
            lessonMessage += "\n\n" + stripHtmlTags(startingLesson.dataValues.text);
        }
        if (image) {
            await sendMediaMessage(userMobileNumber, image, 'image');
        } else {
            await sendMessage(userMobileNumber, lessonMessage);
        }

        // Add a delay before sending the audio content
        await sleep(3000);

        // Send audio content
        if (audio) {
            await sendMediaMessage(userMobileNumber, audio, 'audio');
        }

        // Add a delay before sending the next lesson template
        await sleep(15000);

        // Send template here for next lesson
        await sendNextLessonTemplateMessage(userMobileNumber);
    }
};

const verifyWebhookService = async (req, res) => {
    try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode && token === whatsappVerifyToken) {
            console.log('Webhook verified');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } catch (error) {
        console.error('Error in verifyWebhookService:', error);
        error.fileName = 'chatBotService.js';
        throw error;
    }
};

const webhookService = async (body, res) => {
    try {
        res.sendStatus(200);
        if (
            body.entry &&
            body.entry[0].changes &&
            body.entry[0].changes[0].value.messages &&
            body.entry[0].changes[0].value.statuses == undefined
        ) {
            console.log('Webhook received:', body);
            const message = body.entry[0].changes[0].value.messages[0];
            const userMobileNumber = "+" + message.from;
            const userMessage = message.text?.body.toLowerCase().trim() || "";
            const messageId = message.id;
            console.log('Message ID:', messageId);
            console.log('User:', userMobileNumber);
            console.log('Message:', userMessage);
            console.log("Status:", body.entry[0].changes[0].value.statuses);

            // Check if user exists in the database
            let user = await waUser.getByPhoneNumber(userMobileNumber);

            if (userMessage === 'beaj_audio_bot') {
                if (user && user.dataValues.persona === 'Teacher' && user.dataValues.engagement_type === 'Learning') {
                    await waUser.update(userMobileNumber, 'Student', 'Audio Practice');
                } else {
                    await waUser.create(userMobileNumber, 'Student', 'Audio Practice');
                }
                await sendMessage(userMobileNumber, "Assalam o Alaikum. 👋\nWelcome to your Beaj Speaking Tutor.");
                return;
            }

            if (user && user.dataValues.engagement_type === 'Audio Practice' && message.type === 'audio') {
                await audio_feedback_message(message, userMobileNumber);
                return;
            } else if (user && user.dataValues.engagement_type === 'Audio Practice' && !message.type === 'audio') {
                await sendMessage(userMobileNumber, "Please send an audio file.");
                return;
            }



            if (!user) {
                await greeting_message(userMobileNumber);
                await sleep(2000);
                waUser.create(userMobileNumber, 'Teacher', 'Learning');
                const startingLesson = await lessonRepository.getNextLesson(94, 4, null, null);
                if (startingLesson.dataValues.status === 'Not Active') {
                    await sendMessage(userMobileNumber, "Today's lessons are complete! ✅\nCome back tomorrow for more learning fun. 📅💡");
                    return;
                }
                await waUser.update(
                    userMobileNumber,
                    'Teacher',
                    'Learning',
                    '94',
                    startingLesson.dataValues.weekNumber,
                    startingLesson.dataValues.dayNumber,
                    startingLesson.dataValues.SequenceNumber,
                    startingLesson.dataValues.activity,
                    startingLesson.dataValues.LessonId,
                    null
                );
                user = await waUser.getByPhoneNumber(userMobileNumber);
                await get_lessons(userMobileNumber, user, startingLesson, body, userMessage, message);
                return;
            }

            if (userMessage === 'reset') {
                await waUser.deleteByPhoneNumber(userMobileNumber);
                await sendMessage(userMobileNumber, 'Your progress has been reset. You can start the course again.');
                return;
            }

            if (userMessage.toLowerCase().includes('start next lesson')) {
                const nextLesson = await lessonRepository.getNextLesson(user.dataValues.level, user.dataValues.week, user.dataValues.day, user.dataValues.lesson_sequence);
                if (nextLesson === null) {
                    await sendMessage(userMobileNumber, '❗️❗️🎉 CONGRATULATIONS 🎉❗️❗️\n 🌟 You have successfully completed the course! 🌟 \n Please contact your group admin to receive your certificate. 📜💬');
                    return;
                } else if (nextLesson.dataValues.status === 'Not Active') {
                    await sendMessage(userMobileNumber, "Today's lessons are complete! ✅\nCome back tomorrow for more learning fun. 📅💡");
                    return;
                }
                await update_user(userMobileNumber, user, nextLesson);
                await get_lessons(userMobileNumber, user, nextLesson, body, userMessage, message);
                return;
            }


            if (user.activity_type && activity_types_to_repeat.includes(user.activity_type)) {
                const currentLesson = await lessonRepository.getCurrentLesson(user.dataValues.lesson_id);
                await get_lessons(userMobileNumber, user, currentLesson, body, userMessage, message);
                return;
            }
        }

    } catch (error) {
        console.error('Error in chatBotService:', error);
        error.fileName = 'chatBotService.js';
        throw error;
    }
};

const feedbackService = async (prompt, userAudioFile) => {
    let startTime, endTime, userSpeechToTextTime, modelFeedbackTime, modelTextToSpeechTime, finalStartTime, finalEndTime, totalTime;

    finalStartTime = performance.now();
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    const userFileUrl = await azure_blob.uploadToBlobStorage(userAudioFile);


    startTime = performance.now();
    const audioBuffer = userAudioFile.buffer;
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
            model: "nova-2",
            smart_format: false,
        }
    );
    endTime = performance.now();
    userSpeechToTextTime = (endTime - startTime).toFixed(2) / 1000;

    if (error) {
        console.error('Error transcribing audio:', error);
        return;
    }

    const transcription = result.results.channels[0].alternatives[0].transcript;

    startTime = performance.now();
    const completion = await openai.chat.completions.create({
        messages: [
            { role: "system", content: prompt },
            { role: "user", content: transcription },
        ],
        model: "gpt-4o",
    });
    const model_response = completion.choices[0].message.content;
    const cleaned_response = await cleanTextForSpeech(model_response);
    endTime = performance.now();
    modelFeedbackTime = (endTime - startTime).toFixed(2) / 1000;

    startTime = performance.now();
    const mp3 = await openai.audio.speech.create({
        model: "tts-1-hd",
        voice: "nova",
        input: cleaned_response,
        response_format: "opus",
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    const audioFileUrl = await azure_blob.uploadToBlobStorage(buffer, "feedback.opus");
    endTime = performance.now();
    modelTextToSpeechTime = (endTime - startTime).toFixed(2) / 1000;

    finalEndTime = performance.now();
    totalTime = (finalEndTime - finalStartTime).toFixed(2) / 1000;
    audioChatRepository.create(userFileUrl, audioFileUrl, userSpeechToTextTime, modelFeedbackTime, modelTextToSpeechTime, totalTime, prompt, model_response);
    if (audioFileUrl) {
        return "Feedback successfully submitted";
    } else {
        return "Failed to submit feedback";
    }
};

const getAllFeedbackService = async () => {
    const feedback = await audioChatRepository.getAll();
    return feedback;
};

export default { webhookService, feedbackService, getAllFeedbackService, verifyWebhookService };
