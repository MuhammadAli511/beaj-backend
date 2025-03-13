import dotenv from "dotenv";
import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import lessonRepository from "../repositories/lessonRepository.js";
import waLessonsCompletedRepository from "../repositories/waLessonsCompletedRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waQuestionResponsesRepository from "../repositories/waQuestionResponsesRepository.js";
import waConstantsRepository from "../repositories/waConstantsRepository.js";
import waPurchasedCoursesRepository from "../repositories/waPurchasedCoursesRepository.js";
import {
    outlineMessage,
    createActivityLog,
    retrieveMediaURL,
    nameInputMessage,
    districtInputMessage,
    thankYouMessage,
    demoCourseStart,
    getAcceptableMessagesList,
    removeUser,
    checkUserMessageAndAcceptableMessages,
    sendMessage,
    startCourseForUser,
    levelCourseStart,
    sendCourseLessonToUser,
    removeUserTillCourse,
    teacherInputMessage,
    schoolNameInputMessage,
    createFeedback,
    sendButtonMessage
} from "../utils/chatbotUtils.js";

dotenv.config();
const whatsappVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

let activity_types_to_repeat = [
    "mcqs",
    "watchAndSpeak",
    "listenAndSpeak",
    "read",
    "conversationalQuestionsBot",
    "conversationalMonologueBot",
    "speakingPractice",
    "conversationalAgencyBot",
    "watchAndAudio",
    "watchAndImage",
];

const verifyWebhookService = async (req, res) => {
    try {
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];

        if (mode && token === whatsappVerifyToken) {
            console.log("Webhook verified");
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } catch (error) {
        console.error("Error in verifyWebhookService:", error);
        error.fileName = "chatBotService.js";
        throw error;
    }
};

const uploadUserDataService = async (users) => {
    let count = 0;
    const t1Course = await courseRepository.getCourseByCourseName("Level 1 - T1 - January 27, 2025");
    const t2Course = await courseRepository.getCourseByCourseName("Level 1 - T2 - January 27, 2025");
    if (!t1Course || !t2Course) {
        throw new Error("Course not found");
    }
    for (const user of users) {
        const newPhoneNumber = user.phone_number;
        const userExists = await waUsersMetadataRepository.getByPhoneNumber(newPhoneNumber);
        if (userExists) {
            console.log(`${newPhoneNumber}`);
            continue;
        }
        await waUsersMetadataRepository.create({
            phoneNumber: newPhoneNumber,
            userClickedLink: new Date(),
            userRegistrationComplete: new Date(),
            name: user.s0_name,
            targetGroup: user["Target.Group"],
            cohort: user.cohort_assignment,
            isTeacher: user.school_role == "Teacher" || user.school_role == "Both" ? "Yes" : "No",
            schoolName: user.schoolname,
        });
        await waUserProgressRepository.create({
            phoneNumber: newPhoneNumber,
            persona: user.school_role,
            engagement_type: "",
            acceptableMessages: ["start my course"],
            lastUpdated: new Date(),
        });
        if (user["Target.Group"] == "T1" || user["Target.Group"] == "T2") {
            await waPurchasedCoursesRepository.create({
                phoneNumber: newPhoneNumber,
                courseId: user["Target.Group"] == "T1" ? t1Course.dataValues.CourseId : t2Course.dataValues.CourseId,
                courseCategoryId: user["Target.Group"] == "T1" ? t1Course.dataValues.CourseCategoryId : t2Course.dataValues.CourseCategoryId,
                courseStartDate: new Date(),
                purchaseDate: new Date(),
            });
        }
        count++;
        // console.log(`${count}`);
    }
    return count;
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
            const message = body.entry[0].changes[0].value.messages[0];
            const userMobileNumber = "+" + message.from;
            let messageContent;
            let messageType = message.type;
            let logger = `Inbound Message: User: ${userMobileNumber}, Message Type: ${message.type
                }, Message Content: ${message.text?.body ||
                message.image?.id ||
                message.audio?.id ||
                message.video?.id ||
                message.interactive?.button_reply?.title
                || message.button?.text
                }`;
            console.log(logger);
            if (message.type === "image") {
                createActivityLog(userMobileNumber, "image", "inbound", message, null);
                messageContent = await retrieveMediaURL(message.image.id);
            } else if (message.type === "audio") {
                createActivityLog(userMobileNumber, "audio", "inbound", message, null);
                messageContent = await retrieveMediaURL(message.audio.id);
            } else if (message.type === "video") {
                createActivityLog(userMobileNumber, "video", "inbound", message, null);
                messageContent = await retrieveMediaURL(message.video.id);
            } else if (message.type === "text") {
                messageContent = message.text?.body.toLowerCase().trim() || "";
                createActivityLog(userMobileNumber, "text", "inbound", message.text?.body, null);
            } else if (message.type === "interactive") {
                messageContent = message.interactive.button_reply.title.toLowerCase().trim();
                createActivityLog(userMobileNumber, "template", "inbound", messageContent, null);
            } else if (message.type == "button") {
                messageContent = message.button.text.toLowerCase().trim();
                createActivityLog(userMobileNumber, "template", "inbound", messageContent, null);
            } else {
                return;
            }

            const botStatus = await waConstantsRepository.getByKey("BOT_STATUS");
            if (!botStatus || botStatus.dataValues.constantValue != "Active") {
                await sendMessage(
                    userMobileNumber,
                    "Sorry, We are currently not accepting any messages. Please try again later."
                );
                await createActivityLog(
                    userMobileNumber,
                    "text",
                    "outbound",
                    "Sorry, We are currently not accepting any messages. Please try again later.",
                    null
                );
                return;
            }

            // Check if user exists in the database
            let user = await waUsersMetadataRepository.getByPhoneNumber(
                userMobileNumber
            );
            let currentUserState = await waUserProgressRepository.getByPhoneNumber(
                userMobileNumber
            );

            // If message is reset, delete user from database
            if (
                (message.type === "text" || message.type === "interactive" || message.type === "button") &&
                messageContent.toLowerCase() == "reset course"
            ) {
                await removeUserTillCourse(userMobileNumber);
                return;
            }

            // If message is reset, delete user from database
            if (
                (message.type === "text" || message.type === "interactive" || message.type === "button") &&
                messageContent.toLowerCase() == "reset all"
            ) {
                await removeUser(userMobileNumber);
                return;
            }

            // DEMO COURSE
            // Step 1: If user does not exist, check if the first message is the onboarding message
            if (!user) {
                await waUsersMetadataRepository.create({
                    phoneNumber: userMobileNumber,
                    userClickedLink: new Date(),
                });
                await outlineMessage(userMobileNumber);
                return;
            }

            if (user && currentUserState) {
                const messageAuth = await checkUserMessageAndAcceptableMessages(
                    userMobileNumber,
                    currentUserState,
                    messageType,
                    messageContent
                );
                if (messageAuth === false) {
                    return;
                }
            }

            // Step 2: User either clicks 'Apply Scholarship'
            if (
                (message.type === "text" || message.type === "interactive" || message.type === "button") &&
                messageContent.toLowerCase().includes("apply scholarship")
            ) {
                const validEngagementTypes = ["Outline Message", "Free Demo"];
                const currentLesson = await lessonRepository.getCurrentLesson(
                    currentUserState.dataValues.currentLessonId
                );
                if (currentLesson) {
                    await waLessonsCompletedRepository.endLessonByPhoneNumberAndLessonId(
                        userMobileNumber,
                        currentLesson.dataValues.LessonId
                    );
                }
                if (
                    validEngagementTypes.includes(
                        currentUserState.dataValues.engagement_type
                    )
                ) {
                    if (
                        currentUserState.dataValues.engagement_type != "Outline Message"
                    ) {
                        await waUsersMetadataRepository.update(userMobileNumber, {
                            freeDemoEnded: new Date(),
                        });
                    }
                    await nameInputMessage(userMobileNumber);
                    return;
                }
            }

            // Step 3: User enters their name, now ask for district
            if (
                message.type === "text" &&
                currentUserState.dataValues.engagement_type == "Name Input"
            ) {
                await waUsersMetadataRepository.update(userMobileNumber, {
                    name: messageContent,
                });
                await districtInputMessage(userMobileNumber);
                return;
            }

            // Step 4: User enters their district, now ask for whether they are a teacher or not
            if (
                message.type === "text" &&
                currentUserState.dataValues.engagement_type == "District Input"
            ) {
                await waUsersMetadataRepository.update(userMobileNumber, {
                    city: messageContent,
                });
                await teacherInputMessage(userMobileNumber);
                return;
            }

            // Step 5: User enters their isTeacher, now ask for school name
            if (
                (message.type === "text" || message.type === "interactive" || message.type === "button") &&
                currentUserState.dataValues.engagement_type == "Teacher Input"
            ) {
                await waUsersMetadataRepository.update(userMobileNumber, {
                    isTeacher: messageContent,
                });
                await schoolNameInputMessage(userMobileNumber);
                return;
            }

            // Step 6: User enters if they are a teacher or not, now ask for school name
            if (
                (message.type === "text" || message.type === "interactive" || message.type === "button") &&
                currentUserState.dataValues.engagement_type == "School Input"
            ) {
                if (
                    !messageContent.toLowerCase().includes("start my course")
                ) {
                    if (user.dataValues.isTeacher != null) {
                        await waUsersMetadataRepository.update(userMobileNumber, {
                            schoolName: messageContent,
                            userRegistrationComplete: new Date(),
                        });
                        await thankYouMessage(userMobileNumber);
                    }
                    // else {
                    // await thankYouMessage(userMobileNumber);
                    // }
                    return;
                }
            }

            // DEMO COURSE
            let messagesList = ["try free demo", "try demo again", "try demo"];
            if (
                (message.type == "interactive" || message.type == "text") &&
                messagesList.includes(messageContent.toLowerCase())
            ) {
                let validEngagementTypes = [
                    "Outline Message",
                    "Free Demo",
                    "School Input",
                ];
                if (
                    validEngagementTypes.includes(
                        currentUserState.dataValues.engagement_type
                    )
                ) {
                    if (user.dataValues.freeDemoStarted == null) {
                        await waUsersMetadataRepository.update(userMobileNumber, {
                            freeDemoStarted: new Date(),
                        });
                    }
                    // Delete all question responses for the user
                    await waQuestionResponsesRepository.deleteByPhoneNumber(
                        userMobileNumber
                    );
                    const startingLesson = await lessonRepository.getNextLesson(
                        await courseRepository.getCourseIdByName("Free Trial"),
                        1,
                        null,
                        null
                    );
                    await demoCourseStart(userMobileNumber, startingLesson);
                    // Send first lesson to user
                    currentUserState = await waUserProgressRepository.getByPhoneNumber(
                        userMobileNumber
                    );
                    await sendCourseLessonToUser(
                        userMobileNumber,
                        currentUserState,
                        startingLesson,
                        messageType,
                        messageContent
                    );
                    if (startingLesson.dataValues.activity == "video") {
                        const nextLesson = await lessonRepository.getNextLesson(
                            currentUserState.dataValues.currentCourseId,
                            currentUserState.dataValues.currentWeek,
                            currentUserState.dataValues.currentDay,
                            currentUserState.dataValues.currentLesson_sequence
                        );

                        // Mark previous lesson as completed
                        const currentLesson = await lessonRepository.getCurrentLesson(
                            currentUserState.dataValues.currentLessonId
                        );
                        await waLessonsCompletedRepository.endLessonByPhoneNumberAndLessonId(
                            userMobileNumber,
                            currentLesson.dataValues.LessonId
                        );

                        // Get acceptable messages for the next question/lesson
                        const acceptableMessagesList = await getAcceptableMessagesList(
                            nextLesson.dataValues.activity
                        );

                        // Update user progress to next lesson
                        await waUserProgressRepository.update(
                            userMobileNumber,
                            nextLesson.dataValues.courseId,
                            nextLesson.dataValues.weekNumber,
                            nextLesson.dataValues.dayNumber,
                            nextLesson.dataValues.LessonId,
                            nextLesson.dataValues.SequenceNumber,
                            nextLesson.dataValues.activity,
                            null,
                            0,
                            acceptableMessagesList
                        );
                        const latestUserState =
                            await waUserProgressRepository.getByPhoneNumber(userMobileNumber);

                        // Send next lesson to user
                        await sendCourseLessonToUser(
                            userMobileNumber,
                            latestUserState,
                            nextLesson,
                            messageType,
                            messageContent
                        );
                    }
                    return;
                }
            }

            // If user completes an activity and wants to try the next activity
            if (message.type === "text" || message.type === "interactive" || message.type === "button") {
                if (
                    messageContent.toLowerCase().includes("try next activity") ||
                    messageContent.toLowerCase().includes("next")
                ) {
                    if (currentUserState.dataValues.engagement_type == "Free Demo") {
                        // Get next lesson to send user
                        const nextLesson = await lessonRepository.getNextLesson(
                            currentUserState.dataValues.currentCourseId,
                            currentUserState.dataValues.currentWeek,
                            currentUserState.dataValues.currentDay,
                            currentUserState.dataValues.currentLesson_sequence
                        );

                        // Get acceptable messages for the next question/lesson
                        const acceptableMessagesList = await getAcceptableMessagesList(
                            nextLesson.dataValues.activity
                        );

                        // Update user progress to next lesson
                        await waUserProgressRepository.update(
                            userMobileNumber,
                            nextLesson.dataValues.courseId,
                            nextLesson.dataValues.weekNumber,
                            nextLesson.dataValues.dayNumber,
                            nextLesson.dataValues.LessonId,
                            nextLesson.dataValues.SequenceNumber,
                            nextLesson.dataValues.activity,
                            null,
                            0,
                            acceptableMessagesList
                        );
                        let latestUserState =
                            await waUserProgressRepository.getByPhoneNumber(userMobileNumber);

                        // Send next lesson to user
                        await sendCourseLessonToUser(
                            userMobileNumber,
                            latestUserState,
                            nextLesson,
                            messageType,
                            messageContent
                        );

                        if (nextLesson.dataValues.activity == "video") {
                            const nextLesson = await lessonRepository.getNextLesson(
                                latestUserState.dataValues.currentCourseId,
                                latestUserState.dataValues.currentWeek,
                                latestUserState.dataValues.currentDay,
                                latestUserState.dataValues.currentLesson_sequence
                            );

                            // Mark previous lesson as completed
                            const currentLesson = await lessonRepository.getCurrentLesson(
                                latestUserState.dataValues.currentLessonId
                            );
                            await waLessonsCompletedRepository.endLessonByPhoneNumberAndLessonId(
                                userMobileNumber,
                                currentLesson.dataValues.LessonId
                            );

                            // Get acceptable messages for the next question/lesson
                            const acceptableMessagesList = await getAcceptableMessagesList(
                                nextLesson.dataValues.activity
                            );

                            // Update user progress to next lesson
                            await waUserProgressRepository.update(
                                userMobileNumber,
                                nextLesson.dataValues.courseId,
                                nextLesson.dataValues.weekNumber,
                                nextLesson.dataValues.dayNumber,
                                nextLesson.dataValues.LessonId,
                                nextLesson.dataValues.SequenceNumber,
                                nextLesson.dataValues.activity,
                                null,
                                0,
                                acceptableMessagesList
                            );
                            latestUserState = await waUserProgressRepository.getByPhoneNumber(
                                userMobileNumber
                            );

                            // Send next lesson to user
                            await sendCourseLessonToUser(
                                userMobileNumber,
                                latestUserState,
                                nextLesson,
                                messageType,
                                messageContent
                            );
                        }
                        return;
                    }
                }
            }
            if (
                currentUserState.dataValues.activityType &&
                activity_types_to_repeat.includes(
                    currentUserState.dataValues.activityType
                )
            ) {
                if (currentUserState.dataValues.engagement_type == "Free Demo") {
                    // Get the current lesson for next question
                    const currentLesson = await lessonRepository.getCurrentLesson(
                        currentUserState.dataValues.currentLessonId
                    );

                    // Get acceptable messages for the next question
                    const acceptableMessagesList = await getAcceptableMessagesList(
                        currentLesson.dataValues.activity
                    );

                    // Update acceptable messages list for the user
                    await waUserProgressRepository.updateAcceptableMessagesList(
                        userMobileNumber,
                        acceptableMessagesList
                    );

                    // Update user progress to next question
                    await sendCourseLessonToUser(
                        userMobileNumber,
                        currentUserState,
                        currentLesson,
                        messageType,
                        messageContent
                    );
                    return;
                }
            }

            let numbers_to_ignore = [
                "+923331432681",
                "+923008400080",
                "+923303418882",
                "+923345520552",
                "+923225036358",
                "+923365560202",
                "+923328251950",
                "+923225812411",
                "+923232658153",
                "+923390001510",
                "+923288954660",
                "+923704558660"
            ];

            // START MAIN COURSE
            if (
                (message.type === "text" || message.type === "interactive" || message.type === "button") &&
                messageContent.toLowerCase().includes("start my course")
            ) {
                await startCourseForUser(userMobileNumber, numbers_to_ignore);
                return;
            }

            // NORMAL COURSE
            currentUserState = await waUserProgressRepository.getByPhoneNumber(
                userMobileNumber
            );
            if (
                (message.type == "text" || message.type == "interactive") &&
                (messageContent.toLowerCase() == "start" ||
                    messageContent.toLowerCase() == "start!")
            ) {
                if (currentUserState.dataValues.engagement_type == "Course Start") {
                    const startingLesson = await lessonRepository.getNextLesson(
                        currentUserState.dataValues.currentCourseId,
                        1,
                        null,
                        null
                    );
                    await levelCourseStart(
                        userMobileNumber,
                        startingLesson,
                        currentUserState.dataValues.currentCourseId
                    );
                    // Send first lesson to user
                    currentUserState = await waUserProgressRepository.getByPhoneNumber(
                        userMobileNumber
                    );
                    await sendCourseLessonToUser(
                        userMobileNumber,
                        currentUserState,
                        startingLesson,
                        messageType,
                        messageContent
                    );
                    if (startingLesson.dataValues.activity == "video") {
                        const nextLesson = await lessonRepository.getNextLesson(
                            currentUserState.dataValues.currentCourseId,
                            currentUserState.dataValues.currentWeek,
                            currentUserState.dataValues.currentDay,
                            currentUserState.dataValues.currentLesson_sequence
                        );

                        // Mark previous lesson as completed
                        const currentLesson = await lessonRepository.getCurrentLesson(
                            currentUserState.dataValues.currentLessonId
                        );
                        await waLessonsCompletedRepository.endLessonByPhoneNumberAndLessonId(
                            userMobileNumber,
                            currentLesson.dataValues.LessonId
                        );

                        // Get acceptable messages for the next question/lesson
                        const acceptableMessagesList = await getAcceptableMessagesList(
                            nextLesson.dataValues.activity
                        );

                        // Update user progress to next lesson
                        await waUserProgressRepository.update(
                            userMobileNumber,
                            nextLesson.dataValues.courseId,
                            nextLesson.dataValues.weekNumber,
                            nextLesson.dataValues.dayNumber,
                            nextLesson.dataValues.LessonId,
                            nextLesson.dataValues.SequenceNumber,
                            nextLesson.dataValues.activity,
                            null,
                            0,
                            acceptableMessagesList
                        );
                        const latestUserState =
                            await waUserProgressRepository.getByPhoneNumber(userMobileNumber);

                        // Send next lesson to user
                        await sendCourseLessonToUser(
                            userMobileNumber,
                            latestUserState,
                            nextLesson,
                            messageType,
                            messageContent
                        );
                    }
                    return;
                }
            }

            if (message.type === "text" || message.type === "interactive" || message.type === "button") {
                const currentLesson = await lessonRepository.getCurrentLesson(
                    currentUserState.dataValues.currentLessonId
                );
                if (messageContent.toLowerCase().includes("yes") || messageContent.toLowerCase().includes("no")) {
                    await sendCourseLessonToUser(
                        userMobileNumber,
                        currentUserState,
                        currentLesson,
                        messageType,
                        messageContent
                    );
                    return;
                }
            }


            if (message.type === "text" || message.type === "interactive" || message.type === "button") {
                if (
                    messageContent.toLowerCase().includes("start next activity") ||
                    messageContent.toLowerCase().includes("start next lesson") ||
                    messageContent.toLowerCase().includes("it was great") ||
                    messageContent.toLowerCase().includes("it was great 😁") ||
                    messageContent.toLowerCase().includes("it can be improved") ||
                    messageContent.toLowerCase().includes("it can be improved 🤔") ||
                    messageContent.toLowerCase().includes("yes") ||
                    messageContent.toLowerCase().includes("no, try again") ||
                    messageContent.toLowerCase().includes("no")
                ) {
                    if (
                        messageContent.toLowerCase().includes("it was great") ||
                        messageContent.toLowerCase().includes("it was great 😁") ||
                        messageContent.toLowerCase().includes("it can be improved") ||
                        messageContent.toLowerCase().includes("it can be improved 🤔")
                    ) {
                        await createFeedback(userMobileNumber, messageContent);
                        return;
                    }
                    // Get next lesson to send user
                    const nextLesson = await lessonRepository.getNextLesson(
                        currentUserState.dataValues.currentCourseId,
                        currentUserState.dataValues.currentWeek,
                        currentUserState.dataValues.currentDay,
                        currentUserState.dataValues.currentLesson_sequence
                    );

                    if (!nextLesson) {
                        // Check if current lesson
                        const lessonNumberCheck =
                            (currentUserState.dataValues.currentWeek - 1) * 6 +
                            currentUserState.dataValues.currentDay;
                        if (lessonNumberCheck >= 24) {
                            await sendButtonMessage(userMobileNumber, 'You have completed all the lessons in this course. Click the button below to proceed', [{ id: 'start_my_course', title: 'Start my course' }]);
                            await createActivityLog(userMobileNumber, "template", "outbound", "You have completed all the lessons in this course. Click the button below to proceed", null);
                            // update acceptable messages list for the user
                            await waUserProgressRepository.updateAcceptableMessagesList(
                                userMobileNumber,
                                ["start my course"]
                            );
                            return;
                        }
                        await sendMessage(
                            userMobileNumber,
                            "Please wait for the next lesson to start."
                        );
                        await createActivityLog(
                            userMobileNumber,
                            "text",
                            "outbound",
                            "Please wait for the next lesson to start.",
                            null
                        );
                        return;
                    }

                    // Daily blocking
                    if (!numbers_to_ignore.includes(userMobileNumber)) {
                        const course = await courseRepository.getById(
                            currentUserState.dataValues.currentCourseId
                        );
                        const courseStartDate = new Date(course.dataValues.courseStartDate);
                        const today = new Date();

                        // Calculate the number of days from the start date needed for the current day's content
                        const lessonDayNumber =
                            (nextLesson.dataValues.weekNumber - 1) * 6 +
                            nextLesson.dataValues.dayNumber;
                        const daysRequiredForCurrentLesson = lessonDayNumber - 1; // As before

                        // Add days to course start date, skipping Sundays
                        let dayUnlockDate = new Date(courseStartDate);
                        let daysAdded = 0;

                        while (daysAdded < daysRequiredForCurrentLesson) {
                            dayUnlockDate.setDate(dayUnlockDate.getDate() + 1);
                            if (dayUnlockDate.getDay() !== 0) {
                                daysAdded++;
                            }
                        }

                        // Extract year, month, and date for comparison
                        const todayYear = today.getFullYear();
                        const todayMonth = today.getMonth();
                        const todayDate = today.getDate();

                        const dayUnlockDateYear = dayUnlockDate.getFullYear();
                        const dayUnlockDateMonth = dayUnlockDate.getMonth();
                        const dayUnlockDateDate = dayUnlockDate.getDate();

                        // Check if today is before the unlock date
                        if (
                            todayYear < dayUnlockDateYear ||
                            (todayYear == dayUnlockDateYear &&
                                todayMonth < dayUnlockDateMonth) ||
                            (todayYear == dayUnlockDateYear &&
                                todayMonth == dayUnlockDateMonth &&
                                todayDate < dayUnlockDateDate)
                        ) {
                            const message =
                                "Please wait for the next day's content to unlock.";
                            await sendMessage(userMobileNumber, message);
                            await createActivityLog(
                                userMobileNumber,
                                "text",
                                "outbound",
                                message,
                                null
                            );
                            return;
                        }
                    }

                    // Get acceptable messages for the next question/lesson
                    const acceptableMessagesList = await getAcceptableMessagesList(
                        nextLesson.dataValues.activity
                    );

                    // Update user progress to next lesson
                    await waUserProgressRepository.update(
                        userMobileNumber,
                        nextLesson.dataValues.courseId,
                        nextLesson.dataValues.weekNumber,
                        nextLesson.dataValues.dayNumber,
                        nextLesson.dataValues.LessonId,
                        nextLesson.dataValues.SequenceNumber,
                        nextLesson.dataValues.activity,
                        null,
                        0,
                        acceptableMessagesList
                    );
                    let latestUserState = await waUserProgressRepository.getByPhoneNumber(
                        userMobileNumber
                    );

                    // Send next lesson to user
                    await sendCourseLessonToUser(
                        userMobileNumber,
                        latestUserState,
                        nextLesson,
                        messageType,
                        messageContent
                    );

                    if (nextLesson.dataValues.activity == "video") {
                        const nextLesson = await lessonRepository.getNextLesson(
                            latestUserState.dataValues.currentCourseId,
                            latestUserState.dataValues.currentWeek,
                            latestUserState.dataValues.currentDay,
                            latestUserState.dataValues.currentLesson_sequence
                        );

                        // Mark previous lesson as completed
                        const currentLesson = await lessonRepository.getCurrentLesson(
                            latestUserState.dataValues.currentLessonId
                        );
                        await waLessonsCompletedRepository.endLessonByPhoneNumberAndLessonId(
                            userMobileNumber,
                            currentLesson.dataValues.LessonId
                        );

                        // Get acceptable messages for the next question/lesson
                        const acceptableMessagesList = await getAcceptableMessagesList(
                            nextLesson.dataValues.activity
                        );

                        // Update user progress to next lesson
                        await waUserProgressRepository.update(
                            userMobileNumber,
                            nextLesson.dataValues.courseId,
                            nextLesson.dataValues.weekNumber,
                            nextLesson.dataValues.dayNumber,
                            nextLesson.dataValues.LessonId,
                            nextLesson.dataValues.SequenceNumber,
                            nextLesson.dataValues.activity,
                            null,
                            0,
                            acceptableMessagesList
                        );
                        latestUserState = await waUserProgressRepository.getByPhoneNumber(
                            userMobileNumber
                        );

                        // Send next lesson to user
                        await sendCourseLessonToUser(
                            userMobileNumber,
                            latestUserState,
                            nextLesson,
                            messageType,
                            messageContent
                        );
                    }
                    return;
                }
            }
            if (
                currentUserState.dataValues.activityType &&
                activity_types_to_repeat.includes(
                    currentUserState.dataValues.activityType
                )
            ) {
                // Get the current lesson for next question
                const currentLesson = await lessonRepository.getCurrentLesson(
                    currentUserState.dataValues.currentLessonId
                );

                // Get acceptable messages for the next question
                const acceptableMessagesList = await getAcceptableMessagesList(
                    currentLesson.dataValues.activity
                );

                // Update acceptable messages list for the user
                await waUserProgressRepository.updateAcceptableMessagesList(
                    userMobileNumber,
                    acceptableMessagesList
                );

                // Update user progress to next question
                await sendCourseLessonToUser(
                    userMobileNumber,
                    currentUserState,
                    currentLesson,
                    messageType,
                    messageContent
                );
                return;
            }
        }
    } catch (error) {
        console.error("Error in chatBotService:", error);
        error.fileName = "chatBotService.js";
        throw error;
    }
};

export default { webhookService, verifyWebhookService, uploadUserDataService };
