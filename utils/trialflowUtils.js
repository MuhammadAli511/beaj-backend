import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waPurchasedCoursesRepository from "../repositories/waPurchasedCoursesRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import { sendButtonMessage, sendMessage, sendMediaMessage, sendContactCardMessage } from "./whatsappUtils.js";
import { createActivityLog } from "./createActivityLogUtils.js";
import { najiaContactData, amnaContactData } from "../constants/contacts.js";
import courses from "../constants/courses.js";
import { sleep } from "./utils.js";
import waUserActivityLogsRepository from "../repositories/waUserActivityLogsRepository.js";
import * as imageGenerationUtils from "./imageGenerationUtils.js";


const greetingMessage = async (profileId, userMobileNumber, persona) => {
    await waUserProgressRepository.create({
        profile_id: profileId,
        phoneNumber: userMobileNumber,
        engagement_type: "Greeting Message",
        lastUpdated: new Date(),
    });
    let greetingMessageText = "";
    if (persona == "kids") {
        greetingMessageText = `Welcome to Beaj Education! 👋\n\nبیج ایجوکیشن میں خوش آمدید!\n\n`;
    } else if (persona == "teachers") {
        greetingMessageText = `Welcome to Beaj Education! 👋\n\nI'm Ms. Beaj - here to guide you!\n\n👇Click on the “Start button”`;
    }

    if (persona == "kids") {
        // const greetingImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/welcome_new.jpeg";
        // await sendMediaMessage(userMobileNumber, greetingImage, "image", greetingMessageText);
        // await createActivityLog(userMobileNumber, "image", "outbound", greetingImage, null);
        // await sleep(1000);
        await sendMessage(userMobileNumber, greetingMessageText);
        await createActivityLog(userMobileNumber, "text", "outbound", greetingMessageText, null);
        let videoCaption = "Why should you choose Beaj Education? Here is a message from our founder.\n\nآپ کو بیج ایجوکیشن کیوں چُننا چاہیے؟ — بیج ایجوکیشن کی سربراہ کا پیغام۔";
        await sendButtonMessage(userMobileNumber, videoCaption, [{ id: 'start_free_trial', title: 'Start Free Trial' }, { id: 'go_to_registration', title: 'Go to Registration' }], 0, null, "https://beajbloblive.blob.core.windows.net/beajdocuments/why_beaj3.mp4");
        await createActivityLog(userMobileNumber, "template", "outbound", videoCaption, null);
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start free trial", "go to registration"]);
        await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Greeting Message - Kids");
    } else if (persona == "teachers") {
        const greetingImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/welcome_new.jpeg";
        await sendButtonMessage(userMobileNumber, greetingMessageText, [{ id: 'start', title: 'Start' }], 0, greetingImage);
        await createActivityLog(userMobileNumber, "image", "outbound", greetingImage, null);
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start"]);
        return;
    }
};

const greetingMessageLoop = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Greeting Message");
    const greetingMessageText = "👇Click on the “Start button”";
    await sendButtonMessage(userMobileNumber, greetingMessageText, [{ id: 'start', title: 'Start' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", greetingMessageText, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start"]);
    return;
};

const kidsChooseClass = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Choose Class");
    // await sendMediaMessage(userMobileNumber, "https://beajbloblive.blob.core.windows.net/beajdocuments/summer_intro_video.mp4", "video");
    // await createActivityLog(userMobileNumber, "video", "outbound", "https://beajbloblive.blob.core.windows.net/beajdocuments/summer_intro_video.mp4", null);
    const chooseClassMessage = `Take a look inside the course!\nکورس کی ایک جھلک دیکھیں۔\n\n👇Choose your class:\nاپنی کلاس منتخب کریں۔`;
    await sendButtonMessage(userMobileNumber, chooseClassMessage, [{ id: 'kids_summer_camp_class_1_or_2', title: 'Class 1 or 2' }, { id: 'kids_summer_camp_class_5_or_6', title: 'Class 3 to 6' }], 0, null, "https://beajbloblive.blob.core.windows.net/beajdocuments/summer_intro_video.mp4");
    await createActivityLog(userMobileNumber, "template", "outbound", chooseClassMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["class 1 or 2", "class 3 to 6"]);
    return;
};

const kidsConfirmClass = async (profileId, userMobileNumber, messageContent) => {
    if (messageContent.toLowerCase() == "class 1 or 2") {
        await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Confirm Class - Level 1");
    } else if (messageContent.toLowerCase() == "class 3 to 6") {
        await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Confirm Class - Level 3");
    }
    let confirmClassMessage = "";
    if (messageContent.toLowerCase() == "class 1 or 2") {
        confirmClassMessage = "🚀 Ready to start your trial for " + messageContent.charAt(0).toUpperCase() + messageContent.slice(1) + "?\n کلاس 1 یا 2 کے لیے فری ٹرائل شروع کریں؟";
    } else if (messageContent.toLowerCase() == "class 3 to 6") {
        confirmClassMessage = "🚀 Ready to start your trial for " + messageContent.charAt(0).toUpperCase() + messageContent.slice(1) + "?\n کلاس 3 سے 6 کے لیے فری ٹرائل شروع کریں؟";
    }
    await sendButtonMessage(userMobileNumber, confirmClassMessage, [{ id: 'start_free_trial', title: 'Start Free Trial' }, { id: 'no_choose_again', title: 'No, Choose Again' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", confirmClassMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start free trial", "no, choose again"]);
    return;
};

const kidsChooseClassLoop = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Choose Class");
    const chooseClassMessage = "👇Choose your class:\nکلاس منتخب کریں:";
    await sendButtonMessage(userMobileNumber, chooseClassMessage, [{ id: 'kids_summer_camp_class_1_or_2', title: 'Class 1 or 2' }, { id: 'kids_summer_camp_class_5_or_6', title: 'Class 3 to 6' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", chooseClassMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["class 1 or 2", "class 3 to 6"]);
    return;
};

const demoCourseStart = async (profileId, userMobileNumber, startingLesson, courseName) => {
    await waUserProgressRepository.update(
        profileId,
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
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, courseName);

    let persona = "";
    if (courseName == "Free Trial - Teachers") {
        persona = "teacher";
    } else if (courseName == "Free Trial - Kids - Level 1" || courseName == "Free Trial - Kids - Level 3") {
        persona = "kid";
    }
    await waUserProgressRepository.updatePersona(profileId, userMobileNumber, persona);

    // Text Message
    let message = "";
    if (courseName == "Free Trial - Teachers") {
        message = "Great! Let's start your free trial! 🤩 Here is your first lesson.";
        await sendMessage(userMobileNumber, message);
        await createActivityLog(userMobileNumber, "text", "outbound", message, null);
        return;
    } else if (courseName == "Free Trial - Kids - Level 1" || courseName == "Free Trial - Kids - Level 3") {
        // message = `Great! 💥 Let's Start!\nزبردست! شروع کرتے ہیں!\n\nComplete the trial and win your first reward! 🏅\n ہر قدم پر انعام جیتیں!`;
        message = `Great! 💥 Let's Start!\nزبردست! شروع کرتے ہیں!`;
        await sendMessage(userMobileNumber, message);
        await createActivityLog(userMobileNumber, "text", "outbound", message, null);
        return;
    }

};

const endTrialTeachers = async (profileId, userMobileNumber) => {
    await waUsersMetadataRepository.updateFreeDemoEnded(profileId, userMobileNumber);
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "End Now");
    let endTrialMessage = "You have chosen to end your free trial. Next Steps:";
    const freeTrialCompleteImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/free_trial_complete.jpeg"
    const user = await waUsersMetadataRepository.getByPhoneNumber(userMobileNumber);
    if (user.dataValues.userRegistrationComplete) {
        await sendButtonMessage(userMobileNumber, endTrialMessage, [{ id: 'get_another_trial', title: 'Get Another Trial' }], 0, freeTrialCompleteImage);
    } else {
        await sendButtonMessage(userMobileNumber, endTrialMessage, [{ id: 'get_another_trial', title: 'Get Another Trial' }, { id: 'register', title: 'Register' }], 0, freeTrialCompleteImage);
    }
    await createActivityLog(userMobileNumber, "template", "outbound", endTrialMessage, null);
    if (user.dataValues.userRegistrationComplete) {
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["get another trial"]);
    } else {
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["get another trial", "register"]);
    }
    return;
};

const endTrialKids = async (profileId, userMobileNumber) => {
    await waUsersMetadataRepository.updateFreeDemoEnded(profileId, userMobileNumber);
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "End Now");
    let endTrialMessage = "You have chosen to end your free trial. Next Steps:\n\nآپ کا ٹرائل ختم ہوا۔ آپ آگے کیا کرنا چاہیں گے؟";
    const user = await waUsersMetadataRepository.getByPhoneNumber(userMobileNumber);
    if (user.dataValues.userRegistrationComplete) {
        await sendButtonMessage(userMobileNumber, endTrialMessage, [{ id: 'get_another_trial', title: 'Get Another Trial' }]);
    } else {
        await sendButtonMessage(userMobileNumber, endTrialMessage, [{ id: 'camp_registration', title: 'Camp Registration' }, { id: 'get_another_trial', title: 'Get Another Trial' }]);
    }
    await createActivityLog(userMobileNumber, "template", "outbound", endTrialMessage, null);
    if (user.dataValues.userRegistrationComplete) {
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["get another trial"]);
    } else {
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["get another trial", "camp registration"]);
    }
    return;
};

const getSchoolName = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "School Name");
    const schoolInputMessage = "Please type your school's name:";
    await sendMessage(userMobileNumber, schoolInputMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", schoolInputMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["text"]);
    return;
};

const confirmSchoolName = async (profileId, userMobileNumber, messageContent) => {
    await waUsersMetadataRepository.updateSchoolName(profileId, userMobileNumber, messageContent);
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Confirm School Name");
    const confirmSchoolNameMessage = "Please confirm your school's name: " + messageContent;
    await sendButtonMessage(userMobileNumber, confirmSchoolNameMessage, [{ id: 'yes', title: 'Yes' }, { id: 'no', title: 'No' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", confirmSchoolNameMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["yes", "no"]);
    return;
};

const getCityName = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "City Name");
    const cityInputMessage = "Please type your city's name:";
    await sendMessage(userMobileNumber, cityInputMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", cityInputMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["text"]);
    return;
};

const confirmCityName = async (profileId, userMobileNumber, messageContent) => {
    await waUsersMetadataRepository.updateCityName(profileId, userMobileNumber, messageContent);
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Confirm City Name");
    const confirmCityNameMessage = "Please confirm your city's name: " + messageContent;
    await sendButtonMessage(userMobileNumber, confirmCityNameMessage, [{ id: 'yes', title: 'Yes' }, { id: 'no', title: 'No' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", confirmCityNameMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["yes", "no"]);
    return;
};

const getUserProfile = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "User Profile");
    const userProfileMessage = "Are you a parent/student or school admin?\n\nکیا آپ والدین/سٹوڈنٹ ہیں یا سکول چلاتے ہیں؟";
    await sendButtonMessage(userMobileNumber, userProfileMessage, [{ id: 'parent_student', title: 'Parent or Student' }, { id: 'school_admin', title: 'School Admin' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", userProfileMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["parent or student", "school admin"]);
    return;
};

const thankyouMessageSchoolOwner = async (profileId, userMobileNumber, messageContent) => {
    await waUsersMetadataRepository.updateCityName(profileId, userMobileNumber, messageContent);
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Thankyou Message");
    await waUserProgressRepository.update(profileId, userMobileNumber, null, null, null, null, null, null, null, null, ["get another trial", "chat with beaj rep"]);
    const schoolRegistrationImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/school_registration.jpg"
    let thankyouMessage = "A Beaj team member will call you within 24 hours to discuss a partnership with your school!\nWe look forward to speaking with you soon!\nاگلے 24 گھنٹے میں بیج ٹیم کا نمائندہ آپ سے اسکول پارٹنرشپ کے لئے رابطہ کرے گا۔ ہم آپ سے بات کرنے کے منتظر ہیں! \n\nIn the meantime, if you have any questions, please click on 'Chat with Beaj Rep' to talk to our team.\nاس دوران اگر آپ کے کوئ سوال ہیں، تو ‘Chat with Beaj Rep’ پر کلک کیجیئے اور ہم سے رابطہ کریں۔";
    await sendButtonMessage(userMobileNumber, thankyouMessage, [{ id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }, { id: 'get_another_trial', title: 'Get Another Trial' }], 0, schoolRegistrationImage);
    await createActivityLog(userMobileNumber, "image", "outbound", schoolRegistrationImage, null);
    await waUsersMetadataRepository.update(profileId, userMobileNumber, {
        userRegistrationComplete: new Date()
    });
    return;
};


const readyToPay = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Ready to Pay");
    let readyToPayMessage = "If you are ready for fee payment, click on 'Ready for payment'\nOr if you have any questions, click on 'Chat with Beaj Rep'\n\nاگر آپ فیس ادا کرنے کے لیے تیار ہیں،  تو 'Ready for payment' پر کلک کریں۔\nیاں اگر آپ کوئ سوال پوچھنا چاہتے ہیں، تو 'Chat with Beaj Rep' پر کلک کریں۔";
    await sendButtonMessage(userMobileNumber, readyToPayMessage, [{ id: 'ready_for_payment', title: 'Ready for Payment' }, { id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }, { id: 'get_another_trial', title: 'Get Another Trial' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", readyToPayMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["ready for payment", "chat with beaj rep", "get another trial"]);
    return;
};

const parentOrStudentSelection = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Parent or Student");
    let flyerEnglish = "https://beajbloblive.blob.core.windows.net/beajdocuments/flyer_english.jpg";
    let flyerUrdu = "https://beajbloblive.blob.core.windows.net/beajdocuments/flyer_urdu.jpg";
    await sendMediaMessage(userMobileNumber, flyerEnglish, "image", null);
    await sleep(2000);
    await sendMediaMessage(userMobileNumber, flyerUrdu, "image", null);
    await sleep(2000);
    await waUserProgressRepository.updatePersona(profileId, userMobileNumber, "parent or student");
    let instructionAudio = "https://beajbloblive.blob.core.windows.net/beajdocuments/registration_instructions1.mp3";
    await sendMediaMessage(userMobileNumber, instructionAudio, "audio", null);
    await createActivityLog(userMobileNumber, "audio", "outbound", instructionAudio, null);
    await sleep(5000);
    let selectOptionMessage = "👆Listen to the audio instructions and select an option:\n\n:آڈیو ہدایات سنیں اور ایک آپشن منتخب کریں";
    await sendButtonMessage(userMobileNumber, selectOptionMessage, [{ id: 'enroll_on_whatsapp', title: 'Enroll on Whatsapp' }, { id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", selectOptionMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["enroll on whatsapp", "chat with beaj rep"]);
    return;
};

const thankyouMessageParent = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Thankyou Message");
    await waUserProgressRepository.update(profileId, userMobileNumber, null, null, null, null, null, null, null, null, ["get another trial"]);
    const parentThankyouImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/parents_registration.jpg"
    let thankyouMessage = `Thank You!\n\nA Beaj Rep will call you within the next 24 hours to confirm your registration.\nWe are excited to speak to you soon!\nشکریہ!\n\nبیج ٹیم کا نمائندہ آپ سے 24 گھنٹوں کے اندر رابطہ کر کے آپ کی رجسٹریشن مکمل کرے گا.\nہم آپ سے بات کرنے کے منتظر ہی`;
    await sendButtonMessage(userMobileNumber, thankyouMessage, [{ id: 'get_another_trial', title: 'Get Another Trial' }], 0, parentThankyouImage);
    await createActivityLog(userMobileNumber, "image", "outbound", parentThankyouImage, null);
    await waUsersMetadataRepository.update(profileId, userMobileNumber, {
        userRegistrationComplete: new Date()
    });
    return;
};

const talkToBeajRep = async (profileId, userMobileNumber) => {
    const user = await waUserProgressRepository.getByProfileId(profileId);
    if (user.dataValues.persona == "school admin") {
        await sendContactCardMessage(userMobileNumber, najiaContactData);
    } else {
        await sendContactCardMessage(userMobileNumber, amnaContactData);
    }
    await sleep(2000);
    let contactCardMessage = `👆Click on the Message button to chat with a Beaj Representative.\nبیج کے نمائندے سے بات کرنے کے لیئے "Message" بٹن پر کلک کریں۔`;
    await sendMessage(userMobileNumber, contactCardMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", contactCardMessage, null);
    return;
};

// Multi user registration
const studentNameInput = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Student Name Input");
    const studentNameInputMessage = "Please type student's *Full Name*\n\nطالب علم کا مکمل نام لکھیں۔";
    await sendMessage(userMobileNumber, studentNameInputMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", studentNameInputMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["text"]);
    return;
};

const studentNameConfirmation = async (profileId, userMobileNumber, messageContent) => {
    await waUsersMetadataRepository.updateName(profileId, userMobileNumber, messageContent);
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Student Name Confirmation");
    const studentNameConfirmationMessage = "Confirm name: " + messageContent + "\n\nنام کی تصدیق کریں: " + messageContent;
    await sendButtonMessage(userMobileNumber, studentNameConfirmationMessage, [{ id: 'yes', title: 'Yes' }, { id: 'no', title: 'No' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", studentNameConfirmationMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["yes", "no"]);
    return;
};

const studentGenericClassInput = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Student Generic Class Input");
    const studentClassInputMessage = "Please select student's *class level*:\n\nطالب علم کی *کلاس* منتخب کریں۔";
    await sendButtonMessage(userMobileNumber, studentClassInputMessage, [{ id: 'class_1_or_2_or_3', title: 'Class 1, 2 or 3' }, { id: 'class_4_or_5_or_6', title: 'Class 4, 5 or 6' }, { id: 'class_7_or_8', title: 'Class 7 or 8' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", studentClassInputMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["class 1, 2 or 3", "class 4, 5 or 6", "class 7 or 8"]);
    return;
};

const studentGenericClassConfirmation = async (profileId, userMobileNumber, messageContent) => {
    await waUsersMetadataRepository.updateClassLevel(profileId, userMobileNumber, messageContent);
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Student Generic Class Confirmation");
    const studentClassConfirmationMessage = "Confirm class level: " + messageContent + "\n\nکلاس کی تصدیق کریں: " + messageContent;
    await sendButtonMessage(userMobileNumber, studentClassConfirmationMessage, [{ id: 'yes', title: 'Yes' }, { id: 'no', title: 'No' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", studentClassConfirmationMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["yes", "no"]);
    return;
};

const studentSpecificClassInput = async (profileId, userMobileNumber, genericClass) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Student Specific Class Input");
    const studentClassInputMessage = "Please select student's *class*:\n\nطالب علم کی *کلاس* منتخب کریں۔";
    if (genericClass.toLowerCase() == "class 1, 2 or 3") {
        await sendButtonMessage(userMobileNumber, studentClassInputMessage, [{ id: 'class_1', title: 'Class 1' }, { id: 'class_2', title: 'Class 2' }, { id: 'class_3', title: 'Class 3' }]);
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["class 1", "class 2", "class 3"]);
    } else if (genericClass.toLowerCase() == "class 4, 5 or 6") {
        await sendButtonMessage(userMobileNumber, studentClassInputMessage, [{ id: 'class_4', title: 'Class 4' }, { id: 'class_5', title: 'Class 5' }, { id: 'class_6', title: 'Class 6' }]);
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["class 4", "class 5", "class 6"]);
    } else if (genericClass.toLowerCase() == "class 7 or 8") {
        await sendButtonMessage(userMobileNumber, studentClassInputMessage, [{ id: 'class_7', title: 'Class 7' }, { id: 'class_8', title: 'Class 8' }]);
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["class 7", "class 8"]);
    }
    await createActivityLog(userMobileNumber, "template", "outbound", studentClassInputMessage, null);
    return;
};

const studentSpecificClassConfirmation = async (profileId, userMobileNumber, messageContent) => {
    await waUsersMetadataRepository.updateClassLevel(profileId, userMobileNumber, messageContent);
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Student Specific Class Confirmation");
    const studentClassConfirmationMessage = "Confirm student's class: " + messageContent + "\n\nطالب علم کی کلاس کی تصدیق کریں: " + messageContent;
    await sendButtonMessage(userMobileNumber, studentClassConfirmationMessage, [{ id: 'yes', title: 'Yes' }, { id: 'no', title: 'No' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", studentClassConfirmationMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["yes", "no"]);
    return;
};

const singleStudentRegistationComplate = async (profileId, userMobileNumber) => {
    await waUsersMetadataRepository.update(profileId, userMobileNumber, {
        userRegistrationComplete: new Date()
    });
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Single Student Registration Complete");
    const user = await waUsersMetadataRepository.getByProfileId(profileId);
    const name = user.dataValues.name;
    const singleStudentRegistrationCompleteMessage =
        name + "'s registration is now complete! 🎉" +
        "\n\n👉 Do you want to register another student?" +
        "\n\n\u202B" + name + " کا اندراج مکمل ہو چکا ہے! 🎉" + "\u202C" +
        "\n\n\u202B👈 کیا آپ کسی اور طالب علم کا اندراج کرنا چاہتے ہیں؟\u202C";
    await sendButtonMessage(userMobileNumber, singleStudentRegistrationCompleteMessage, [{ id: 'yes', title: 'Yes' }, { id: 'no', title: 'No, go to payment' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", singleStudentRegistrationCompleteMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["yes", "no", "no, go to payment"]);
    return;
};

const totalRegistrationsSummary = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Total Registrations Summary");
    const registrationsSummary = await waUsersMetadataRepository.getTotalRegistrationsSummary(userMobileNumber);
    const totalRegistrations = registrationsSummary.count;
    const registrationsList = registrationsSummary.registrations.map((reg, index) =>
        `${index + 1}) ${reg.name} - ${reg.classLevel}`
    ).join('\n');
    const totalRegistrationsSummaryMessage =
        "Total number of registrations for Beaj Student Summer Camp: " + totalRegistrations +
        "\n" + registrationsList +
        "\n\n\nبیج اسٹوڈنٹ سمر کیمپ کے لئے کل رجسٹریشنز کی تعداد: " + totalRegistrations +
        "\n" + registrationsList;
    await sendButtonMessage(userMobileNumber, totalRegistrationsSummaryMessage, [{ id: 'continue_to_payment', title: 'Continue to Payment' }, { id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", totalRegistrationsSummaryMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["continue to payment", "chat with beaj rep"]);
    return;
};

const paymentDetails = async (profileId, userMobileNumber) => {
    const registrationsSummary = await waUsersMetadataRepository.getTotalRegistrationsSummary(userMobileNumber);
    const totalRegistrations = registrationsSummary.count;
    let perCoursePrice = await waUserActivityLogsRepository.getStudentCoursePriceByFirstMessage(userMobileNumber);
    if (totalRegistrations > 1) {
        perCoursePrice = 1200;
    }
    const totalPrice = totalRegistrations * perCoursePrice;
    const invoiceImageUrl = await imageGenerationUtils.generateInvoiceImage(userMobileNumber, registrationsSummary);
    await sendMediaMessage(userMobileNumber, invoiceImageUrl, "image");
    await createActivityLog(userMobileNumber, "image", "outbound", invoiceImageUrl, null);
    await sleep(4000);
    let bankAccountDetails =
        "To *confirm* your registration, please make a payment of Rs. " + totalPrice + " to our bank account." +
        "\n\n*Beaj Bank Account details:*\n" +
        "Account Name: Beaj Education Pvt Ltd\n" +
        "Bank Name: Bank Al Falah\n" +
        "Account Number: 04041007987401\n\n" +
        "👉Please send us a screenshot of your payment.\n\n\n\n" +
        "\u202Bاپنی رجسٹریشن کی *تصدیق* کے لئے، " + totalPrice + " روپے ہماری بینک اکاؤنٹ میں جمع کروائیں۔\u202C" +
        "\n\n\u202B*بیج بینک اکاؤنٹ کی تفصیلات:*\n" +
        "اکاؤنٹ کا نام: بیج ایجوکیشن پرائیویٹ لمیٹڈ\n" +
        "بینک کا نام: بینک الفلاح\n" +
        "اکاؤنٹ نمبر: 04041007987401\u202C\n\n" +
        "\u202B👈 اپنی ادائیگی کا اسکرین شاٹ ہمیں بھیجیں۔\u202C";
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Payment Details");
    await sendButtonMessage(userMobileNumber, bankAccountDetails, [{ id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", bankAccountDetails, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["image", "chat with beaj rep"]);
    return;
};

const paymentComplete = async (profileId, userMobileNumber, paymentProof) => {
    const registrationsSummary = await waUsersMetadataRepository.getTotalRegistrationsSummary(userMobileNumber);
    const users = registrationsSummary.registrations;
    for (const user of users) {
        const userPhoneNumber = user.dataValues.phoneNumber;
        const userProfileId = user.dataValues.profile_id;
        const userPurchasedCourses = await waPurchasedCoursesRepository.getPurchasedCoursesByProfileId(userProfileId);
        if (userPurchasedCourses.length > 0) {
            continue;
        }
        const userClassLevel = user.dataValues.classLevel;
        const courseName = courses[userClassLevel];
        const courseCategoryId = await courseRepository.getCourseCategoryIdByName(courseName);
        const courseId = await courseRepository.getCourseIdByName(courseName);
        await waPurchasedCoursesRepository.create({
            phoneNumber: userPhoneNumber,
            profile_id: userProfileId,
            courseCategoryId: courseCategoryId,
            courseId: courseId,
            courseStartDate: new Date(),
            paymentProof: paymentProof,
            paymentStatus: "Pending Approval",
            purchaseDate: new Date()
        });
    }
    const parentThankyouImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/parents_registration.jpg"
    let thankYouMessage =
        "Thank You! A member from the Beaj Team will call you to confirm your payment and add you to your Summer Camp class!" +
        "\n\nIf you have any additional questions, please click on Chat with Beaj Rep." +
        "\n\nشکریہ! بیج ٹیم کا ایک رکن آپ کو آپ کی ادائیگی کی تصدیق کے لئے کال کرے گا اور آپ کو آپ کی سمر کیمپ کلاس میں شامل کرے گا۔" +
        "\n\nاگر آپ کے پاس کوئی اضافی سوالات ہیں، تو 'بیج ریپ کے ساتھ چیٹ کریں' پر کلک کریں۔";
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Payment Complete");
    await sendButtonMessage(userMobileNumber, thankYouMessage, [{ id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }], 0, parentThankyouImage);
    await createActivityLog(userMobileNumber, "template", "outbound", thankYouMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["chat with beaj rep"]);
    return;
};


export {
    greetingMessage,
    greetingMessageLoop,
    kidsChooseClass,
    kidsConfirmClass,
    kidsChooseClassLoop,
    demoCourseStart,
    endTrialTeachers,
    endTrialKids,
    confirmSchoolName,
    thankyouMessageSchoolOwner,
    getUserProfile,
    getSchoolName,
    getCityName,
    confirmCityName,
    readyToPay,
    thankyouMessageParent,
    talkToBeajRep,
    parentOrStudentSelection,
    studentGenericClassInput,
    studentSpecificClassInput,
    paymentDetails,
    paymentComplete,
    totalRegistrationsSummary,
    singleStudentRegistationComplate,
    studentNameInput,
    studentNameConfirmation,
    studentGenericClassConfirmation,
    studentSpecificClassConfirmation
};