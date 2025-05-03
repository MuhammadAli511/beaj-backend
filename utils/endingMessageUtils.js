import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";
import { sendMediaMessage, sendButtonMessage, sendMessage } from "./whatsappUtils.js";
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
        if ((startingLesson.dataValues.engagement_type === "Free Trial - Kids - Level 1" || startingLesson.dataValues.engagement_type === "Free Trial - Kids - Level 3") && startingLesson.dataValues.activityType !== 'videoEnd') {
            const challengeCompleteSticker = "https://beajbloblive.blob.core.windows.net/beajdocuments/challenge_complete_with_text.webp"
            await sendMediaMessage(userMobileNumber, challengeCompleteSticker, 'sticker');
            await createActivityLog(userMobileNumber, "sticker", "outbound", challengeCompleteSticker, null);
        }
    }

    await sleep(3000);


    if (currentUserState.dataValues.engagement_type == "Free Trial - Teachers") {
        let user = await waUsersMetadataRepository.getByProfileId(profileId);
        let checkRegistrationComplete = user.dataValues.userRegistrationComplete !== null;
        if (checkRegistrationComplete == false && lessonLast == true) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["get another trial", "register"]);

            // Reply Buttons
            await sendButtonMessage(userMobileNumber, '👏🏽Trial Complete! 🤓', [{ id: 'get_another_trial', title: 'Get Another Trial' }, { id: 'register', title: 'Register' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "get another trial or register", null);

            return;
        } else if (checkRegistrationComplete == true && lessonLast == true) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["get another trial"]);


            // Reply Buttons
            await sendButtonMessage(userMobileNumber, '👏🏽Trial Complete! 🤓', [{ id: 'get_another_trial', title: 'Get Another Trial' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "get another trial", null);

            return;
        } else if (checkRegistrationComplete == false && lessonLast == false) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start next activity", "end now"]);

            // Reply Buttons
            await sendButtonMessage(userMobileNumber, '👏🏽Activity Complete! 🤓', [{ id: 'start_next_activity', title: 'Start Next Activity' }, { id: 'end_now', title: 'End Now' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Activity or End Now", null);

            return;
        } else if (checkRegistrationComplete == true && lessonLast == false) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start next activity", "end now"]);

            // Reply Buttons
            await sendButtonMessage(userMobileNumber, '👏🏽Activity Complete! 🤓', [{ id: 'start_next_activity', title: 'Start Next Activity' }, { id: 'end_now', title: 'End Now' }]);
            await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Activity or End Now", null);

            return;
        }
    }
    else if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1" || currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
        let shell_image = "https://beajbloblive.blob.core.windows.net/beajdocuments/level1_shell_image.jpeg"; // Level 1
        let gem_image = "https://beajbloblive.blob.core.windows.net/beajdocuments/level3_gem_image.jpeg"; // Level 3
        let trialCompleteImage = "";
        if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
            trialCompleteImage = gem_image;
        } else if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1") {
            trialCompleteImage = shell_image;
        }
        let user = await waUsersMetadataRepository.getByProfileId(profileId);
        let checkRegistrationComplete = user.dataValues.userRegistrationComplete !== null;
        if (startingLesson.dataValues.activityAlias == "📕 *Story Time!*") {
            let final_map_image = "";
            let message = "Start questions and win your first gem! 💎\nسوالات شروع کریں اور اپنا پہلا gem جیتیں!";
            if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 1") {
                final_map_image = "https://beajbloblive.blob.core.windows.net/beajdocuments/level1_map.jpeg";
            } else if (currentUserState.dataValues.engagement_type == "Free Trial - Kids - Level 3") {
                final_map_image = "https://beajbloblive.blob.core.windows.net/beajdocuments/level3_map.jpeg";
            }
            await sendMediaMessage(userMobileNumber, final_map_image, "image");
            await createActivityLog(userMobileNumber, "image", "outbound", final_map_image, null);
            await sleep(2000);


            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start questions", "go to registration", "talk to beaj rep"]);
            let buttonsArray = [{ id: 'start_questions', title: 'Start Questions' }, { id: 'go_to_registration', title: 'Go to Registration' }, { id: 'talk_to_beaj_rep', title: 'Talk to Beaj Rep' }];

            // Reply Buttons
            if (message == null) {
                await sendButtonMessage(userMobileNumber, 'Start Questions!', buttonsArray);
                await createActivityLog(userMobileNumber, "template", "outbound", "Start Questions or Go to Registration or Talk to Beaj Rep", null);
            } else {
                await sendButtonMessage(userMobileNumber, message, buttonsArray);
                await createActivityLog(userMobileNumber, "template", "outbound", message, null);
            }

            return;
        }

        if (checkRegistrationComplete == false && lessonLast == true) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["get another trial", "register now", "talk to beaj rep"]);
            let buttonsArray = [{ id: 'register_now', title: 'Register Now' }, { id: 'talk_to_beaj_rep', title: 'Talk to Beaj Rep' }, { id: 'get_another_trial', title: 'Get Another Trial' }];

            let trialCompleteMessage = `📍Your Free Trial ends here.\nیہاں آپ کا فری ٹرائل ختم ہوتا ہے۔\n\nAre you ready to continue? Click on Register Now 👇\nکیا آپ آگے بڑھنے کے لیے تیار ہیں؟ "Register Now" بٹن پر کلک کریں۔`;
            if (message == null) {
                await sendButtonMessage(userMobileNumber, trialCompleteMessage, buttonsArray, 0, trialCompleteImage);
                await createActivityLog(userMobileNumber, "template", "outbound", "get another trial or register", null);
            } else {
                message += "\n\n" + trialCompleteMessage;
                await sendButtonMessage(userMobileNumber, trialCompleteMessage, buttonsArray, 0, trialCompleteImage);
                await createActivityLog(userMobileNumber, "template", "outbound", trialCompleteMessage, null);
            }

            return;
        } else if (checkRegistrationComplete == true && lessonLast == true) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["get another trial"]);
            let buttonsArray = [{ id: 'get_another_trial', title: 'Get Another Trial' }, { id: 'talk_to_beaj_rep', title: 'Talk to Beaj Rep' }];

            let trialCompleteMessage = `📍Your Free Trial ends here.\nیہاں آپ کا فری ٹرائل ختم ہوتا ہے۔\n\n`;
            if (message == null) {
                await sendButtonMessage(userMobileNumber, trialCompleteMessage, buttonsArray, 0, trialCompleteImage);
                await createActivityLog(userMobileNumber, "template", "outbound", "get another trial or register", null);
            } else {
                message += "\n\n" + trialCompleteMessage;
                await sendButtonMessage(userMobileNumber, trialCompleteMessage, buttonsArray, 0, trialCompleteImage);
                await createActivityLog(userMobileNumber, "template", "outbound", trialCompleteMessage, null);
            }

            return;
        } else if (checkRegistrationComplete == false && lessonLast == false) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["next activity", "go to registration", "talk to beaj rep"]);
            let buttonsArray = [{ id: 'next_activity', title: 'Next Activity' }, { id: 'go_to_registration', title: 'Go to Registration' }, { id: 'talk_to_beaj_rep', title: 'Talk to Beaj Rep' }];


            // Reply Buttons
            if (message == null) {
                await sendButtonMessage(userMobileNumber, 'Challenge Complete! 💪🏽', buttonsArray);
                await createActivityLog(userMobileNumber, "template", "outbound", "Next Activity or Go to Registration or Talk to Beaj Rep", null);
            } else {
                await sendButtonMessage(userMobileNumber, message, buttonsArray);
                await createActivityLog(userMobileNumber, "template", "outbound", message, null);
            }

            return;
        } else if (checkRegistrationComplete == true && lessonLast == false) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["next activity", "talk to beaj rep"]);
            let buttonsArray = [{ id: 'next_activity', title: 'Next Activity' }, { id: 'talk_to_beaj_rep', title: 'Talk to Beaj Rep' }];

            // Reply Buttons
            if (message == null) {
                await sendButtonMessage(userMobileNumber, 'Challenge Complete! 💪🏽', buttonsArray);
                await createActivityLog(userMobileNumber, "template", "outbound", "Next Activity or Talk to Beaj Rep", null);
            } else {
                await sendButtonMessage(userMobileNumber, message, buttonsArray);
                await createActivityLog(userMobileNumber, "template", "outbound", message, null);
            }

            return;
        }
    }


    if (currentUserState.dataValues.engagement_type == "Course Start") {
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

            if (lessonNumber == 24 && strippedCourseName == "Level 3") {
                const fizza_level3 = "https://beajbloblive.blob.core.windows.net/beajdocuments/Fizza_Level3.mp4";
                await sendMediaMessage(userMobileNumber, fizza_level3, 'video', null);
                await createActivityLog(userMobileNumber, "video", "outbound", fizza_level3, null);
                await sleep(12000);
                let endingMessageLevel3 = "🎓 This brings us to the end of Beaj Education's Self Development Course! \n\nPlease note: \n\n📳 A Beaj team member will call you in the next few weeks for a short phone survey. Please pick up and share your valuable feedback.\n\n🏆 You will recieve your certificate within one week.\n\n🎁 Winners of the Lucky Draw will be announced after May 10th!\n\nPlease do not forget to join our Teacher Leaders community. Links to the community have been shared in your class groups.\n\nWe thank you for your time and dedication and hope your learning journey continues!\n\nBest wishes,\nTeam Beaj"
                let endingImageLevel3 = "https://beajbloblive.blob.core.windows.net/beajdocuments/level3_ender_beaj.jpeg";
                await sendMediaMessage(userMobileNumber, endingImageLevel3, 'image', endingMessageLevel3);
                await createActivityLog(userMobileNumber, "image", "outbound", endingImageLevel3, null, endingMessageLevel3);
            }

            // Feedback Message
            if (lessonNumber != 24 && lessonNumber != 3) {
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
    }
};


export {
    endingMessage
};