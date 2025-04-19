import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import { sendButtonMessage, sendMessage, sendMediaMessage } from "./whatsappUtils.js";
import { createActivityLog } from "./createActivityLogUtils.js";
import { sleep } from "./utils.js";

const greetingMessage = async (userMobileNumber) => {
    await waUserProgressRepository.create({
        phoneNumber: userMobileNumber,
        engagement_type: "Greeting Message",
        lastUpdated: new Date(),
    });
    const greetingMessage = "Welcome to Beaj Education! 👋\n\nI'm Ms. Beaj - here to guide you!\n\n👇Please choose your course:";
    const greetingImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/greeting_beaj_face.jpeg";
    await sendButtonMessage(userMobileNumber, greetingMessage, [{ id: 'teacher_course', title: 'Teacher Training' }, { id: 'kids_course', title: 'Kids Summer Camp' }], 0, greetingImage);
    await createActivityLog(userMobileNumber, "template", "outbound", greetingMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["teacher training", "kids summer camp"]);
    return;
};

const greetingMessageLoop = async (userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "Greeting Message");
    const greetingMessage = "👇Please choose your course:";
    await sendButtonMessage(userMobileNumber, greetingMessage, [{ id: 'teacher_course', title: 'Teacher Training' }, { id: 'kids_course', title: 'Kids Summer Camp' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", greetingMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["teacher training", "kids summer camp"]);
    return;
};

const kidsChooseClass = async (userMobileNumber) => {
    await sendMediaMessage(userMobileNumber, "https://beajbloblive.blob.core.windows.net/beajdocuments/kids_promo_2.mp4", "video");
    await createActivityLog(userMobileNumber, "video", "outbound", "https://beajbloblive.blob.core.windows.net/beajdocuments/kids_promo_2.mp4", null);
    await sleep(13000);
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "Choose Class");
    const chooseClassMessage = "🆓 Get a Free Trial!\n\n👇Choose your class:";
    await sendButtonMessage(userMobileNumber, chooseClassMessage, [{ id: 'kids_summer_camp_class_1_or_2', title: 'Grade 1 or 2' }, { id: 'kids_summer_camp_class_5_or_6', title: 'Grades 3 to 6' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", chooseClassMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["grade 1 or 2", "grades 3 to 6"]);
    return;
};

const kidsConfirmClass = async (userMobileNumber, messageContent) => {
    if (messageContent.toLowerCase() == "grade 1 or 2") {
        await waUserProgressRepository.updateEngagementType(userMobileNumber, "Confirm Class - Level 1");
    } else if (messageContent.toLowerCase() == "grades 3 to 6") {
        await waUserProgressRepository.updateEngagementType(userMobileNumber, "Confirm Class - Level 3");
    }
    const confirmClassMessage = "🚀 Let's begin your *Free Trial* for " + messageContent.charAt(0).toUpperCase() + messageContent.slice(1) + "!";
    await sendButtonMessage(userMobileNumber, confirmClassMessage, [{ id: 'start_free_trial', title: 'Start Free Trial' }, { id: 'no_choose_again', title: 'No, Choose Again' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", confirmClassMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["start free trial", "no, choose again"]);
    return;
};

const kidsChooseClassLoop = async (userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "Choose Class");
    const chooseClassMessage = "👇Choose your class:";
    await sendButtonMessage(userMobileNumber, chooseClassMessage, [{ id: 'kids_summer_camp_class_1_or_2', title: 'Grade 1 or 2' }, { id: 'kids_summer_camp_class_5_or_6', title: 'Grades 3 to 6' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", chooseClassMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["grade 1 or 2", "grades 3 to 6"]);
    return;
};

const demoCourseStart = async (userMobileNumber, startingLesson, courseName) => {
    await waUserProgressRepository.update(
        userMobileNumber,
        await courseRepository.getCourseIdByName(
            courseName
        ),
        startingLesson.dataValues.weekNumber,
        startingLesson.dataValues.dayNumber,
        startingLesson.dataValues.LessonId,
        startingLesson.dataValues.SequenceNumber,
        startingLesson.dataValues.activity,
        null,
        null,
    );
    await waUserProgressRepository.updateEngagementType(userMobileNumber, courseName);

    let persona = "";
    if (courseName == "Free Trial - Teachers") {
        persona = "teacher";
    } else if (courseName == "Free Trial - Kids - Level 1" || courseName == "Free Trial - Kids - Level 3") {
        persona = "kid";
    }
    await waUserProgressRepository.updatePersona(userMobileNumber, persona);

    // Text Message
    let message = "";
    if (courseName == "Free Trial - Teachers") {
        message = "Great! Let's start your free trial! 🤩 Here is your first lesson.";
    } else if (courseName == "Free Trial - Kids - Level 1" || courseName == "Free Trial - Kids - Level 3") {
        message = "GREAT! 💥\n\nLet's Start Our Adventure! 🤩";
    }
    await sendMessage(userMobileNumber, message);
    await createActivityLog(userMobileNumber, "text", "outbound", message, null);
    return;
};

const endTrial = async (userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "End Now");
    let endTrialMessage = "You have chosen to end your free trial. Would you like to:";
    const user = await waUsersMetadataRepository.getByPhoneNumber(userMobileNumber);
    if (user.dataValues.userRegistrationComplete) {
        await sendButtonMessage(userMobileNumber, endTrialMessage, [{ id: 'get_another_trial', title: 'Get Another Trial' }]);
    } else {
        await sendButtonMessage(userMobileNumber, endTrialMessage, [{ id: 'get_another_trial', title: 'Get Another Trial' }, { id: 'register', title: 'Register' }]);
    }
    await createActivityLog(userMobileNumber, "template", "outbound", endTrialMessage, null);
    if (user.dataValues.userRegistrationComplete) {
        await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["get another trial"]);
    } else {
        await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["get another trial", "register"]);
    }
    return;
};

const getSchoolName = async (userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "School Name");
    const schoolInputMessage = "Please type your school's name:";
    await sendMessage(userMobileNumber, schoolInputMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", schoolInputMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["text"]);
    return;
};

const confirmSchoolName = async (userMobileNumber, messageContent) => {
    await waUsersMetadataRepository.updateSchoolName(userMobileNumber, messageContent);
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "Confirm School Name");
    const confirmSchoolNameMessage = "Please confirm your school's name: " + messageContent;
    await sendButtonMessage(userMobileNumber, confirmSchoolNameMessage, [{ id: 'yes', title: 'Yes' }, { id: 'no', title: 'No' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", confirmSchoolNameMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(userMobileNumber, ["yes", "no"]);
    return;
};

const thankyouMessage = async (userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(userMobileNumber, "Thankyou Message");
    await waUserProgressRepository.update(
        userMobileNumber,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        ["get another trial"]
    );
    const freeTrialCompleteImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/free_trial_complete.jpeg"
    await sendButtonMessage(userMobileNumber, '👏🏽Trial Complete! 🤓', [{ id: 'get_another_trial', title: 'Get Another Trial' }], 0, freeTrialCompleteImage);
    await createActivityLog(userMobileNumber, "image", "outbound", freeTrialCompleteImage, null);
    await waUsersMetadataRepository.update(userMobileNumber, {
        userRegistrationComplete: new Date()
    });
    return;
};


export {
    greetingMessage,
    greetingMessageLoop,
    kidsChooseClass,
    kidsConfirmClass,
    kidsChooseClassLoop,
    demoCourseStart,
    endTrial,
    getSchoolName,
    confirmSchoolName,
    thankyouMessage
};