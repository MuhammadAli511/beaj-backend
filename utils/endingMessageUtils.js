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
import waConstantsRepository from "../repositories/waConstantsRepository.js";


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
        const shellImageObject = await waConstantsRepository.getByKey("SHELL_IMAGE");
        const gemImageObject = await waConstantsRepository.getByKey("GEM_IMAGE");
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
            if (checkRegistrationComplete == true) {
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start questions", "chat with beaj rep"]);
                buttonsArray = [{ id: 'start_questions', title: 'Start Questions' }, { id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }];
            } else {
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start questions", "skip trial", "chat with beaj rep"]);
                buttonsArray = [{ id: 'start_questions', title: 'Start Questions' }, { id: 'skip_trial', title: 'Skip Trial' }, { id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }];
            }
            // Reply Buttons
            if (message == null) {
                await sendButtonMessage(userMobileNumber, 'Start Questions!', buttonsArray);
                await createActivityLog(userMobileNumber, "template", "outbound", "Start Questions or Skip Trial or Chat with Beaj Rep", null);
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
            if (checkRegistrationComplete == true) {
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["next activity", "chat with beaj rep"]);
                buttonsArray = [{ id: 'next_activity', title: 'Next Activity' }, { id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }];
            } else {
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["next activity", "skip trial", "chat with beaj rep"]);
                buttonsArray = [{ id: 'next_activity', title: 'Next Activity' }, { id: 'skip_trial', title: 'Skip Trial' }, { id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }];
            }
            // Reply Buttons
            if (message == null) {
                await sendButtonMessage(userMobileNumber, finalTextMessage, buttonsArray);
                await createActivityLog(userMobileNumber, "template", "outbound", "Next Activity or Skip Trial or Chat with Beaj Rep", null);
            } else {
                await sendButtonMessage(userMobileNumber, message, buttonsArray);
                await createActivityLog(userMobileNumber, "template", "outbound", message, null);
            }
            return;
        }

        if (checkRegistrationComplete == false && lessonLast == true) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["get another trial", "register now"]);
            let buttonsArray = [{ id: 'register_now', title: 'Register Now' }, { id: 'get_another_trial', title: 'Get Another Trial' }];

            let trialCompleteMessage = `📍Your Free Trial ends here.\nیہاں آپ کا فری ٹرائل ختم ہوتا ہے۔\n\nIf you are interested in registration, click on Register Now 👇\nاگر آپ ریجسٹریشن میں دلچسپی رکھتے ہیں، تو ‘Register Now’ پر کلک کریں۔`;
            if (message == null) {
                await sendButtonMessage(userMobileNumber, trialCompleteMessage, buttonsArray, 0, trialCompleteobject.dataValues.constantValue, null, "WA_Constants", trialCompleteobject.dataValues.id, trialCompleteobject.dataValues.constantMediaId, null, "constantMediaId");
                await createActivityLog(userMobileNumber, "template", "outbound", "get another trial or register", null);
            } else {
                message += "\n\n" + trialCompleteMessage;
                await sendButtonMessage(userMobileNumber, message, buttonsArray, 0, trialCompleteobject.dataValues.constantValue, null, "WA_Constants", trialCompleteobject.dataValues.id, trialCompleteobject.dataValues.constantMediaId, null, "constantMediaId");
                await createActivityLog(userMobileNumber, "template", "outbound", message, null);
            }

            return;
        } else if (checkRegistrationComplete == true && lessonLast == true) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["get another trial"]);
            let buttonsArray = [{ id: 'get_another_trial', title: 'Get Another Trial' }];

            let trialCompleteMessage = `📍Your Free Trial ends here.\nیہاں آپ کا فری ٹرائل ختم ہوتا ہے۔\n\n`;
            if (message == null) {
                await sendButtonMessage(userMobileNumber, trialCompleteMessage, buttonsArray, 0, trialCompleteobject.dataValues.constantValue, null, "WA_Constants", trialCompleteobject.dataValues.id, trialCompleteobject.dataValues.constantMediaId, null, "constantMediaId");
                await createActivityLog(userMobileNumber, "template", "outbound", "get another trial or register", null);
            } else {
                message += "\n\n" + trialCompleteMessage;
                await sendButtonMessage(userMobileNumber, message, buttonsArray, 0, trialCompleteobject.dataValues.constantValue, null, "WA_Constants", trialCompleteobject.dataValues.id, trialCompleteobject.dataValues.constantMediaId, null, "constantMediaId");
                await createActivityLog(userMobileNumber, "template", "outbound", message, null);
            }

            return;
        } else if (checkRegistrationComplete == false && lessonLast == false) {
            // Update acceptable messages list for the user
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["next activity", "skip trial", "chat with beaj rep"]);
            let buttonsArray = [{ id: 'next_activity', title: 'Next Activity' }, { id: 'skip_trial', title: 'Skip Trial' }, { id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }];


            // Reply Buttons
            if (message == null) {
                await sendButtonMessage(userMobileNumber, 'Challenge Complete! 💪🏽', buttonsArray);
                await createActivityLog(userMobileNumber, "template", "outbound", "Next Activity or Skip Trial or Chat with Beaj Rep", null);
            } else {
                await sendButtonMessage(userMobileNumber, message, buttonsArray);
                await createActivityLog(userMobileNumber, "template", "outbound", message, null);
            }

            return;
        } else if (checkRegistrationComplete == true && lessonLast == false) {
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
                const fizza_level3 = await waConstantsRepository.getByKey("FIZZA_LEVEL_3");
                await sendMediaMessage(userMobileNumber, fizza_level3.dataValues.constantValue, 'video', null, 0, "WA_Constants", fizza_level3.dataValues.id, fizza_level3.dataValues.constantMediaId, "constantMediaId");
                await createActivityLog(userMobileNumber, "video", "outbound", fizza_level3.dataValues.constantValue, null);
                await sleep(12000);
                let endingMessageLevel3 = "🎓 This brings us to the end of Beaj Education's Self Development Course! \n\nPlease note: \n\n📳 A Beaj team member will call you in the next few weeks for a short phone survey. Please pick up and share your valuable feedback.\n\n🏆 You will recieve your certificate within one week.\n\n🎁 Winners of the Lucky Draw will be announced after May 10th!\n\nPlease do not forget to join our Teacher Leaders community. Links to the community have been shared in your class groups.\n\nWe thank you for your time and dedication and hope your learning journey continues!\n\nBest wishes,\nTeam Beaj"
                const level3Ender = await waConstantsRepository.getByKey("LEVEL_3_ENDER");
                let endingImageLevel3 = level3Ender.dataValues.constantValue;
                await sendMediaMessage(userMobileNumber, endingImageLevel3, 'image', endingMessageLevel3, 0, "WA_Constants", level3Ender.dataValues.id, level3Ender.dataValues.constantMediaId, "constantMediaId");
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
                const congratsImage = await waConstantsRepository.getByKey("LEVEL_3_CONGRATULATIONS");
                await sendMediaMessage(userMobileNumber, congratsImage.dataValues.constantValue, 'image', null, 0, "WA_Constants", congratsImage.dataValues.id, congratsImage.dataValues.constantMediaId, "constantMediaId");
                await createActivityLog(userMobileNumber, "image", "outbound", congratsImage.dataValues.constantValue, null);
                await sleep(5000);
            } else {
                await sendButtonMessage(userMobileNumber, 'Are you ready to start your next lesson?', [{ id: 'start_next_lesson', title: 'Start Next Lesson' }]);
                await createActivityLog(userMobileNumber, "template", "outbound", "Start Next Lesson", null);
                await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start next lesson"]);
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