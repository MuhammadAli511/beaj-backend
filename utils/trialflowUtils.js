import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import { sendButtonMessage, sendMessage, sendMediaMessage } from "./whatsappUtils.js";
import { createActivityLog } from "./createActivityLogUtils.js";
import { sleep } from "./utils.js";


const greetingMessage = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.create({
        profile_id: profileId,
        phoneNumber: userMobileNumber,
        engagement_type: "Greeting Message",
        lastUpdated: new Date(),
    });
    const greetingMessage = `
        Welcome to Beaj Education! 👋\n
        بیج ایجوکیشن میں خوش آمدید!
        \n\n
        I'm Ms. Beaj - here to guide you!\n
        میں ہوں مس بیج - آپ کی مدد کے لیے حاضر ہوں!
        \n\n
        👇Click on the “Start button”\n
        نیچے Start  بٹن پر کلک کریں۔
    `;
    const greetingImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/greeting_beaj_face.jpeg";
    await sendButtonMessage(userMobileNumber, greetingMessage, [{ id: 'start', title: 'Start' }], 0, greetingImage);
    await createActivityLog(userMobileNumber, "template", "outbound", greetingMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start"]);
    return;
};

const greetingMessageLoop = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Greeting Message");
    const greetingMessage = "👇Click on the “Start button”\n نیچے Start  بٹن پر کلک کریں۔";
    await sendButtonMessage(userMobileNumber, greetingMessage, [{ id: 'start', title: 'Start' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", greetingMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start"]);
    return;
};

const kidsChooseClass = async (profileId, userMobileNumber) => {
    await sendMediaMessage(userMobileNumber, "https://beajbloblive.blob.core.windows.net/beajdocuments/kids_promo_2.mp4", "video");
    await createActivityLog(userMobileNumber, "video", "outbound", "https://beajbloblive.blob.core.windows.net/beajdocuments/kids_promo_2.mp4", null);
    await sleep(13000);
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Choose Class");
    const chooseClassMessage = `
        🆓 Get a Free Trial!\n
        فری ٹرائل شروع کریں۔
        \n\n
        👇Choose your class:\n
        آپ کس کلاس میں ہیں؟
    `;
    await sendButtonMessage(userMobileNumber, chooseClassMessage, [{ id: 'kids_summer_camp_class_1_or_2', title: 'Grade 1 or 2' }, { id: 'kids_summer_camp_class_5_or_6', title: 'Grades 3 to 6' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", chooseClassMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["grade 1 or 2", "grades 3 to 6"]);
    return;
};

const kidsConfirmClass = async (profileId, userMobileNumber, messageContent) => {
    if (messageContent.toLowerCase() == "grade 1 or 2") {
        await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Confirm Class - Level 1");
    } else if (messageContent.toLowerCase() == "grades 3 to 6") {
        await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Confirm Class - Level 3");
    }
    const confirmClassMessage = "🚀 Ready to start your trial for " + messageContent.charAt(0).toUpperCase() + messageContent.slice(1) + "?\n کلاس 3 سے 6 کے لیے فری ٹرائل شروع کریں؟";
    await sendButtonMessage(userMobileNumber, confirmClassMessage, [{ id: 'start_free_trial', title: 'Start Free Trial' }, { id: 'no_choose_again', title: 'No, Choose Again' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", confirmClassMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start free trial", "no, choose again"]);
    return;
};

const kidsChooseClassLoop = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Choose Class");
    const chooseClassMessage = "👇Choose your class:";
    await sendButtonMessage(userMobileNumber, chooseClassMessage, [{ id: 'kids_summer_camp_class_1_or_2', title: 'Grade 1 or 2' }, { id: 'kids_summer_camp_class_5_or_6', title: 'Grades 3 to 6' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", chooseClassMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["grade 1 or 2", "grades 3 to 6"]);
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
    } else if (courseName == "Free Trial - Kids - Level 1" || courseName == "Free Trial - Kids - Level 3") {
        message = `
            Great! 💥Let's Start!\n
            زبردست! شروع کرتے ہیں!
            \n\n
            Build skills and win medals!🏅\n
            ہر قدم پر انعام جیتیں!
        `;
    }
    await sendMessage(userMobileNumber, message);
    await createActivityLog(profileId, userMobileNumber, "text", "outbound", message, null);
    return;
};

const endTrialTeachers = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "End Now");
    let endTrialMessage = "You have chosen to end your free trial. Would you like to:";
    const user = await waUsersMetadataRepository.getByPhoneNumber(userMobileNumber);
    if (user.dataValues.userRegistrationComplete) {
        await sendButtonMessage(userMobileNumber, endTrialMessage, [{ id: 'get_another_trial', title: 'Get Another Trial' }]);
    } else {
        await sendButtonMessage(userMobileNumber, endTrialMessage, [{ id: 'get_another_trial', title: 'Get Another Trial' }, { id: 'register', title: 'Register' }]);
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
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "End Now");
    let endTrialMessage = "You have chosen to end your free trial. Would you like to:";
    const user = await waUsersMetadataRepository.getByPhoneNumber(userMobileNumber);
    if (user.dataValues.userRegistrationComplete) {
        await sendButtonMessage(userMobileNumber, endTrialMessage, [{ id: 'get_another_trial', title: 'Get Another Trial' }]);
    } else {
        await sendButtonMessage(userMobileNumber, endTrialMessage, [{ id: 'get_another_trial', title: 'Get Another Trial' }, { id: 'camp_registration', title: 'Camp Registration' }]);
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
    const userProfileMessage = "Are you a parent or a school owner?\nکیا آپ بچے کے والدین ہیں یا اسکول چلاتے ہیں؟";
    await sendButtonMessage(userMobileNumber, userProfileMessage, [{ id: 'parent', title: 'Parent' }, { id: 'school_owner', title: 'School Owner' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", userProfileMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["parent", "school owner"]);
    return;
};

const thankyouMessageSchoolOwner = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Thankyou Message");
    await waUserProgressRepository.update(profileId, userMobileNumber, null, null, null, null, null, null, null, null, ["get another trial"]);
    const freeTrialCompleteImage = "https://beajbloblive.blob.core.windows.net/beajdocuments/free_trial_complete.jpeg"
    let thankyouMessage = "A beaj team member will call you within 24 hrs to discuss a partnership with your school!\n\nWe look forward to speaking with you soon!";
    await sendButtonMessage(userMobileNumber, thankyouMessage, [{ id: 'get_another_trial', title: 'Get Another Trial' }], 0, freeTrialCompleteImage);
    await createActivityLog(userMobileNumber, "image", "outbound", freeTrialCompleteImage, null);
    await waUsersMetadataRepository.update(profileId, userMobileNumber, {
        userRegistrationComplete: new Date()
    });
    return;
};


const readyToPay = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Ready to Pay");
    let readyToPayMessage = "If you are ready to pay, a beaj team member will call you within 24 hrs to confirm your registration.\nاگر آپ فیس ادا کرنے کے لیے تیار ہیں، تو بیج ٹیم کا نمائندہ آپ سے 24 گھنٹوں کے اندر رابطہ کر کے آپ کی رجسٹریشن مکمل کرے گا.";
    await sendButtonMessage(userMobileNumber, readyToPayMessage, [{ id: 'ready_to_register', title: 'Ready to Register 📞' }, { id: 'get_another_trial', title: 'Get Another Trial' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", readyToPayMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["ready to register", "get another trial"]);
    return;
};

const thankyouMessageParent = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Thankyou Message");
    await waUserProgressRepository.update(profileId, userMobileNumber, null, null, null, null, null, null, null, null, ["get another trial"]);
    let thankyouMessage = "Thank You! We are excited to speak to you soon!\nشکریہ! ہم آپ سے بات کرنے کے منتظر ہیں۔";
    await sendButtonMessage(userMobileNumber, thankyouMessage, [{ id: 'get_another_trial', title: 'Get Another Trial' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", thankyouMessage, null);
    await waUsersMetadataRepository.update(profileId, userMobileNumber, {
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
};