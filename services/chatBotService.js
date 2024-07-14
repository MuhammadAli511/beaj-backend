import twilio from 'twilio';
import { createClient } from "@deepgram/sdk";
import OpenAI from "openai";
import axios from 'axios';
import openai_prompt from "../utils/prompts.js";
import cleanTextForSpeech from "../utils/cleanText.js";
import azure_blob from "../utils/azureBlobStorage.js";
import dotenv from 'dotenv';
import { performance } from 'perf_hooks';
import audioChatRepository from '../repositories/audioChatsRepository.js';
import { introLists, personaDict } from '../constants/chatbotConstants.js';
import waUser from '../repositories/waUser.js';
import lessonRepository from '../repositories/lessonRepository.js';
import documentFileRepository from '../repositories/documentFileRepository.js';
import multipleChoiceQuestionRepository from '../repositories/multipleChoiceQuestionRepository.js';
import multipleChoiceQuestionAnswerRepository from '../repositories/multipleChoiceQuestionAnswerRepository.js';
import questionResponseRepository from '../repositories/questionResponseRepository.js';
import speakActivityQuestionRepository from '../repositories/speakActivityQuestionRepository.js';
import { sl } from 'date-fns/locale';


dotenv.config();
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const openai = new OpenAI(process.env.OPENAI_API_KEY);

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

const greeting_message = async (body) => {
    client.messages.create({
        from: body.To,
        body: "Hi there! Welcome to Beaj. Let's begin your course. Below is your first lesson.",
        to: body.From,
    });
    sleep(2000);
};

const audio_feedback_message = async (body) => {
    const mediaUrl = body.MediaUrl0;
    const mediaContentType = body.MediaContentType0;
    if (mediaContentType.startsWith('audio/')) {
        try {
            const audioResponse = await axios.get(mediaUrl, {
                responseType: 'arraybuffer',
                auth: {
                    username: accountSid,
                    password: authToken
                }
            });
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
                client.messages.create({
                    from: body.To,
                    body: 'Sorry, there was an error processing your audio file.',
                    to: body.From,
                }).then(message => console.log("Error message sent + " + message.sid));
            } else {
                const transcription = result.results.channels[0].alternatives[0].transcript;
                const message = `Please wait for an answer. \n\nYou said: ${transcription}`;
                client.messages.create({
                    from: body.To,
                    body: message,
                    to: body.From,
                }).then(message => console.log("Transcription message sent + " + message.sid));

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

                client.messages.create({
                    from: body.To,
                    mediaUrl: [audioFileUrl],
                    to: body.From,
                }).then(message => console.log("Audio message sent + " + message.sid));

            }
        } catch (err) {
            console.error('Error fetching or processing audio file:', err);
            client.messages.create({
                from: body.To,
                body: 'Sorry, there was an error processing your audio file.',
                to: body.From,
            }).then(message => console.log("Error message sent + " + message.sid));
        }
    } else {
        client.messages.create({
            from: body.To,
            body: 'Sorry, I only accept audio files.',
            to: body.From,
        }).then(message => console.log("Error message sent + " + message.sid));
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
    let mcqMessage = mcq.QuestionText;
    for (let j = 0; j < mcqAnswers.length; j++) {
        mcqMessage += "\n" + String.fromCharCode(65 + j) + ". " + mcqAnswers[j].dataValues.AnswerText;
    }
    await client.messages.create({
        from: body.To,
        body: mcqMessage,
        to: body.From,
    }).then(message => console.log("MCQ message sent + " + message.sid));
};

const sendSpeakActivityQuestion = async (userMobileNumber, user, speakActivityQuestion, body, activity) => {

    let speakActivityQuestionMediaUrl = speakActivityQuestion.dataValues.mediaFile;
    if (activity === 'watchAndSpeak') {
        const speakActivityQuestionMessage = speakActivityQuestion.dataValues.question;
        if (speakActivityQuestionMessage) {
            await client.messages.create({
                from: body.To,
                body: speakActivityQuestionMessage,
                to: body.From,
            }).then(message => console.log("Speak Activity message sent + " + message.sid));
        }
        speakActivityQuestionMediaUrl = "https://beajbloblive.blob.core.windows.net/asset-202307301859231194707-out/cff9a24d-15e4-4d4f-94aa-20508e83_720x480_2200.mp4?sv=2022-11-02&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=3023-06-23T16:57:22Z&st=2023-06-23T08:57:22Z&spr=https&sig=YfguGfVzPg4kO8ynxR0M%2FMowlU1ZtBv2K1VCswkwVcM%3D";
        await client.messages.create({
            from: body.To,
            mediaUrl: [speakActivityQuestionMediaUrl],
            to: body.From,
        }).then(message => console.log("Speak Activity media sent + " + message.sid));
        await sleep(20000);
        // Next template for skipping the audio recording
        await client.messages.create({
            from: "MG252cac2eba974fff75b1df0cab40ece7",
            contentSid: "HXc714b662d9dcff30ff4c46bef490fb29",
            to: body.From,
        }).then(message => console.log("Next lesson message sent + " + message.sid));
        return;
    }
    else if (activity === 'listenAndSpeak' || activity === 'postListenAndSpeak' || activity === 'preListenAndSpeak') {
        speakActivityQuestionMediaUrl = "https://beajbloblive.blob.core.windows.net/test/15da300b-c49a-4f0b-9b0c-48646b7c_AACAudio_2Ch_192kbps.mp3"
        await client.messages.create({
            from: body.To,
            mediaUrl: [speakActivityQuestionMediaUrl],
            to: body.From,
        }).then(message => console.log("Speak Activity media sent + " + message.sid));
        await sleep(20000);
        const speakActivityQuestionMessage = speakActivityQuestion.dataValues.question;
        if (speakActivityQuestionMessage) {
            await client.messages.create({
                from: body.To,
                body: speakActivityQuestionMessage,
                to: body.From,
            }).then(message => console.log("Speak Activity message sent + " + message.sid));
        }
    }
};

const get_next_lesson = async (userMobileNumber, user, startingLesson, body, userMessage) => {
    const nextLesson = await lessonRepository.getNextLesson(user.dataValues.level, user.dataValues.week, user.dataValues.day, user.dataValues.lesson_sequence);
    if (nextLesson === null) {
        client.messages.create({
            from: body.To,
            body: 'Congratulations! You have completed all the lessons for this course.',
            to: body.From,
        }).then(message => console.log("Completion message sent + " + message.sid));
        return;
    }
    await update_user(userMobileNumber, user, nextLesson);
    await get_lessons(userMobileNumber, user, nextLesson, body, userMessage);
};

const get_lessons = async (userMobileNumber, user, startingLesson, body, userMessage) => {
    const activity = startingLesson.dataValues.activity;
    if (activity === 'video') {
        // Send lesson message
        let lessonMessage = "Activity Name: " + startingLesson.dataValues.activityAlias;
        lessonMessage += "\n\nThis lesson contains a video activity. Please watch the video and answer the following questions.";
        if (startingLesson.dataValues.text) {
            lessonMessage += "\n\n" + stripHtmlTags(startingLesson.dataValues.text);
        }
        await client.messages.create({
            from: body.To,
            body: lessonMessage,
            to: body.From,
        }).then(message => console.log("Lesson message sent + " + message.sid));

        // Send video content
        // const videoURL = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
        const videoURL = "https://beajbloblive.blob.core.windows.net/asset-202307301859231194707-out/cff9a24d-15e4-4d4f-94aa-20508e83_720x480_2200.mp4?sv=2022-11-02&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=3023-06-23T16:57:22Z&st=2023-06-23T08:57:22Z&spr=https&sig=YfguGfVzPg4kO8ynxR0M%2FMowlU1ZtBv2K1VCswkwVcM%3D";
        await client.messages.create({
            from: body.To,
            mediaUrl: [videoURL],
            to: body.From,
        }).then(async message => {
            console.log("Video message sent + " + message.sid);
            await waUser.updateMessageSid(userMobileNumber, message.sid);
        });
    }
    else if (activity === 'mcqs' || activity === 'postMCQs' || activity === 'preMCQs') {
        if (user.dataValues.question_number === null) {
            // Send lesson message
            let lessonMessage = "Activity Name: " + startingLesson.dataValues.activityAlias;
            lessonMessage += "\n\nThis lesson contains multiple choice questions. Please answer the following questions by typing the letter corresponding to the correct answer.";
            if (startingLesson.dataValues.text) {
                lessonMessage += "\n\n" + stripHtmlTags(startingLesson.dataValues.text);
            }
            await client.messages.create({
                from: body.To,
                body: lessonMessage,
                to: body.From,
            }).then(message => console.log("Lesson message sent + " + message.sid));

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
                let message = "You have completed the MCQs for this lesson. Your total score is " + totalScore;
                await client.messages.create({
                    from: body.To,
                    body: message,
                    to: body.From,
                }).then(message => console.log("Total score message sent + " + message.sid));
                await waUser.update_activity_question_lessonid(userMobileNumber, null, null);
                // Send template here for next lesson
                await sleep(2000);
                await client.messages.create({
                    from: "MG252cac2eba974fff75b1df0cab40ece7",
                    contentSid: "HXc714b662d9dcff30ff4c46bef490fb29",
                    to: body.From,
                }).then(message => console.log("Next lesson message sent + " + message.sid));
            }
        }
    }
    else if (activity === 'listenAndSpeak' || activity === 'postListenAndSpeak' || activity === 'preListenAndSpeak') {
        if (user.dataValues.question_number === null) {
            // Send lesson message
            let lessonMessage = "Activity Name: " + startingLesson.dataValues.activityAlias;
            lessonMessage += "\n\nThis lesson contains a Listen and Speak activity. Please listen to the audio and record your response.";
            if (startingLesson.dataValues.text) {
                lessonMessage += "\n\n" + stripHtmlTags(startingLesson.dataValues.text);
            }
            await client.messages.create({
                from: body.To,
                body: lessonMessage,
                to: body.From,
            }).then(message => console.log("Lesson message sent + " + message.sid));

            // Send first Speak Activity Question
            const startingSpeakActivityQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(startingLesson.dataValues.LessonId, null);
            await waUser.update_question(userMobileNumber, startingSpeakActivityQuestion.dataValues.questionNumber);
            await sendSpeakActivityQuestion(userMobileNumber, user, startingSpeakActivityQuestion, body, activity);
            return;
        } else {
            const speakActivityQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(user.dataValues.lesson_id, user.dataValues.question_number);
            const userAudioFile = body.MediaUrl0;
            const audioResponse = await axios.get(userAudioFile, {
                responseType: 'arraybuffer',
                auth: {
                    username: accountSid,
                    password: authToken
                }
            });
            const audioBuffer = audioResponse.data; const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
                audioBuffer,
                {
                    model: "nova-2",
                    smart_format: false,
                }
            );

            if (error) {
                console.error('Error transcribing audio:', error);
                client.messages.create({
                    from: body.To,
                    body: 'Sorry, there was an error processing your audio file.',
                    to: body.From,
                }).then(message => console.log("Error message sent + " + message.sid));
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
                const userAudioFileUrl = await azure_blob.uploadToBlobStorage(audioBuffer, "audioFile.opus");
                const submissionDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
                await questionResponseRepository.create(user.dataValues.phone_number, user.dataValues.lesson_id, speakActivityQuestion.dataValues.id, activity, startingLesson.dataValues.activityAlias, transcription, userAudioFileUrl, userAnswerIsCorrect, 1, submissionDate);
                const nextSpeakActivityQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(user.dataValues.lesson_id, user.dataValues.question_number);
                if (nextSpeakActivityQuestion) {
                    await waUser.update_question(userMobileNumber, nextSpeakActivityQuestion.dataValues.questionNumber);
                    await sendSpeakActivityQuestion(userMobileNumber, user, nextSpeakActivityQuestion, body, activity);
                } else {
                    const totalScore = await questionResponseRepository.getScore(user.dataValues.phone_number, user.dataValues.lesson_id);
                    // Give total score here
                    let message;
                    if (activity === 'listenAndSpeak') {
                        message = "You have completed the Listen and Speak activity for this lesson.";
                    } else if (activity === 'postListenAndSpeak') {
                        message = "You have completed the Post Listen and Speak activity for this lesson.";
                    } else if (activity === 'preListenAndSpeak') {
                        message = "You have completed the Pre Listen and Speak activity for this lesson.";
                    }
                    message += "\n\nYour total score is " + totalScore;
                    await client.messages.create({
                        from: body.To,
                        body: message,
                        to: body.From,
                    }).then(message => console.log("Speak Activity completion message sent + " + message.sid));
                    await waUser.update_activity_question_lessonid(userMobileNumber, null, null);
                    await sleep(2000);
                    // Send template here for next lesson
                    await client.messages.create({
                        from: "MG252cac2eba974fff75b1df0cab40ece7",
                        contentSid: "HXc714b662d9dcff30ff4c46bef490fb29",
                        to: body.From,
                    }).then(message => console.log("Next lesson message sent + " + message.sid));
                }
            }
        }
    }
    else if (activity === 'watchAndSpeak') {
        if (user.dataValues.question_number === null) {
            // Send lesson message
            let lessonMessage = "Activity Name: " + startingLesson.dataValues.activityAlias;
            lessonMessage += "\n\nThis lesson contains a Watch and Speak activity. Please watch the video and record your response.";
            if (startingLesson.dataValues.text) {
                lessonMessage += "\n\n" + stripHtmlTags(startingLesson.dataValues.text);
            }
            await client.messages.create({
                from: body.To,
                body: lessonMessage,
                to: body.From,
            }).then(message => console.log("Lesson message sent + " + message.sid));

            // Send first Speak Activity Question
            const startingSpeakActivityQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(startingLesson.dataValues.LessonId, null);
            await waUser.update_question(userMobileNumber, startingSpeakActivityQuestion.dataValues.questionNumber);
            await sendSpeakActivityQuestion(userMobileNumber, user, startingSpeakActivityQuestion, body, activity);
            return;
        } else {
            const speakActivityQuestion = await speakActivityQuestionRepository.getCurrentSpeakActivityQuestion(user.dataValues.lesson_id, user.dataValues.question_number);
            if (userMessage.toLowerCase().includes('start next lesson')) {
                const nextSpeakActivityQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(user.dataValues.lesson_id, user.dataValues.question_number);
                if (nextSpeakActivityQuestion) {
                    await waUser.update_question(userMobileNumber, nextSpeakActivityQuestion.dataValues.questionNumber);
                    await sendSpeakActivityQuestion(userMobileNumber, user, nextSpeakActivityQuestion, body, activity);
                } else {
                    // Give total score here
                    let message = "You have completed the Watch and Speak activity for this lesson.";
                    await client.messages.create({
                        from: body.To,
                        body: message,
                        to: body.From,
                    }).then(message => console.log("Speak Activity completion message sent + " + message.sid));
                    await waUser.update_activity_question_lessonid(userMobileNumber, null, null);
                    await sleep(2000);
                    // Send template here for next lesson
                    await client.messages.create({
                        from: "MG252cac2eba974fff75b1df0cab40ece7",
                        contentSid: "HXc714b662d9dcff30ff4c46bef490fb29",
                        to: body.From,
                    }).then(message => console.log("Next lesson message sent + " + message.sid));
                }
                return;
            }
            const userAudioFile = body.MediaUrl0;
            const audioResponse = await axios.get(userAudioFile, {
                responseType: 'arraybuffer',
                auth: {
                    username: accountSid,
                    password: authToken
                }
            });
            const audioBuffer = audioResponse.data;
            const userAudioFileUrl = await azure_blob.uploadToBlobStorage(audioBuffer, "audioFile.opus");
            const submissionDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
            await questionResponseRepository.create(user.dataValues.phone_number, user.dataValues.lesson_id, speakActivityQuestion.dataValues.id, activity, startingLesson.dataValues.activityAlias, null, userAudioFileUrl, true, 1, submissionDate);
            const nextSpeakActivityQuestion = await speakActivityQuestionRepository.getNextSpeakActivityQuestion(user.dataValues.lesson_id, user.dataValues.question_number);
            if (nextSpeakActivityQuestion) {
                await waUser.update_question(userMobileNumber, nextSpeakActivityQuestion.dataValues.questionNumber);
                await sendSpeakActivityQuestion(userMobileNumber, user, nextSpeakActivityQuestion, body, activity);
            } else {
                // Give total score here
                let message = "You have completed the Watch and Speak activity for this lesson.";
                await client.messages.create({
                    from: body.To,
                    body: message,
                    to: body.From,
                }).then(message => console.log("Speak Activity completion message sent + " + message.sid));
                await waUser.update_activity_question_lessonid(userMobileNumber, null, null);
                await sleep(2000);
                // Send template here for next lesson
                await client.messages.create({
                    from: "MG252cac2eba974fff75b1df0cab40ece7",
                    contentSid: "HXc714b662d9dcff30ff4c46bef490fb29",
                    to: body.From,
                }).then(message => console.log("Next lesson message sent + " + message.sid));
            }
        }
    }
    else if (activity === 'read') {
        // Send audio content
        const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
        // Iterate through the documentFile array and send each mediaUrl
        let englishAudio, urduAudio, image;
        for (let i = 0; i < documentFile.length; i++) {
            if (documentFile[i].dataValues.mediaType == 'image') {
                image = documentFile[i].dataValues.image;
            }
            else if (documentFile[i].dataValues.language == 'English') {
                // englishAudio = documentFile[i].dataValues.audio;
                englishAudio = "https://beajbloblive.blob.core.windows.net/test/15da300b-c49a-4f0b-9b0c-48646b7c_AACAudio_2Ch_192kbps.mp3"
            } else if (documentFile[i].dataValues.language == 'Urdu') {
                // urduAudio = documentFile[i].dataValues.audio;
                urduAudio = "https://beajbloblive.blob.core.windows.net/test/15da300b-c49a-4f0b-9b0c-48646b7c_AACAudio_2Ch_192kbps.mp3"
            }
        }


        // Send lesson message
        let lessonMessage = "Activity Name: " + startingLesson.dataValues.activityAlias;
        lessonMessage += "\n\nThis lesson contains a reading activity. Please listen to the audio and read the text.";
        if (startingLesson.dataValues.text) {
            lessonMessage += "\n\n" + stripHtmlTags(startingLesson.dataValues.text);
        }
        if (image) {
            await client.messages.create({
                from: body.To,
                mediaUrl: [image],
                body: lessonMessage,
                to: body.From,
            }).then(message => console.log("Image message sent + " + message.sid));
        } else {
            await client.messages.create({
                from: body.To,
                body: lessonMessage,
                to: body.From,
            }).then(message => console.log("Lesson message sent + " + message.sid));
        }

        await sleep(3000);
        if (englishAudio) {
            await client.messages.create({
                from: body.To,
                mediaUrl: [englishAudio],
                to: body.From,
            }).then(message => console.log("English audio message sent + " + message.sid));
        }
        if (urduAudio) {
            await client.messages.create({
                from: body.To,
                mediaUrl: [urduAudio],
                to: body.From,
            }).then(message => console.log("Urdu audio message sent + " + message.sid));
        }

        await sleep(20000);
        // Send template here for next lesson
        await client.messages.create({
            from: "MG252cac2eba974fff75b1df0cab40ece7",
            contentSid: "HXc714b662d9dcff30ff4c46bef490fb29",
            to: body.From,
        }).then(message => console.log("Next lesson message sent + " + message.sid));
    }
    else if (activity === 'audio') {
        // Get lesson documents
        const documentFile = await documentFileRepository.getByLessonId(startingLesson.dataValues.LessonId);
        let audio, image;
        for (let i = 0; i < documentFile.length; i++) {
            if (documentFile[i].dataValues.mediaType === 'audio') {
                // audio = documentFile[i].dataValues.audio;
                audio = "https://beajbloblive.blob.core.windows.net/test/15da300b-c49a-4f0b-9b0c-48646b7c_AACAudio_2Ch_192kbps.mp3"
            } else {
                image = documentFile[i].dataValues.image;
            }
        }


        // Send lesson message
        let lessonMessage = "Activity Name: " + startingLesson.dataValues.activityAlias;
        lessonMessage += "\n\nThis lesson contains an audio activity. Please listen to the audio and view the image.";
        if (startingLesson.dataValues.text) {
            lessonMessage += "\n\n" + stripHtmlTags(startingLesson.dataValues.text);
        }
        if (image) {
            await client.messages.create({
                from: body.To,
                body: lessonMessage,
                mediaUrl: [image],
                to: body.From,
            }).then(message => console.log("Lesson message sent + " + message.sid));
        } else {
            await client.messages.create({
                from: body.To,
                body: lessonMessage,
                to: body.From,
            }).then(message => console.log("Lesson message sent + " + message.sid));
        }

        // Add a delay before sending the audio content
        await sleep(2000);

        // Send audio content
        if (audio) {
            await client.messages.create({
                from: body.To,
                mediaUrl: [audio],
                to: body.From,
            }).then(message => console.log("Audio message sent + " + message.sid));
        }

        // Add a delay before sending the next lesson template
        await sleep(15000);

        // Send template here for next lesson
        await client.messages.create({
            from: "MG252cac2eba974fff75b1df0cab40ece7",
            contentSid: "HXc714b662d9dcff30ff4c46bef490fb29",
            to: body.From,
        }).then(message => console.log("Next lesson message sent + " + message.sid));
    }
};

const webhookService = async (body, res) => {
    try {
        const userMessage = body.Body.toLowerCase().trim();
        const userMobileNumber = body.From.split(":")[1];

        // Check if user exists in the database
        let user = await waUser.getByPhoneNumber(userMobileNumber);




        if (!user) {
            greeting_message(body);
            waUser.create(userMobileNumber, 'Teacher', 'Learning');
            const startingLesson = await lessonRepository.getNextLesson(94, 4, null, null);
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
            await get_lessons(userMobileNumber, user, startingLesson, body, userMessage);
            return;
        }

        if (userMessage === 'reset') {
            await waUser.deleteByPhoneNumber(userMobileNumber);
            client.messages.create({
                from: body.To,
                body: 'Your progress has been reset. You can start the course again.',
                to: body.From,
            }).then(message => console.log("Reset message sent + " + message.sid));
            return;
        }

        if (user.activity_type === 'mcqs' || user.activity_type === 'watchAndSpeak' || user.activity_type === 'listenAndSpeak' || user.activity_type === 'postListenAndSpeak' || user.activity_type === 'preListenAndSpeak' || user.activity_type === 'postMCQs' || user.activity_type === 'preMCQs') {
            const currentLesson = await lessonRepository.getCurrentLesson(user.dataValues.lesson_id);
            await get_lessons(userMobileNumber, user, currentLesson, body, userMessage);
            return;
        }


        const nextLesson = await lessonRepository.getNextLesson(user.dataValues.level, user.dataValues.week, user.dataValues.day, user.dataValues.lesson_sequence);
        await update_user(userMobileNumber, user, nextLesson);
        await get_lessons(userMobileNumber, user, nextLesson, body, userMessage);
        if (nextLesson === null) {
            client.messages.create({
                from: body.To,
                body: 'Congratulations! You have completed all the lessons for this course.',
                to: body.From,
            }).then(message => console.log("Completion message sent + " + message.sid));
            return;
        };
    } catch (error) {
        console.error('Error in chatBotService:', error);
        error.fileName = 'chatBotService.js';
        throw error;
    }
};

const statusWebhookService = async (body, res) => {
    if (body.SmsStatus === 'delivered') {
        const userMobileNumber = body.To.split(":")[1];
        const user = await waUser.getByPhoneNumber(userMobileNumber);
        const incomingMessageSid = body.MessageSid;
        const messageSidInDb = user.dataValues.message_sid;
        if (incomingMessageSid === messageSidInDb && user.dataValues.activity_type === 'video') {
            const currentLesson = await lessonRepository.getCurrentLesson(user.dataValues.lesson_id);
            const newBody = {
                From: body.To,
                To: body.From
            }
            await get_next_lesson(userMobileNumber, user, currentLesson, newBody, "userMessage");
        }
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

export default { webhookService, feedbackService, getAllFeedbackService, statusWebhookService };
