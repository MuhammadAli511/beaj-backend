import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";
import { sendMediaMessage, sendButtonMessage, sendMessage } from "./whatsappUtils.js";
import { createActivityLog } from "./createActivityLogUtils.js";
import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import { weekEndScoreCalculation, studentReportCardCalculation } from "./chatbotUtils.js";
import { weekEndImage, generateKidsCertificate } from "./imageGenerationUtils.js";
import { sleep, getDaysPerWeek, getTotalLessonsForCourse, getLevelFromCourseName } from "./utils.js";
import waConstantsRepository from "../repositories/waConstantsRepository.js";
import stickerMapping from "../constants/stickerMapping.js";
import { generateCertificate } from '../google_sheet_utils/certificate-utils.js';



const sendingSticker = async (profileId, userMobileNumber, currentUserState, startingLesson, message = null) => {
    // Check if the lesson is the last lesson of the day
    const lessonLast = await lessonRepository.isLastLessonOfDay(startingLesson.dataValues.LessonId);

    // Activity Complete Sticker - only send if not last lesson
    if (
        !lessonLast &&
        currentUserState.dataValues.persona == "teacher" &&
        startingLesson.dataValues.activityAlias !== "*Part A*" &&
        startingLesson.dataValues.activityAlias !== "*Part C*"
    ) {
        const activityCompleteSticker = "https://beajbloblive.blob.core.windows.net/beajdocuments/activity_complete.webp";
        await sendMediaMessage(userMobileNumber, activityCompleteSticker, 'sticker');
        await createActivityLog(userMobileNumber, "sticker", "outbound", activityCompleteSticker, null);
    }
    if (currentUserState.dataValues.persona == "kid") {
        if ((startingLesson.dataValues.engagement_type === "Free Trial - Kids - Level 1" || startingLesson.dataValues.engagement_type === "Free Trial - Kids - Level 3") && startingLesson.dataValues.activityType !== 'videoEnd') {
            const challengeCompleteSticker = "https://beajbloblive.blob.core.windows.net/beajdocuments/challenge_complete_with_text.webp"
            await sendMediaMessage(userMobileNumber, challengeCompleteSticker, 'sticker');
            await createActivityLog(userMobileNumber, "sticker", "outbound", challengeCompleteSticker, null);
        }
        let lowerCaseActivityAlias = startingLesson.dataValues.activityAlias.toLowerCase();
        lowerCaseActivityAlias = lowerCaseActivityAlias.replace(/'/g, '').replace(/’/g, '');
        lowerCaseActivityAlias = lowerCaseActivityAlias.trim();
        const sticker = stickerMapping[lowerCaseActivityAlias];
        if (sticker) {
            await sendMediaMessage(userMobileNumber, sticker, 'sticker');
            await createActivityLog(userMobileNumber, "sticker", "outbound", sticker, null);
        }
    }

    await sleep(3000);
};

const teacherTrialFlow = async (profileId, userMobileNumber, currentUserState, startingLesson, message = null) => {
    const lessonLast = await lessonRepository.isLastLessonOfDay(startingLesson.dataValues.LessonId);
    let user = await waUsersMetadataRepository.getByProfileId(profileId);
    let checkRegistrationComplete = user.dataValues.userRegistrationComplete !== null;
    if (!checkRegistrationComplete && lessonLast) {
        // Update acceptable messages list for the user
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["get another trial", "register"]);

        // Reply Buttons
        await sendButtonMessage(userMobileNumber, '👏🏽Trial Complete! 🤓', [{ id: 'get_another_trial', title: 'Get Another Trial' }, { id: 'register', title: 'Register' }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "get another trial or register", null);

        return;
    } else if (checkRegistrationComplete && lessonLast) {
        // Update acceptable messages list for the user
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["get another trial"]);


        // Reply Buttons
        await sendButtonMessage(userMobileNumber, '👏🏽Trial Complete! 🤓', [{ id: 'get_another_trial', title: 'Get Another Trial' }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "get another trial", null);

        return;
    } else if (!checkRegistrationComplete && !lessonLast) {
        // Update acceptable messages list for the user
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start next activity", "end now"]);

        // Reply Buttons
        await sendButtonMessage(userMobileNumber, '👏🏽Activity Complete! 🤓', [{ id: 'start_next_activity', title: 'Start Next Activity' }, { id: 'end_now', title: 'End Now' }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Activity or End Now", null);

        return;
    } else if (checkRegistrationComplete && !lessonLast) {
        // Update acceptable messages list for the user
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start next activity", "end now"]);

        // Reply Buttons
        await sendButtonMessage(userMobileNumber, '👏🏽Activity Complete! 🤓', [{ id: 'start_next_activity', title: 'Start Next Activity' }, { id: 'end_now', title: 'End Now' }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Activity or End Now", null);

        return;
    }
};

const kidsTrialFlow = async (profileId, userMobileNumber, currentUserState, startingLesson, message = null) => {
    const shellImageObject = await waConstantsRepository.getByKey("SHELL_IMAGE");
    const gemImageObject = await waConstantsRepository.getByKey("GEM_IMAGE");
    const lessonLast = await lessonRepository.isLastLessonOfDay(startingLesson.dataValues.LessonId);
    let trialCompleteobject = null;
    if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
        trialCompleteobject = gemImageObject;
    } else if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1") {
        trialCompleteobject = shellImageObject;
    }
    let user = await waUsersMetadataRepository.getByProfileId(profileId);
    let checkRegistrationComplete = user.dataValues.userRegistrationComplete !== null;
    if (startingLesson.dataValues.activityAlias == "📕 *Story Time!*") {
        let final_map_image = "";
        const level1Map = await waConstantsRepository.getByKey("LEVEL_1_MAP");
        const level3Map = await waConstantsRepository.getByKey("LEVEL_3_MAP");
        let message = "Start questions and win your first gem! 💎\nسوالات شروع کریں اور اپنا پہلا gem جیتیں!";
        if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1") {
            final_map_image = level1Map.dataValues.constantValue;
            await sendMediaMessage(userMobileNumber, final_map_image, "image", null, 0, "WA_Constants", level1Map.dataValues.id, level1Map.dataValues.constantMediaId, "constantMediaId");
            await createActivityLog(userMobileNumber, "image", "outbound", final_map_image, null);
        } else if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
            final_map_image = level3Map.dataValues.constantValue;
            await sendMediaMessage(userMobileNumber, final_map_image, "image", null, 0, "WA_Constants", level3Map.dataValues.id, level3Map.dataValues.constantMediaId, "constantMediaId");
            await createActivityLog(userMobileNumber, "image", "outbound", final_map_image, null);
        }
        await sleep(2000);
        let buttonsArray = [];
        if (checkRegistrationComplete) {
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start questions", "chat with beaj rep"]);
            buttonsArray = [{ id: 'start_questions', title: 'Start Questions' }, { id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }];
        } else {
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start questions", "chat with beaj rep"]);
            buttonsArray = [{ id: 'start_questions', title: 'Start Questions' }, { id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }];
        }
        // Reply Buttons
        if (message == null) {
            await sendButtonMessage(userMobileNumber, 'Start Questions!', buttonsArray);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start Questions or Chat with Beaj Rep", null);
        } else {
            await sendButtonMessage(userMobileNumber, message, buttonsArray);
            await createActivityLog(userMobileNumber, "template", "outbound", message, null);
        }
        return;
    }

    if (startingLesson.dataValues.activityAlias == "✨ *Fun Fact!*" || startingLesson.dataValues.activityAlias == "🧪 *Science Fun!*") {
        let funFactMessage = "To listen to Zara and Faiz’s story, click on ‘Next Activity’.\n\nزارا اور فےز کی کہانی جاننے کے لیئے، ‘Next Activity’ پہ کلک کریں۔";
        let scienceFunMessage = "To do a fun science question, click on ‘Next Activity’.\n\nسایئنس کا ایک مزیدار سوال کرنے کے لیئے ‘Next Activity’ پہ کلک کریں۔";
        let finalTextMessage = "";
        if (startingLesson.dataValues.activityAlias == "✨ *Fun Fact!*") {
            finalTextMessage = funFactMessage;
        } else if (startingLesson.dataValues.activityAlias == "🧪 *Science Fun!*") {
            finalTextMessage = scienceFunMessage;
        }
        let buttonsArray = [];
        if (checkRegistrationComplete) {
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["next activity", "chat with beaj rep"]);
            buttonsArray = [{ id: 'next_activity', title: 'Next Activity' }, { id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }];
        } else {
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["next activity", "chat with beaj rep"]);
            buttonsArray = [{ id: 'next_activity', title: 'Next Activity' }, { id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }];
        }
        // Reply Buttons
        if (message == null) {
            await sendButtonMessage(userMobileNumber, finalTextMessage, buttonsArray);
            await createActivityLog(userMobileNumber, "template", "outbound", "Next Activity or Chat with Beaj Rep", null);
        } else {
            await sendButtonMessage(userMobileNumber, message, buttonsArray);
            await createActivityLog(userMobileNumber, "template", "outbound", message, null);
        }
        return;
    }

    if (!checkRegistrationComplete && lessonLast) {
        // Update acceptable messages list for the user
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["get another trial"]);
        let buttonsArray = [{ id: 'get_another_trial', title: 'Get Another Trial' }];

        let trialCompleteMessage = `📍Your Free Trial ends here.\nیہاں آپ کا فری ٹرائل ختم ہوتا ہے۔`;
        if (message == null) {
            await sendButtonMessage(userMobileNumber, trialCompleteMessage, buttonsArray, 0, trialCompleteobject.dataValues.constantValue, null, "WA_Constants", trialCompleteobject.dataValues.id, trialCompleteobject.dataValues.constantMediaId, null, "constantMediaId");
            await createActivityLog(userMobileNumber, "template", "outbound", "get another trial", null);
        } else {
            message += "\n\n" + trialCompleteMessage;
            await sendButtonMessage(userMobileNumber, message, buttonsArray, 0, trialCompleteobject.dataValues.constantValue, null, "WA_Constants", trialCompleteobject.dataValues.id, trialCompleteobject.dataValues.constantMediaId, null, "constantMediaId");
            await createActivityLog(userMobileNumber, "template", "outbound", message, null);
        }

        return;
    } else if (checkRegistrationComplete && lessonLast) {
        // Update acceptable messages list for the user
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["get another trial"]);
        let buttonsArray = [{ id: 'get_another_trial', title: 'Get Another Trial' }];

        let trialCompleteMessage = `📍Your Free Trial ends here.\nیہاں آپ کا فری ٹرائل ختم ہوتا ہے۔\n\n`;
        if (message == null) {
            await sendButtonMessage(userMobileNumber, trialCompleteMessage, buttonsArray, 0, trialCompleteobject.dataValues.constantValue, null, "WA_Constants", trialCompleteobject.dataValues.id, trialCompleteobject.dataValues.constantMediaId, null, "constantMediaId");
            await createActivityLog(userMobileNumber, "template", "outbound", "get another trial", null);
        } else {
            message += "\n\n" + trialCompleteMessage;
            await sendButtonMessage(userMobileNumber, message, buttonsArray, 0, trialCompleteobject.dataValues.constantValue, null, "WA_Constants", trialCompleteobject.dataValues.id, trialCompleteobject.dataValues.constantMediaId, null, "constantMediaId");
            await createActivityLog(userMobileNumber, "template", "outbound", message, null);
        }

        return;
    } else if (!checkRegistrationComplete && !lessonLast) {
        // Update acceptable messages list for the user
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["next activity", "chat with beaj rep"]);
        let buttonsArray = [{ id: 'next_activity', title: 'Next Activity' }, { id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }];


        // Reply Buttons
        if (message == null) {
            await sendButtonMessage(userMobileNumber, 'Challenge Complete! 💪🏽', buttonsArray);
            await createActivityLog(userMobileNumber, "template", "outbound", "Next Activity or Chat with Beaj Rep", null);
        } else {
            await sendButtonMessage(userMobileNumber, message, buttonsArray);
            await createActivityLog(userMobileNumber, "template", "outbound", message, null);
        }

        return;
    } else if (checkRegistrationComplete && !lessonLast) {
        // Update acceptable messages list for the user
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["next activity", "chat with beaj rep"]);
        let buttonsArray = [{ id: 'next_activity', title: 'Next Activity' }, { id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }];

        // Reply Buttons
        if (message == null) {
            await sendButtonMessage(userMobileNumber, 'Challenge Complete! 💪🏽', buttonsArray);
            await createActivityLog(userMobileNumber, "template", "outbound", "Next Activity or Chat with Beaj Rep", null);
        } else {
            await sendButtonMessage(userMobileNumber, message, buttonsArray);
            await createActivityLog(userMobileNumber, "template", "outbound", message, null);
        }

        return;
    }
};

const teacherCourseFlow = async (profileId, userMobileNumber, currentUserState, startingLesson, message = null) => {
    const lessonLast = await lessonRepository.isLastLessonOfDay(startingLesson.dataValues.LessonId);
    if (lessonLast) {
        const courseName = await courseRepository.getCourseNameById(currentUserState.currentCourseId);
        const strippedCourseName = courseName.split("-")[0].trim();
        // Lesson Number
        const daysPerWeek = await getDaysPerWeek(profileId);
        const totalLessons = await getTotalLessonsForCourse(profileId);
        const lessonNumber = (startingLesson.dataValues.weekNumber - 1) * daysPerWeek + startingLesson.dataValues.dayNumber;

        let goldBarCaption = "";

        // Lesson Complete Message
        let lessonCompleteMessage = "";
        if (lessonNumber == totalLessons && strippedCourseName == "Level 4") {
            lessonCompleteMessage = "You have completed all 3 levels of the Beaj Self-Development Course! 🌟";
        } else {
            lessonCompleteMessage = "You have completed *" + lessonNumber + " out of " + totalLessons + "* lessons in " + strippedCourseName + "!⭐️";
        }
        goldBarCaption = lessonCompleteMessage;

        // Lesson Complete Image
        // Gold Bars
        if (strippedCourseName != "Level 0" && strippedCourseName != "Level 4") {
            const smallCourseName = strippedCourseName.replace(/\s/g, '').toLowerCase();
            const imageTag = "lesson_complete_image_lesson_" + lessonNumber.toString() + "_" + smallCourseName;
            let fileExtnesion = ".jpg";
            let lessonCompleteImage = "";
            if (lessonNumber == totalLessons && strippedCourseName == "Level 3") {
                lessonCompleteImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/course_end_gold_bars" + fileExtnesion;
            } else {
                lessonCompleteImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/" + imageTag + fileExtnesion;
            }
            await sendMediaMessage(userMobileNumber, lessonCompleteImage, 'image', goldBarCaption);
            await createActivityLog(userMobileNumber, "image", "outbound", lessonCompleteImage, null, goldBarCaption);
            await sleep(5000);

            // Week end score image
            if (startingLesson.dataValues.dayNumber == daysPerWeek) {
                const weekEndScore = await weekEndScoreCalculation(profileId, userMobileNumber, startingLesson.dataValues.weekNumber, currentUserState.currentCourseId);
                const weekEndScoreImage = await weekEndImage(weekEndScore, startingLesson.dataValues.weekNumber);
                await sendMediaMessage(userMobileNumber, weekEndScoreImage, 'image');
                await createActivityLog(userMobileNumber, "image", "outbound", weekEndScoreImage, null);
                await sleep(5000);
            }
        }

        if (strippedCourseName == "Level 4") {
            const fizza_level3 = await waConstantsRepository.getByKey("FIZZA_LEVEL_3");
            await sendMediaMessage(userMobileNumber, fizza_level3.dataValues.constantValue, 'video', null, 0, "WA_Constants", fizza_level3.dataValues.id, fizza_level3.dataValues.constantMediaId, "constantMediaId");
            await createActivityLog(userMobileNumber, "video", "outbound", fizza_level3.dataValues.constantValue, null);
            await sleep(12000);
            let endingMessageLevel3 = "🎓 This brings us to the end of Beaj Education's Self Development Course! \n\nWe thank you for your time and dedication and hope your learning journey continues!\n\nBest wishes,\nTeam Beaj"
            const level3Ender = await waConstantsRepository.getByKey("LEVEL_3_ENDER");
            let endingImageLevel3 = level3Ender.dataValues.constantValue;
            await sendMediaMessage(userMobileNumber, endingImageLevel3, 'image', endingMessageLevel3, 0, "WA_Constants", level3Ender.dataValues.id, level3Ender.dataValues.constantMediaId, "constantMediaId");
            await createActivityLog(userMobileNumber, "image", "outbound", endingImageLevel3, null, endingMessageLevel3);
            const username = await waUsersMetadataRepository.getByProfileId(profileId);
            if (username.name) {
                const cert_url = await generateCertificate(username.name);
                await sendMediaMessage(userMobileNumber, cert_url, 'image', "Course Completion Certificate");
                await createActivityLog(userMobileNumber, "image", "outbound", cert_url, "Course Completion Certificate");
            }
        }

        // Feedback Message
        if (
            (strippedCourseName == "Level 1" && lessonNumber > 10) ||
            (strippedCourseName == "Level 2" && lessonNumber > 0) ||
            (strippedCourseName == "Level 3" && lessonNumber > 0)
        ) {
            if (lessonNumber != totalLessons && lessonNumber != 3) {
                const randomNumber = Math.floor(Math.random() * 100) + 1;
                if (randomNumber >= 75) {
                    let cleanedAlias = startingLesson.dataValues.activityAlias.replace(/\?/g, '');
                    let feedbackMessage = "We need your feedback to keep improving our course. How would you rate " + cleanedAlias + " activity?";
                    await sendButtonMessage(userMobileNumber, feedbackMessage, [{ id: 'feedback_1', title: 'It was great 😁' }, { id: 'feedback_2', title: 'It can be improved 🤔' }]);
                    await createActivityLog(userMobileNumber, "template", "outbound", feedbackMessage, null);
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start next lesson", "it was great 😁", "it can be improved 🤔"]);
                } else {
                    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start next lesson"]);
                }
            }
        }


        // Sleep
        if (strippedCourseName != "Level 0") {
            await sleep(5000);
        }

        if (strippedCourseName == "Level 4") {
            const congratsImage = await waConstantsRepository.getByKey("LEVEL_3_CONGRATULATIONS");
            await sendMediaMessage(userMobileNumber, congratsImage.dataValues.constantValue, 'image', null, 0, "WA_Constants", congratsImage.dataValues.id, congratsImage.dataValues.constantMediaId, "constantMediaId");
            await createActivityLog(userMobileNumber, "image", "outbound", congratsImage.dataValues.constantValue, null);
            await sleep(5000);
        } else if (strippedCourseName == "Level 0") {
            const warmupCompleteImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/warmup_complete.jpeg";
            await sendMediaMessage(userMobileNumber, warmupCompleteImage, 'image', null);
            await createActivityLog(userMobileNumber, "image", "outbound", warmupCompleteImage, null);
            await sleep(2000);
            await sendButtonMessage(userMobileNumber, 'Are you ready to start your first level?', [{ id: 'start_level_1', title: 'Start Level 1' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start Level 1", null);
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start level 1"]);
        } else {
            await sendButtonMessage(userMobileNumber, 'Are you ready to start your next lesson?', [{ id: 'start_next_lesson', title: 'Start Next Lesson' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Lesson", null);
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start next lesson"]);
        }
    } else {
        const daysPerWeek = await getDaysPerWeek(profileId);
        const lessonNumber = (startingLesson.dataValues.weekNumber - 1) * daysPerWeek + startingLesson.dataValues.dayNumber;
        const courseName = await courseRepository.getCourseNameById(currentUserState.currentCourseId);
        const strippedCourseName = courseName.split("-")[0].trim();
        if (
            (strippedCourseName == "Level 1" && lessonNumber > 10) ||
            (strippedCourseName == "Level 2" && lessonNumber > 0) ||
            (strippedCourseName == "Level 3" && lessonNumber > 0)
        ) {
            const randomNumber = Math.floor(Math.random() * 100) + 1;
            if (randomNumber >= 75) {
                let cleanedAlias = startingLesson.dataValues.activityAlias.replace(/\?/g, '');
                let feedbackMessage = "We need your feedback to keep improving our course. How would you rate " + cleanedAlias + " activity?";
                await sendButtonMessage(userMobileNumber, feedbackMessage, [{ id: 'feedback_1', title: 'It was great 😁' }, { id: 'feedback_2', title: 'It can be improved 🤔' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", feedbackMessage, null);
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start next activity", "it was great 😁", "it can be improved 🤔"]);
            } else {
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start next activity"]);
            }
        }

        // Sleep
        await sleep(2000);

        // Reply Buttons
        if (
            startingLesson.dataValues.activityAlias == "*Part A*" ||
            startingLesson.dataValues.activityAlias == "*Part C*"
        ) {
            let message = "Are you ready to start questions?"
            await sendButtonMessage(userMobileNumber, message, [{ id: 'start_questions', title: 'Start Questions' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", message, null);
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start questions"]);
        } else {
            await sendButtonMessage(userMobileNumber, 'Are you ready to start the next activity?', [{ id: 'start_next_activity', title: 'Start Next Activity' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Activity", null);
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start next activity"]);
        }
    }
};

const assessmentPuzzleImages = async (userMobileNumber, activityAlias, courseName) => {
    const level = getLevelFromCourseName(courseName);
    if (activityAlias == "💪 *Game 1: English Champions Activity A*") {
        const finalKey = "LEVEL" + level + "PUZZLE2";
        const puzzle2 = await waConstantsRepository.getByKey(finalKey);
        if (puzzle2) {
            let captionText = "Woooh! Congratulations on unlocking 1/4th of the puzzle! 🧩";
            await sendMediaMessage(userMobileNumber, puzzle2.dataValues.constantValue, 'image', captionText, 0, "WA_Constants", puzzle2.dataValues.id, puzzle2.dataValues.constantMediaId, "constantMediaId");
            await createActivityLog(userMobileNumber, "image", "outbound", puzzle2.dataValues.constantValue, null, captionText);
            await sleep(2000);
        }
    } else if (activityAlias == "🗣 *Game 1: English Champions Activity B*") {
        const finalKey = "LEVEL" + level + "PUZZLE3";
        const puzzle3 = await waConstantsRepository.getByKey(finalKey);
        if (puzzle3) {
            let captionText = "Woooh! Congratulations on unlocking 2/4th of the puzzle! 🧩";
            await sendMediaMessage(userMobileNumber, puzzle3.dataValues.constantValue, 'image', captionText, 0, "WA_Constants", puzzle3.dataValues.id, puzzle3.dataValues.constantMediaId, "constantMediaId");
            await createActivityLog(userMobileNumber, "image", "outbound", puzzle3.dataValues.constantValue, null, captionText);
            await sleep(2000);
        }
    } else if (activityAlias == "🧮 *Game 2: Number Ninjas Activity*") {
        const finalKey = "LEVEL" + level + "PUZZLE4";
        const puzzle4 = await waConstantsRepository.getByKey(finalKey);
        if (puzzle4) {
            let captionText = "Woooh! Congratulations on unlocking 3/4th of the puzzle! 🧩";
            await sendMediaMessage(userMobileNumber, puzzle4.dataValues.constantValue, 'image', captionText, 0, "WA_Constants", puzzle4.dataValues.id, puzzle4.dataValues.constantMediaId, "constantMediaId");
            await createActivityLog(userMobileNumber, "image", "outbound", puzzle4.dataValues.constantValue, null, captionText);
            await sleep(2000);
        }
    } else if (activityAlias == "💡 *Game 3: Super YOU! Activity*") {
        const finalKey = "LEVEL" + level + "PUZZLE5";
        const puzzle5 = await waConstantsRepository.getByKey(finalKey);
        if (puzzle5) {
            let captionText = "Woooh! Congratulations! You did it! You unlocked the camp! 🧩";
            await sendMediaMessage(userMobileNumber, puzzle5.dataValues.constantValue, 'image', captionText, 0, "WA_Constants", puzzle5.dataValues.id, puzzle5.dataValues.constantMediaId, "constantMediaId");
            await createActivityLog(userMobileNumber, "image", "outbound", puzzle5.dataValues.constantValue, null, captionText);
            await sleep(2000);
        }
    }

    // LEVEL4
    if (activityAlias == "*You Can Speak!*") {
        const finalKey = "LEVEL" + level + "PUZZLE2";
        const puzzle2 = await waConstantsRepository.getByKey(finalKey);
        if (puzzle2) {
            let captionText = "Woooh! Congratulations on unlocking 2/4th of the puzzle! 🧩";
            await sendMediaMessage(userMobileNumber, puzzle2.dataValues.constantValue, 'image', captionText, 0, "WA_Constants", puzzle2.dataValues.id, puzzle2.dataValues.constantMediaId, "constantMediaId");
            await createActivityLog(userMobileNumber, "image", "outbound", puzzle2.dataValues.constantValue, null, captionText);
            await sleep(2000);
        }
    } else if (activityAlias == "💡 *Game 2: Super YOU! Activity*") {
        const finalKey = "LEVEL" + level + "PUZZLE3";
        const puzzle3 = await waConstantsRepository.getByKey(finalKey);
        if (puzzle3) {
            let captionText = "Woooh! Congratulations! You did it! You unlocked the camp! 🧩";
            await sendMediaMessage(userMobileNumber, puzzle3.dataValues.constantValue, 'image', captionText, 0, "WA_Constants", puzzle3.dataValues.id, puzzle3.dataValues.constantMediaId, "constantMediaId");
            await createActivityLog(userMobileNumber, "image", "outbound", puzzle3.dataValues.constantValue, null, captionText);
            await sleep(2000);
        }
    }
}

const kidsCourseFlow = async (profileId, userMobileNumber, currentUserState, startingLesson, message = null) => {
    const activityAlias = startingLesson.dataValues.activityAlias;
    const lessonLast = await lessonRepository.isLastLessonOfDay(startingLesson.dataValues.LessonId);
    const courseName = await courseRepository.getCourseNameById(currentUserState.currentCourseId);
    if (courseName.toLowerCase().includes("pre")) {
        await assessmentPuzzleImages(userMobileNumber, activityAlias, courseName);
    }
    const daysPerWeek = await getDaysPerWeek(profileId);
    const dayNumber = (startingLesson.dataValues.weekNumber - 1) * daysPerWeek + startingLesson.dataValues.dayNumber;
    const level = getLevelFromCourseName(courseName);
    // Lesson Ending Message
    if (lessonLast && dayNumber != 20) {
        if (courseName.toLowerCase().includes("assessment")) {
            const comeBackTomorrowAudio = await waConstantsRepository.getByKey("COME_BACK_TOMORROW");
            await sendMediaMessage(userMobileNumber, comeBackTomorrowAudio.dataValues.constantValue, 'audio', null, 0, "WA_Constants", comeBackTomorrowAudio.dataValues.id, comeBackTomorrowAudio.dataValues.constantMediaId, "constantMediaId");
            await createActivityLog(userMobileNumber, "audio", "outbound", comeBackTomorrowAudio.dataValues.constantValue, null);
            await sleep(2000);
            await sendButtonMessage(userMobileNumber, 'Come back tomorrow for your next game!', [{ id: 'start_next_game', title: 'Start Next Game' }, { id: 'change_user', title: 'Change User' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Game", null);
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start next game", "change user"]);
        }
        else {
            const imageUrl = "https://beajbloblive.blob.core.windows.net/beajdocuments/kids_updated_badges_level" + level + "_day_" + dayNumber + "_end.jpg";
            let captionText = "Day " + dayNumber + " Complete! 🥳";
            await sendMediaMessage(userMobileNumber, imageUrl, 'image', captionText);
            await createActivityLog(userMobileNumber, "image", "outbound", imageUrl, null);
            await sleep(3000);
            if (startingLesson.dataValues.dayNumber == daysPerWeek) {
                const semalKidsWeekComplete = await waConstantsRepository.getByKey("SEMAL_KIDS_WEEK_COMPLETE");
                await sendMediaMessage(userMobileNumber, semalKidsWeekComplete.dataValues.constantValue, 'audio', null, 0, "WA_Constants", semalKidsWeekComplete.dataValues.id, semalKidsWeekComplete.dataValues.constantMediaId, "constantMediaId");
                await createActivityLog(userMobileNumber, "audio", "outbound", semalKidsWeekComplete.dataValues.constantValue, null);
                await sleep(3000);
                let key = "LEVEL" + level + "WEEK" + startingLesson.dataValues.weekNumber;
                const weekEndImage = await waConstantsRepository.getByKey(key);
                await sendMediaMessage(userMobileNumber, weekEndImage.dataValues.constantValue, 'image', null, 0, "WA_Constants", weekEndImage.dataValues.id, weekEndImage.dataValues.constantMediaId, "constantMediaId");
                await createActivityLog(userMobileNumber, "image", "outbound", weekEndImage.dataValues.constantValue, null);
                await sleep(2000);
            }
            await sendButtonMessage(userMobileNumber, 'Are you ready to start your next lesson?', [{ id: 'start_next_lesson', title: 'Start Next Lesson' }, { id: 'change_user', title: 'Change User' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Lesson", null);
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start next lesson", "change user"]);
        }
    }
    else {
        if (
            activityAlias == "📕 *Story Time!*" ||
            activityAlias == "🧮 *Maths Fun!*" ||
            activityAlias == "🧪 *Science Fun!*" ||
            activityAlias == "🗣 *Grammar Fun!*" ||
            activityAlias == "🌍 *Let's explore!*" ||
            activityAlias == "🌍 *Let's Explore!*" ||
            activityAlias == "🧠 *Let's Grow!*" ||
            activityAlias == "*Let's Listen* 🎧"
        ) {
            let message = "👇 Click on the button below to start questions!"
            await sendButtonMessage(userMobileNumber, message, [{ id: 'start_questions', title: 'Start Questions' }, { id: 'change_user', title: 'Change User' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", message, null);
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start questions", "change user"]);
        } else if (
            activityAlias == "💪 *Game 1: English Champions Part A*" ||
            activityAlias == "🗣 *Game 1: English Champions Part B*" ||
            activityAlias == "🧮 *Game 2: Number Ninjas!*" ||
            activityAlias == "💡 *Game 3: Super YOU!*"
        ) {
            await sendButtonMessage(userMobileNumber, 'Are you ready?', [{ id: 'let_s_start', title: 'Let\'s Start' }, { id: 'change_user', title: 'Change User' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Let's Start", null);
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["let's start", "change user"]);
        } else if (
            activityAlias == "💪 *Game 1: English Champions Activity A*"
        ) {
            const anumPartAUnlocked = await waConstantsRepository.getByKey("ANUM_PART_A_UNLOCKED");
            await sendMediaMessage(userMobileNumber, anumPartAUnlocked.dataValues.constantValue, 'audio', null, 0, "WA_Constants", anumPartAUnlocked.dataValues.id, anumPartAUnlocked.dataValues.constantMediaId, "constantMediaId");
            await createActivityLog(userMobileNumber, "audio", "outbound", anumPartAUnlocked.dataValues.constantValue, null);
            await sleep(2000);
            await sendButtonMessage(userMobileNumber, 'Are you ready?', [{ id: 'start_part_b', title: 'Start Part B' }, { id: 'change_user', title: 'Change User' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start Part B", null);
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start part b", "change user"]);
        } else if (
            activityAlias == "🌍 *Let's Explore Part 1!*" ||
            activityAlias == "🌍 *Do You Remember? Part 1*" ||
            activityAlias == "🧮 *Maths Fun Part 1!*" ||
            activityAlias == "🧠 *Let's Grow Part 1!*" ||
            activityAlias == "🧪 *Science Fun Part 1!*"
        ) {
            await sendButtonMessage(userMobileNumber, '👇 Click on the button below to watch Part 2 of the video!', [{ id: 'start_part_2', title: 'Start Part 2' }, { id: 'change_user', title: 'Change User' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start Part 2", null);
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start part 2", "change user"]);
        } else if (
            activityAlias == "🔤 *Phonics Fun!*"
        ) {
            await sendButtonMessage(userMobileNumber, 'Are you ready to start practice?', [{ id: 'start_practice', title: 'Start Practice' }, { id: 'change_user', title: 'Change User' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Are you ready to start practice?", null);
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start practice", "change user"]);
        } else if (
            activityAlias.toLowerCase().includes("speaking activities complete") && dayNumber == 20
        ) {
            const userMetadata = await waUsersMetadataRepository.getByProfileId(profileId);
            const name = userMetadata.dataValues.name;
            let loadingMessage = "Loading your report card!\n\nPlease give us a few seconds..";
            await sendMessage(userMobileNumber, loadingMessage);
            await createActivityLog(userMobileNumber, "text", "outbound", loadingMessage);
            const reportCard = await studentReportCardCalculation(profileId, userMobileNumber);
            await sendMediaMessage(userMobileNumber, reportCard, 'image');
            await createActivityLog(userMobileNumber, "image", "outbound", reportCard);
            await sleep(2000);
            const { imageUrl, pdfUrl } = await generateKidsCertificate(name, level);
            await sendMediaMessage(userMobileNumber, imageUrl, 'image');
            await createActivityLog(userMobileNumber, "image", "outbound", imageUrl);
            await sendMediaMessage(userMobileNumber, pdfUrl, 'pdf', "Certificate");
            await createActivityLog(userMobileNumber, "pdf", "outbound", pdfUrl);
            await sleep(6000);
            const audioUrl = "https://beajbloblive.blob.core.windows.net/beajdocuments/beaj_summer_camp_end.mp3";
            await sendMediaMessage(userMobileNumber, audioUrl, 'audio', null);
            await createActivityLog(userMobileNumber, "audio", "outbound", audioUrl, null);
            await sleep(3000);
            await sendButtonMessage(userMobileNumber, 'Are you ready to start the next activity? 👊', [{ id: 'start_next_activity', title: 'Start Next Activity' }, { id: 'change_user', title: 'Change User' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Activity", null);
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start next activity", "change user"]);
        } else {
            await sendButtonMessage(userMobileNumber, 'Are you ready to start the next activity? 👊', [{ id: 'start_next_activity', title: 'Start Next Activity' }, { id: 'change_user', title: 'Change User' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Activity", null);
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start next activity", "change user"]);
        }
    }
};

const endingMessage = async (profileId, userMobileNumber, currentUserState, startingLesson, message = null) => {
    // If activity is video return
    if (startingLesson.dataValues.activity === 'video') {
        return;
    }
    await waLessonsCompletedRepository.endLessonByPhoneNumberLessonIdAndProfileId(userMobileNumber, startingLesson.dataValues.LessonId, profileId);
    await sendingSticker(profileId, userMobileNumber, currentUserState, startingLesson, message);

    if (currentUserState.dataValues.engagement_type == "Free Trial - Teachers") {
        await teacherTrialFlow(profileId, userMobileNumber, currentUserState, startingLesson, message);
    }
    else if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
        await kidsTrialFlow(profileId, userMobileNumber, currentUserState, startingLesson, message);
    }

    if (currentUserState.dataValues.engagement_type == "Course Start" && currentUserState.dataValues.persona == "teacher") {
        await teacherCourseFlow(profileId, userMobileNumber, currentUserState, startingLesson, message);
    }
    else if (currentUserState.dataValues.engagement_type == "Course Start" && currentUserState.dataValues.persona == "kid") {
        await kidsCourseFlow(profileId, userMobileNumber, currentUserState, startingLesson, message);
    }
};


export {
    endingMessage
};