import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";
import { sendMediaMessage, sendButtonMessage } from "./whatsappUtils.js";
import { createActivityLog } from "./createActivityLogUtils.js";
import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import { weekEndScoreCalculation } from "./chatbotUtils.js";
import { weekEndImage } from "./imageGenerationUtils.js";
import { sleep } from "./utils.js";


const getDayEndingMessage = (dayNumber) => {
    if (dayNumber == 1) {
        return "Now go to your class-group to *practise vocabulary with your teacher and group!* See you tomorrow!👋🏽";
    } else if (dayNumber == 2 || dayNumber == 3) {
        return "Now go to your class-group to *learn 'Teaching Expressions' with your teacher and group!* See you tomorrow!👋🏽";
    } else if (dayNumber == 4) {
        return "See you tomorrow!👋🏽";
    } else if (dayNumber == 5) {
        return "Now go to your class-group to *reflect with your teacher and group!* See you tomorrow!👋🏽";
    }
};

const endingMessage = async (profileId, userMobileNumber, currentUserState, startingLesson, message = null) => {
    // If activity is video return
    if (startingLesson.dataValues.activity === 'video') {
        return;
    }

    await waLessonsCompletedRepository.endLessonByPhoneNumberLessonIdAndProfileId(userMobileNumber, startingLesson.dataValues.LessonId, profileId);

    // Check if the lesson is the last lesson of the day
    const lessonLast = await lessonRepository.isLastLessonOfDay(startingLesson.dataValues.LessonId);

    // Activity Complete Sticker - only send if not last lesson
    if (!lessonLast && currentUserState.dataValues.persona == "teacher") {
        const activityCompleteSticker = "https://beajbloblive.blob.core.windows.net/beajdocuments/activity_complete.webp";
        await sendMediaMessage(userMobileNumber, activityCompleteSticker, 'sticker');
        await createActivityLog(userMobileNumber, "sticker", "outbound", activityCompleteSticker, null);
    }
    if (!lessonLast && currentUserState.dataValues.persona == "kid") {
        if (!(currentUserState.dataValues.currentWeek == 1 && currentUserState.dataValues.currentDay == 1 && currentUserState.dataValues.currentLesson_sequence == 1)) {
            if (startingLesson.dataValues.activityAlias != "🧠 *Let's Think!*") {
                const challengeCompleteSticker = "https://beajbloblive.blob.core.windows.net/beajdocuments/challenge_complete_with_text.webp"
                await sendMediaMessage(userMobileNumber, challengeCompleteSticker, 'sticker');
                await createActivityLog(userMobileNumber, "sticker", "outbound", challengeCompleteSticker, null);
            }
        }
    }

    await sleep(3000);


    if (currentUserState.dataValues.engagement_type == "Free Trial - Teachers") {
        let user = await waUsersMetadataRepository.getByProfileId(profileId);
        let checkRegistrationComplete = user.dataValues.userRegistrationComplete !== null;
        if (checkRegistrationComplete == false && lessonLast == true) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["get another trial", "register"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            await sendButtonMessage(userMobileNumber, '👏🏽Trial Complete! 🤓', [{ id: 'get_another_trial', title: 'Get Another Trial' }, { id: 'register', title: 'Register' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "get another trial or register", null);

            return;
        } else if (checkRegistrationComplete == true && lessonLast == true) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["get another trial"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            await sendButtonMessage(userMobileNumber, '👏🏽Trial Complete! 🤓', [{ id: 'get_another_trial', title: 'Get Another Trial' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "get another trial", null);

            return;
        } else if (checkRegistrationComplete == false && lessonLast == false) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start next activity", "end now"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            await sendButtonMessage(userMobileNumber, '👏🏽Activity Complete! 🤓', [{ id: 'start_next_activity', title: 'Start Next Activity' }, { id: 'end_now', title: 'End Now' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Activity or End Now", null);

            return;
        } else if (checkRegistrationComplete == true && lessonLast == false) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start next activity", "end now"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            await sendButtonMessage(userMobileNumber, '👏🏽Activity Complete! 🤓', [{ id: 'start_next_activity', title: 'Start Next Activity' }, { id: 'end_now', title: 'End Now' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Activity or End Now", null);

            return;
        }
    }
    else if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
        let user = await waUsersMetadataRepository.getByProfileId(profileId);
        let checkRegistrationComplete = user.dataValues.userRegistrationComplete !== null;
        if (startingLesson.dataValues.activityAlias == "🧠 *Let's Think!*") {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start challenge", "end now"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            if (message == null) {
                await sendButtonMessage(userMobileNumber, 'Start Challenge!', [{ id: 'start_challenge', title: 'Start Challenge' }, { id: 'end_now', title: 'End Now' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", "Start Challenge or End Now", null);
            } else {
                await sendButtonMessage(userMobileNumber, message, [{ id: 'start_challenge', title: 'Start Challenge' }, { id: 'end_now', title: 'End Now' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", message, null);
            }

            return;
        }
        if (currentUserState.dataValues.currentWeek == 1 && currentUserState.dataValues.currentDay == 1 && currentUserState.dataValues.currentLesson_sequence == 1) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start challenge", "end now"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            let finalImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/ready_for_your_first_challenge.jpeg";
            if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                finalImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/ready_for_your_first_challenge_level_3_final.jpg";
            } else if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1") {
                finalImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/ready_for_your_first_challenge_level_1_final.jpg";
            }
            let readyMessage = "Ready for your first challenge? 💪\nاپنے پہلے چیلنج کے لیے تیار ہیں؟";
            await sendButtonMessage(userMobileNumber, readyMessage, [{ id: 'start_challenge', title: 'Start Challenge' }, { id: 'end_now', title: 'End Now' }], 0, finalImage);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start Challenge or End Now", null);

            return;
        }

        if (checkRegistrationComplete == false && lessonLast == true) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["get another trial", "register"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            if (message == null) {
                await sendButtonMessage(userMobileNumber, '👏🏽Trial Complete! 🤓', [{ id: 'get_another_trial', title: 'Get Another Trial' }, { id: 'register', title: 'Register' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", "get another trial or register", null);
            } else {
                message += "\n\n👏🏽Trial Complete! 🤓";
                await sendButtonMessage(userMobileNumber, message, [{ id: 'get_another_trial', title: 'Get Another Trial' }, { id: 'register', title: 'Register' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", message, null);
            }

            return;
        } else if (checkRegistrationComplete == true && lessonLast == true) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["get another trial"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            if (message == null) {
                await sendButtonMessage(userMobileNumber, '👏🏽Trial Complete! 🤓', [{ id: 'get_another_trial', title: 'Get Another Trial' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", "get another trial", null);
            } else {
                message += "\n\n👏🏽Trial Complete! 🤓";
                await sendButtonMessage(userMobileNumber, message, [{ id: 'get_another_trial', title: 'Get Another Trial' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", message, null);
            }

            return;
        } else if (checkRegistrationComplete == false && lessonLast == false) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["next challenge", "end now"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            if (message == null) {
                await sendButtonMessage(userMobileNumber, 'Challenge Complete! 💪🏽', [{ id: 'next_challenge', title: 'Next Challenge' }, { id: 'end_now', title: 'End Now' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", "Next Challenge or End Now", null);
            } else {
                await sendButtonMessage(userMobileNumber, message, [{ id: 'next_challenge', title: 'Next Challenge' }, { id: 'end_now', title: 'End Now' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", message, null);
            }

            return;
        } else if (checkRegistrationComplete == true && lessonLast == false) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["next challenge", "end now"]);

            // Sleep
            await sleep(2000);

            // Reply Buttons
            if (message == null) {
                await sendButtonMessage(userMobileNumber, 'Challenge Complete! 💪🏽', [{ id: 'next_challenge', title: 'Next Challenge' }, { id: 'end_now', title: 'End Now' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", "Next Challenge or End Now", null);
            } else {
                await sendButtonMessage(userMobileNumber, message, [{ id: 'next_challenge', title: 'Next Challenge' }, { id: 'end_now', title: 'End Now' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", message, null);
            }

            return;
        }
    }



    // FOR ALL ACTIVITIES
    if (lessonLast) {
        const courseName = await courseRepository.getCourseNameById(currentUserState.currentCourseId);
        const strippedCourseName = courseName.split("-")[0].trim();
        // Lesson Number
        const lessonNumber = (startingLesson.dataValues.weekNumber - 1) * 6 + startingLesson.dataValues.dayNumber;

        let goldBarCaption = "";

        // Lesson Complete Message
        let lessonCompleteMessage = "";
        if (lessonNumber == 24 && strippedCourseName == "Level 3") {
            lessonCompleteMessage = "You have completed all 3 levels of the Beaj Self-Development Course! 🌟";
        } else {
            lessonCompleteMessage = "You have completed *" + lessonNumber + " out of 24* lessons in " + strippedCourseName + "!⭐️";
        }
        goldBarCaption = lessonCompleteMessage;

        // Day Ending Message
        if (startingLesson.dataValues.dayNumber >= 1 && startingLesson.dataValues.dayNumber <= 5) {
            const dayEndingMessage = getDayEndingMessage(startingLesson.dataValues.dayNumber);
            goldBarCaption += "\n\n" + dayEndingMessage;
        }

        // Lesson Complete Image
        // Gold Bars
        const smallCourseName = strippedCourseName.replace(/\s/g, '').toLowerCase();
        const imageTag = "lesson_complete_image_lesson_" + lessonNumber.toString() + "_" + smallCourseName;
        let fileExtnesion = ".jpg";
        let lessonCompleteImage = "";
        if (lessonNumber == 24 && strippedCourseName == "Level 3") {
            lessonCompleteImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/course_end_gold_bars" + fileExtnesion;
        } else {
            lessonCompleteImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/" + imageTag + fileExtnesion;
        }
        await sendMediaMessage(userMobileNumber, lessonCompleteImage, 'image', goldBarCaption);
        await createActivityLog(userMobileNumber, "image", "outbound", lessonCompleteImage, null, goldBarCaption);
        // Sleep
        await sleep(5000);

        // Week end score image
        if (startingLesson.dataValues.dayNumber == 6) {
            let weekMessage = ""
            if (strippedCourseName == "Level 3") {
                weekMessage = "Thank You for staying with us till the end! 👍🏽";
            }

            const weekEndScore = await weekEndScoreCalculation(profileId, userMobileNumber, startingLesson.dataValues.weekNumber, currentUserState.currentCourseId);
            const weekEndScoreImage = await weekEndImage(weekEndScore, startingLesson.dataValues.weekNumber);
            await sendMediaMessage(userMobileNumber, weekEndScoreImage, 'image', weekMessage);
            await createActivityLog(userMobileNumber, "image", "outbound", weekEndScoreImage, null, weekMessage);
            await sleep(5000);
        }

        // Feedback Message
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


        // Sleep
        await sleep(4000);

        if (lessonNumber == 24 && strippedCourseName == "Level 3") {
            const congratsImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/congratulations.jpeg";
            await sendMediaMessage(userMobileNumber, congratsImage, 'image', null);
            await createActivityLog(userMobileNumber, "image", "outbound", congratsImage, null);
            await sleep(5000);
        } else {
            await sendButtonMessage(userMobileNumber, 'Are you ready to start your next lesson?', [{ id: 'start_next_lesson', title: 'Start Next Lesson' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Lesson", null);
        }
    } else {
        // Feedback Message
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

        // Sleep
        await sleep(2000);

        // Reply Buttons
        await sendButtonMessage(userMobileNumber, 'Are you ready to start the next activity?', [{ id: 'start_next_activity', title: 'Start Next Activity' }]);
        await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Activity", null);
    }
};


export {
    endingMessage
};