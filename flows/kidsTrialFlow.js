import waUsersMetadataRepository from "../repositories/waUsersMetadataRepository.js";
import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waPurchasedCoursesRepository from "../repositories/waPurchasedCoursesRepository.js";
import waProfileRepository from "../repositories/waProfileRepository.js";
import waActiveSessionRepository from "../repositories/waActiveSessionRepository.js";
import courseRepository from "../repositories/courseRepository.js";
import { sendButtonMessage, sendMessage, sendMediaMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import courses from "../constants/courses.js";
import { sleep } from "../utils/utils.js";
import waUserActivityLogsRepository from "../repositories/waUserActivityLogsRepository.js";
import * as imageGenerationUtils from "../utils/imageGenerationUtils.js";
import waConstantsRepository from "../repositories/waConstantsRepository.js";
import dotenv from 'dotenv';
dotenv.config();

const greetingMessageKids = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.create({
        profile_id: profileId,
        phoneNumber: userMobileNumber,
        engagement_type: "Greeting Message",
        lastUpdated: new Date(),
    });
    let greetingMessageText = "";
    greetingMessageText = `Welcome to Beaj Education! 👋\n\nبیج ایجوکیشن میں خوش آمدید!\n\n`;

    let userRegistrationComplete = false;
    const user = await waUsersMetadataRepository.getByProfileId(profileId);
    if (user.dataValues.userRegistrationComplete) {
        userRegistrationComplete = true;
    }

    await sendMessage(userMobileNumber, greetingMessageText);
    await createActivityLog(userMobileNumber, "text", "outbound", greetingMessageText, null);
    const combined_flyer = await waConstantsRepository.getByKey("COMBINED_FLYER");
    const urdu_flyer = await waConstantsRepository.getByKey("URDU_FLYER");
    const first_message = await waUserActivityLogsRepository.getStudentCoursePriceByFirstMessage(userMobileNumber);
    let flyer = null;
    if (first_message == 750) {
        flyer = urdu_flyer;
    } else {
        flyer = combined_flyer;
    }
    if (flyer) {
        await sendMediaMessage(userMobileNumber, flyer.dataValues.constantValue, "image", null, 0, "WA_Constants", flyer.dataValues.id, flyer.dataValues.constantMediaId, "constantMediaId");
        await sleep(2000);
    }
    let videoCaption = "Why should you choose Beaj Education? Here is a message from our founder.\n\nآپ کو بیج ایجوکیشن کیوں چُننا چاہیے؟ — بیج ایجوکیشن کی سربراہ کا پیغام۔";
    let whyBeaj = await waConstantsRepository.getByKey("WHY_BEAJ");
    if (whyBeaj) {
        if (userRegistrationComplete) {
            await sendButtonMessage(userMobileNumber, videoCaption, [{ id: 'start_free_trial', title: 'Start Free Trial' }], 0, null, whyBeaj.dataValues.constantValue, "WA_Constants", whyBeaj.dataValues.id, null, whyBeaj.dataValues.constantMediaId, "constantMediaId");
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start free trial", "chat with beaj rep"]);
        } else {
            await sendButtonMessage(userMobileNumber, videoCaption, [{ id: 'start_free_trial', title: 'Start Free Trial' }, { id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }], 0, null, whyBeaj.dataValues.constantValue, "WA_Constants", whyBeaj.dataValues.id, null, whyBeaj.dataValues.constantMediaId, "constantMediaId");
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start free trial", "chat with beaj rep"]);
        }
    }
    await createActivityLog(userMobileNumber, "template", "outbound", videoCaption, null);

    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Greeting Message - Kids");
};

const startOfFlow = async (profileId, userMobileNumber) => {
    let userRegistrationComplete = false;
    const user = await waUsersMetadataRepository.getByProfileId(profileId);
    if (user.dataValues.userRegistrationComplete) {
        userRegistrationComplete = true;
    }
    let greetingMessageText = `Welcome to Beaj Education! 👋\n\nبیج ایجوکیشن میں خوش آمدید!\n\n`;
    await sendMessage(userMobileNumber, greetingMessageText);
    await createActivityLog(userMobileNumber, "text", "outbound", greetingMessageText, null);
    let videoCaption = "Why should you choose Beaj Education? Here is a message from our founder.\n\nآپ کو بیج ایجوکیشن کیوں چُننا چاہیے؟ — بیج ایجوکیشن کی سربراہ کا پیغام۔";
    let whyBeaj = await waConstantsRepository.getByKey("WHY_BEAJ");
    if (whyBeaj) {
        if (userRegistrationComplete) {
            await sendButtonMessage(userMobileNumber, videoCaption, [{ id: 'start_free_trial', title: 'Start Free Trial' }], 0, null, whyBeaj.dataValues.constantValue, "WA_Constants", whyBeaj.dataValues.id, null, whyBeaj.dataValues.constantMediaId, "constantMediaId");
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start free trial"]);
        } else {
            await sendButtonMessage(userMobileNumber, videoCaption, [{ id: 'start_free_trial', title: 'Start Free Trial' }], 0, null, whyBeaj.dataValues.constantValue, "WA_Constants", whyBeaj.dataValues.id, null, whyBeaj.dataValues.constantMediaId, "constantMediaId");
            await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["start free trial"]);
        }
    }
    await createActivityLog(userMobileNumber, "template", "outbound", videoCaption, null);
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Greeting Message - Kids");
};

const confirmCancelRegistration = async (profileId, userMobileNumber, engagementType) => {
    const cancelRegistrationConfirmationAudio = await waConstantsRepository.getByKey("CANCEL_REGISTRATION_CONFIRMATION_AUDIO");
    if (cancelRegistrationConfirmationAudio) {
        await sendMediaMessage(userMobileNumber, cancelRegistrationConfirmationAudio.dataValues.constantValue, "audio", null, 0, "WA_Constants", cancelRegistrationConfirmationAudio.dataValues.id, cancelRegistrationConfirmationAudio.dataValues.constantMediaId, "constantMediaId");
        await sleep(2000);
    }
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Cancel Registration Confirmation - " + engagementType);
    const confirmCancelRegistrationMessage = "Are you sure you want to cancel this registration?\n\nکیا آپ اس رجسٹریشن کو ختم کرنا چاہتے ہیں؟";
    await sendButtonMessage(userMobileNumber, confirmCancelRegistrationMessage, [{ id: 'yes', title: 'Yes' }, { id: 'no', title: 'No' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", confirmCancelRegistrationMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["yes", "no"]);
};

const cancelRegistration = async (profileId, userMobileNumber) => {
    /*
    Scenarios:
    1) When does it happen: After completing information as a parent (Message content: Start Again)
        What to do: Send to start of the flow and preserve the data for the user and the persona will be selected as parent and user can come back and register another student
 
    2) When does it happen: After sending bank details (Message content: Start Again)
        What to do: Send to start of the flow and preserve the data for the user and the persona will be selected as parent and user can come back and register another student
    */

    // Clear all data taken during the registration flow and set at greeting stage
    // Get all profile ids for the user from the wa_metadata table and then also get all the profile ids from the wa_purchased_courses table
    // If an id is in metadata but not in purchased courses, then delete the user from metadata

    const profileIds = await waUsersMetadataRepository.getProfileIds(userMobileNumber);
    const purchasedCourses = await waPurchasedCoursesRepository.getPurchasedCoursesByPhoneNumber(userMobileNumber);
    const profileIdsInPurchasedCourses = purchasedCourses.map(course => course.profile_id);
    const profileIdsToDelete = profileIds.filter(id => !profileIdsInPurchasedCourses.includes(id));
    for (const id of profileIdsToDelete) {
        if (id === profileId) {
            continue;
        }
        await waUsersMetadataRepository.deleteByProfileId(id);
        await waUserProgressRepository.deleteByProfileId(id);
        await waProfileRepository.deleteByProfileId(id);
        await waActiveSessionRepository.deleteByProfileId(id);
    }


    await waUsersMetadataRepository.updateName(profileId, userMobileNumber, null);
    await waUsersMetadataRepository.updateCityName(profileId, userMobileNumber, null);
    await waUsersMetadataRepository.updateClassLevel(profileId, userMobileNumber, null);
    await waUsersMetadataRepository.update(profileId, userMobileNumber, {
        userRegistrationComplete: null
    });


    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Greeting Message - Kids");
    await startOfFlow(profileId, userMobileNumber);
};

const singleStudentRegistationComplate = async (profileId, userMobileNumber) => {
    const registerAnotherStudentAudio = await waConstantsRepository.getByKey("REGISTER_ANOTHER_AUDIO");
    if (registerAnotherStudentAudio) {
        await sendMediaMessage(userMobileNumber, registerAnotherStudentAudio.dataValues.constantValue, "audio", null, 0, "WA_Constants", registerAnotherStudentAudio.dataValues.id, registerAnotherStudentAudio.dataValues.constantMediaId, "constantMediaId");
        await sleep(2000);
    }
    await waUsersMetadataRepository.update(profileId, userMobileNumber, { userRegistrationComplete: new Date() });
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Single Student Registration Complete");
    const user = await waUsersMetadataRepository.getByProfileId(profileId);
    const name = user.dataValues.name;
    const registrationsSummary = await waUsersMetadataRepository.getTotalRegistrationsSummary(userMobileNumber);
    const totalRegistrations = registrationsSummary.count;
    const registrationsList = registrationsSummary.registrations.map((reg, index) =>
        `${index + 1}) ${reg.name} - ${reg.classLevel}`
    ).join('\n');
    const singleStudentRegistrationCompleteMessage =
        name + "'s information is now complete! 🎉" +
        "\n\u202B" + name + " کی معلومات مکمل ہو چکی ہے!" + "\u202C" +
        "\n\n\n👉 Do you want to register another student?" +
        "\nکیا آپ کسی اور سٹوڈنٹ کا اندراج کرنا چاہتے ہیں؟\u202C";

    await sendMessage(userMobileNumber, singleStudentRegistrationCompleteMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", singleStudentRegistrationCompleteMessage, null);

    const totalRegistrationsSummaryMessage =
        "\n\n\nNumber of students registered for Beaj Student Summer Camp: " + totalRegistrations +
        "\n" + registrationsList +
        "\n\n\nبیج سمر کیمپ کے لئے کل رجسٹریشنز کی تعداد: " + totalRegistrations +
        "\n" + registrationsList;
    await sendButtonMessage(userMobileNumber, totalRegistrationsSummaryMessage, [{ id: 'go_to_payment', title: 'Go to Payment' }, { id: 'start_again', title: 'Start Again' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", totalRegistrationsSummaryMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["go to payment", "start again"]);
};

const getTotalRegistrationsSummaryForUnpaidUsers = async (userMobileNumber) => {
    const registrationsSummary = await waUsersMetadataRepository.getTotalRegistrationsSummary(userMobileNumber);
    const purchasedCourses = await waPurchasedCoursesRepository.getPurchasedCoursesByPhoneNumber(userMobileNumber);
    registrationsSummary.count = registrationsSummary.count - purchasedCourses.length;
    registrationsSummary.registrations = registrationsSummary.registrations.filter(reg => !purchasedCourses.some(course => course.profile_id === reg.profile_id));
    return registrationsSummary;
};

const paymentDetails = async (profileId, userMobileNumber) => {
    const invoiceAudio = await waConstantsRepository.getByKey("INVOICE_AUDIO");
    if (invoiceAudio) {
        await sendMediaMessage(userMobileNumber, invoiceAudio.dataValues.constantValue, "audio", null, 0, "WA_Constants", invoiceAudio.dataValues.id, invoiceAudio.dataValues.constantMediaId, "constantMediaId");
        await sleep(2000);
    }
    const registrationsSummary = await getTotalRegistrationsSummaryForUnpaidUsers(userMobileNumber);
    const totalRegistrations = registrationsSummary.count;
    let perCoursePrice = await waUserActivityLogsRepository.getStudentCoursePriceByFirstMessage(userMobileNumber);
    if (totalRegistrations > 1 && perCoursePrice == 1500) {
        perCoursePrice = 1200;
    }
    const totalPrice = totalRegistrations * perCoursePrice;
    const invoiceImageUrl = await imageGenerationUtils.generateInvoiceImage(userMobileNumber, registrationsSummary);
    await sendMediaMessage(userMobileNumber, invoiceImageUrl, "image");
    await createActivityLog(userMobileNumber, "image", "outbound", invoiceImageUrl, null);
    await sleep(2000);
    let bankAccountDetails =
        "To *complete* your registration, please make a payment of Rs. " + totalPrice + " to our bank account." +
        "\n\n*Beaj Bank Account details:*\n" +
        "Account Name: Beaj Education Pvt Ltd\n" +
        "Bank Name: Bank Al Falah\n" +
        "Account Number: 04041007987401\n\n" +
        "\u202Bاپنی رجسٹریشن کی *تصدیق* کے لئے، " + totalPrice + " روپے ہماری بینک اکاؤنٹ میں جمع کروائیں۔\n\n" +
        "*بیج بینک اکاؤنٹ کی تفصیلات:*\n" +
        "اکاؤنٹ کا نام: بیج ایجوکیشن پرائیویٹ لمیٹڈ\n" +
        "بینک کا نام: بینک الفلاح\n" +
        "اکاؤنٹ نمبر: 04041007987401\u202C";
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Payment Details");
    await sendButtonMessage(userMobileNumber, bankAccountDetails, [{ id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }, { id: 'start_again', title: 'Start Again' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", bankAccountDetails, null);
    let screenshotMessage = "👉 *Please send us a screenshot of your payment.* \n\n" +
        "\u202B👈 *اپنی ادائیگی کا اسکرین شاٹ ہمیں بھیجیں۔*\u202C";
    await sendMessage(userMobileNumber, screenshotMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", screenshotMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["image", "chat with beaj rep", "start again"]);
};

const kidsChooseClass = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Choose Class");
    const chooseClassMessage = `Take a look inside the course!\nکورس کی ایک جھلک دیکھیں۔\n\n👇Choose your class:\nاپنی کلاس منتخب کریں۔`;
    let summerIntroVideo = await waConstantsRepository.getByKey("SUMMER_INTRO_VIDEO");
    if (summerIntroVideo) {
        await sendButtonMessage(userMobileNumber, chooseClassMessage, [{ id: 'kids_summer_camp_class_1_or_2', title: 'Class 1 or 2' }, { id: 'kids_summer_camp_class_5_or_6', title: 'Class 3 to 6' }], 0, null, summerIntroVideo.dataValues.constantValue, "WA_Constants", summerIntroVideo.dataValues.id, null, summerIntroVideo.dataValues.constantMediaId, "constantMediaId");
        await createActivityLog(userMobileNumber, "template", "outbound", chooseClassMessage, null);
    }
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["class 1 or 2", "class 3 to 6"]);
};

const kidsChooseClassLoop = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Choose Class");
    const chooseClassMessage = "👇Choose your class:\nکلاس منتخب کریں:";
    await sendButtonMessage(userMobileNumber, chooseClassMessage, [{ id: 'kids_summer_camp_class_1_or_2', title: 'Class 1 or 2' }, { id: 'kids_summer_camp_class_5_or_6', title: 'Class 3 to 6' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", chooseClassMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["class 1 or 2", "class 3 to 6"]);
};

const getUserProfile = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "User Profile");
    const userProfileMessage = "Are you a parent/student or school admin?\n\nکیا آپ والدین/سٹوڈنٹ ہیں یا اسکول چلاتے ہیں؟";
    await sendButtonMessage(userMobileNumber, userProfileMessage, [{ id: 'parent_student', title: 'Parent or Student' }, { id: 'school_admin', title: 'School Admin' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", userProfileMessage, null);
    await waUserProgressRepository.update(profileId, userMobileNumber, null, null, null, null, null, null, null, null, ["parent or student", "school admin"]);
};

const schoolAdminConfirmation = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "School Admin Confirmation");
    const schoolAdminConfirmationAudio = await waConstantsRepository.getByKey("SCHOOL_ADMIN_CONFIRMATION_AUDIO");
    if (schoolAdminConfirmationAudio) {
        await sendMediaMessage(userMobileNumber, schoolAdminConfirmationAudio.dataValues.constantValue, "audio", null, 0, "WA_Constants", schoolAdminConfirmationAudio.dataValues.id, schoolAdminConfirmationAudio.dataValues.constantMediaId, "constantMediaId");
        await sleep(2000);
    }
    let selectOptionMessage = "👆Listen to the audio instructions and select an option:\n\n:آڈیو ہدایات سنیں اور ایک آپشن منتخب کریں";
    await sendButtonMessage(userMobileNumber, selectOptionMessage, [{ id: 'school_admin', title: 'School Admin' }, { id: 'parent_or_student', title: 'Parent or Student' }, { id: 'start_again', title: 'Start Again' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", selectOptionMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["parent or student", "school admin", "start again"]);
};

const getSchoolName = async (profileId, userMobileNumber) => {
    let prospectusPdf = await waConstantsRepository.getByKey("SUMMER_CAMP_PROSPECTUS_PDF");
    if (prospectusPdf) {
        await sendMediaMessage(userMobileNumber, prospectusPdf.dataValues.constantValue, "pdf", "Summer Camp Prospectus for Schools", 0, "WA_Constants", prospectusPdf.dataValues.id, prospectusPdf.dataValues.constantMediaId, "constantMediaId");
        await sleep(5000);
    }
    await waUserProgressRepository.updatePersona(profileId, userMobileNumber, "school admin");
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "School Name");
    const schoolInputMessage = "Please type your school's name:";
    await sendMessage(userMobileNumber, schoolInputMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", schoolInputMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["text"]);
};

const parentOrStudentSelection = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Parent or Student");
    await waUserProgressRepository.updatePersona(profileId, userMobileNumber, "parent or student");
    const combined_flyer = await waConstantsRepository.getByKey("COMBINED_FLYER");
    const urdu_flyer = await waConstantsRepository.getByKey("URDU_FLYER");
    const first_message = await waUserActivityLogsRepository.getStudentCoursePriceByFirstMessage(userMobileNumber);
    let flyer = null;
    if (first_message == 750) {
        flyer = urdu_flyer;
    } else {
        flyer = combined_flyer;
    }
    if (flyer) {
        await sendMediaMessage(userMobileNumber, flyer.dataValues.constantValue, "image", null, 0, "WA_Constants", flyer.dataValues.id, flyer.dataValues.constantMediaId, "constantMediaId");
        await sleep(1000);
    }
    const introAudio = await waConstantsRepository.getByKey("REGISTRATION_INTRO_AUDIO");
    if (introAudio) {
        await sendMediaMessage(userMobileNumber, introAudio.dataValues.constantValue, "audio", null, 0, "WA_Constants", introAudio.dataValues.id, introAudio.dataValues.constantMediaId, "constantMediaId");
        await sleep(2000);
    }
    let selectOptionMessage = "👆Listen to the audio instructions and select an option:\n\nآڈیو میں دی گئی ہدایت سنیں اور ایک آپشن پہ کلک کریں:";
    await sendButtonMessage(userMobileNumber, selectOptionMessage, [{ id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }, { id: 'start_again', title: 'Start Again' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", selectOptionMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["chat with beaj rep", "start again"]);
};

const confirmSchoolName = async (profileId, userMobileNumber, messageContent) => {
    await waUsersMetadataRepository.updateSchoolName(profileId, userMobileNumber, messageContent);
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Confirm School Name");
    const confirmSchoolNameMessage = "Please confirm your school's name: " + messageContent;
    await sendButtonMessage(userMobileNumber, confirmSchoolNameMessage, [{ id: 'yes', title: 'Yes' }, { id: 'no', title: 'No' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", confirmSchoolNameMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["yes", "no"]);
};

const getCityName = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "City Name");
    const cityInputMessage = "Please type your city's name:";
    await sendMessage(userMobileNumber, cityInputMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", cityInputMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["text"]);
};

const thankyouMessageSchoolOwner = async (profileId, userMobileNumber, messageContent) => {
    await waUsersMetadataRepository.updateCityName(profileId, userMobileNumber, messageContent);
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Thankyou Message - School Owner");
    await waUserProgressRepository.update(profileId, userMobileNumber, null, null, null, null, null, null, null, null, ["go to start", "chat with beaj rep"]);
    const schoolRegistrationImage = await waConstantsRepository.getByKey("SCHOOL_REGISTRATION_IMAGE");
    if (schoolRegistrationImage) {
        let thankyouMessage = "📳 A Beaj team member will call you within 24 hours to discuss a partnership with your school!\nWe look forward to speaking with you soon!\nاگلے 24 گھنٹے میں بیج ٹیم کا نمائندہ آپ سے اسکول پارٹنرشپ کے لئے رابطہ کرے گا۔ ہم آپ سے بات کرنے کے منتظر ہیں! \n\nIn the meantime, if you have any questions, please click on 'Chat with Beaj Rep' to talk to our team.\nاس دوران اگر آپ کے کوئ سوال ہیں، تو ‘Chat with Beaj Rep’ پر کلک کیجیئے اور ہم سے رابطہ کریں۔";
        await sendButtonMessage(userMobileNumber, thankyouMessage, [{ id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }, { id: 'go_to_start', title: 'Go to Start' }], 0, schoolRegistrationImage.dataValues.constantValue, null, "WA_Constants", schoolRegistrationImage.dataValues.id, schoolRegistrationImage.dataValues.constantMediaId, null, "constantMediaId");
        await createActivityLog(userMobileNumber, "image", "outbound", schoolRegistrationImage.dataValues.constantValue, null);
    }
    await waUsersMetadataRepository.update(profileId, userMobileNumber, { userRegistrationComplete: new Date() });
};

const thankyouMessageParent = async (profileId, userMobileNumber) => {
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Thankyou Message - Parent");
    await waUserProgressRepository.update(profileId, userMobileNumber, null, null, null, null, null, null, null, null, ["get another trial"]);
    const parentThankyouImage = await waConstantsRepository.getByKey("PARENT_REGISTRATION");
    if (parentThankyouImage) {
        let thankyouMessage = `📳 Thank You!\n\nA Beaj Rep will call you within the next 24 hours to confirm your registration.\nWe are excited to speak to you soon!\nشکریہ!\n\nبیج ٹیم کا نمائندہ آپ سے 24 گھنٹوں کے اندر رابطہ کر کے آپ کی رجسٹریشن مکمل کرے گا.\nہم آپ سے بات کرنے کے منتظر ہی`;
        await sendButtonMessage(userMobileNumber, thankyouMessage, [{ id: 'get_another_trial', title: 'Get Another Trial' }], 0, parentThankyouImage.dataValues.constantValue, null, "WA_Constants", parentThankyouImage.dataValues.id, parentThankyouImage.dataValues.constantMediaId, null, "constantMediaId");
        await createActivityLog(userMobileNumber, "image", "outbound", parentThankyouImage.dataValues.constantValue, null);
    }
    await waUsersMetadataRepository.update(profileId, userMobileNumber, { userRegistrationComplete: new Date() });
};

const registerNewStudent = async (profileId, userMobileNumber) => {
    const profile_type = "student";
    let botPhoneNumberId = process.env.STUDENT_BOT_PHONE_NUMBER_ID;
    let profile = await waProfileRepository.create({ phone_number: userMobileNumber, bot_phone_number_id: botPhoneNumberId, profile_type: profile_type });
    profileId = profile.dataValues.profile_id;
    await waUsersMetadataRepository.create({ profile_id: profileId, phoneNumber: userMobileNumber, userClickedLink: new Date() });
    await waActiveSessionRepository.updateCurrentProfileIdOnPhoneNumber(userMobileNumber, profileId, botPhoneNumberId);
    await waUserProgressRepository.create({ profile_id: profileId, phoneNumber: userMobileNumber, engagement_type: "Greeting Message", lastUpdated: new Date(), persona: "parent or student" });
    await studentNameInput(profileId, userMobileNumber);
    return;
};

const studentNameInput = async (profileId, userMobileNumber) => {
    const typeNameAudio = await waConstantsRepository.getByKey("TYPE_NAME_AUDIO");
    if (typeNameAudio) {
        await sendMediaMessage(userMobileNumber, typeNameAudio.dataValues.constantValue, "audio", null, 0, "WA_Constants", typeNameAudio.dataValues.id, typeNameAudio.dataValues.constantMediaId, "constantMediaId");
        await sleep(2000);
    }
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Student Name Input");
    const studentNameInputMessage = "Please type student's *Full Name*\n\nسٹوڈنٹ کا پورا نام لکھیں۔";
    await sendMessage(userMobileNumber, studentNameInputMessage);
    await createActivityLog(userMobileNumber, "text", "outbound", studentNameInputMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["text"]);
};

const studentNameConfirmation = async (profileId, userMobileNumber, messageContent) => {
    await waUsersMetadataRepository.updateName(profileId, userMobileNumber, messageContent);
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Student Name Confirmation");
    const studentNameConfirmationMessage = "Confirm name: " + messageContent + "\n\nنام کنفرم کریں: " + messageContent;
    await sendButtonMessage(userMobileNumber, studentNameConfirmationMessage, [{ id: 'yes', title: 'Yes' }, { id: 'no', title: 'No' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", studentNameConfirmationMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["yes", "no"]);
};

const studentGenericClassInput = async (profileId, userMobileNumber) => {
    const genericClassAudio = await waConstantsRepository.getByKey("CHOOSE_CLASS_AUDIO");
    if (genericClassAudio) {
        await sendMediaMessage(userMobileNumber, genericClassAudio.dataValues.constantValue, "audio", null, 0, "WA_Constants", genericClassAudio.dataValues.id, genericClassAudio.dataValues.constantMediaId, "constantMediaId");
        await sleep(2000);
    }
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Student Generic Class Input");
    const studentClassInputMessage = "Please select student's *class level*:\n\nسٹوڈنٹ کی *کلاس* منتخب کریں۔";
    await sendButtonMessage(userMobileNumber, studentClassInputMessage, [{ id: 'class_1_or_2_or_3', title: 'Class 1, 2 or 3' }, { id: 'class_4_or_5_or_6', title: 'Class 4, 5 or 6' }, { id: 'class_7_and_above', title: 'Class 7 and above' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", studentClassInputMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["class 1, 2 or 3", "class 4, 5 or 6", "class 7 and above"]);
};

const studentGenericClassConfirmation = async (profileId, userMobileNumber, messageContent) => {
    await waUsersMetadataRepository.updateClassLevel(profileId, userMobileNumber, messageContent);
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Student Generic Class Confirmation");
    const studentClassConfirmationMessage = "Confirm class level: " + messageContent + "\n\nکلاس لیول کنفرم کریں: " + messageContent;
    await sendButtonMessage(userMobileNumber, studentClassConfirmationMessage, [{ id: 'yes', title: 'Yes' }, { id: 'no', title: 'No' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", studentClassConfirmationMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["yes", "no"]);
};

const studentSpecificClassInput = async (profileId, userMobileNumber) => {
    const genericClass = await waUsersMetadataRepository.getClassLevel(profileId, userMobileNumber);
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Student Specific Class Input");
    const studentClassInputMessage = "Please select student's *class*:\n\nسٹوڈنٹ کی *کلاس* منتخب کریں۔";
    if (genericClass.toLowerCase() == "class 1, 2 or 3") {
        await sendButtonMessage(userMobileNumber, studentClassInputMessage, [{ id: 'class_1', title: 'Class 1' }, { id: 'class_2', title: 'Class 2' }, { id: 'class_3', title: 'Class 3' }]);
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["class 1", "class 2", "class 3"]);
    } else if (genericClass.toLowerCase() == "class 4, 5 or 6") {
        await sendButtonMessage(userMobileNumber, studentClassInputMessage, [{ id: 'class_4', title: 'Class 4' }, { id: 'class_5', title: 'Class 5' }, { id: 'class_6', title: 'Class 6' }]);
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["class 4", "class 5", "class 6"]);
    } else if (genericClass.toLowerCase() == "class 7 and above") {
        await sendButtonMessage(userMobileNumber, studentClassInputMessage, [{ id: 'class_7', title: 'Class 7' }]);
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["class 7"]);
    }
    await createActivityLog(userMobileNumber, "template", "outbound", studentClassInputMessage, null);
};

const studentSpecificClassConfirmation = async (profileId, userMobileNumber, messageContent) => {
    await waUsersMetadataRepository.updateClassLevel(profileId, userMobileNumber, messageContent);
    await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Student Specific Class Confirmation");
    const studentClassConfirmationMessage = "Confirm student's class: " + messageContent + "\n\nسٹوڈنٹ کی کلاس کنفرم کریں: " + messageContent;
    await sendButtonMessage(userMobileNumber, studentClassConfirmationMessage, [{ id: 'yes', title: 'Yes' }, { id: 'no', title: 'No' }]);
    await createActivityLog(userMobileNumber, "template", "outbound", studentClassConfirmationMessage, null);
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["yes", "no"]);
};

const paymentComplete = async (profileId, userMobileNumber, paymentProof, messageType) => {
    if (messageType != "image") {
        await sendButtonMessage(userMobileNumber, "Please send us a screenshot of your payment or click on Chat with Beaj Rep to talk to us.", [{ id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }]);
        return;
    }
    const registrationsSummary = await waUsersMetadataRepository.getTotalRegistrationsSummary(userMobileNumber);
    const users = registrationsSummary.registrations;
    for (const user of users) {
        const userPhoneNumber = user.dataValues.phoneNumber;
        const userProfileId = user.dataValues.profile_id;
        const userPurchasedCourses = await waPurchasedCoursesRepository.getPurchasedCoursesByProfileId(userProfileId);
        if (userPurchasedCourses.length > 0) {
            continue;
        }
        let userClassLevel = user.dataValues.classLevel;
        if (userClassLevel.toLowerCase() == "class 7 and above") {
            userClassLevel = "class 7";
        }
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
    const parentThankyouImage = await waConstantsRepository.getByKey("PARENT_REGISTRATION");
    if (parentThankyouImage) {
        let thankYouMessage =
            "📳 Thank You! A member from the Beaj Team will call you to confirm your payment and add you to your Summer Camp class!" +
            "\n\nIf you have any additional questions, please click on Chat with Beaj Rep to talk to us." +
            "\n\nشکریہ! بیج ٹیم کا ایک رکن آپ کو آپ کی ادائیگی کی تصدیق کے لئے کال کرے گا اور آپ کو آپ کی سمر کیمپ کلاس میں شامل کرے گا۔" +
            "\n\nاگر آپ کے پاس کوئی اضافی سوالات ہیں، تو 'بیج ریپ کے ساتھ چیٹ کریں' پر کلک کریں۔";
        await waUserProgressRepository.updateEngagementType(profileId, userMobileNumber, "Payment Complete");
        await sendButtonMessage(userMobileNumber, thankYouMessage, [{ id: 'chat_with_beaj_rep', title: 'Chat with Beaj Rep' }, { id: 'go_to_start', title: 'Go to Start' }], 0, parentThankyouImage.dataValues.constantValue, null, "WA_Constants", parentThankyouImage.dataValues.id, parentThankyouImage.dataValues.constantMediaId, null, "constantMediaId");
        await createActivityLog(userMobileNumber, "template", "outbound", thankYouMessage, null);
    }
    await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["chat with beaj rep", "go to start"]);
};

const kidsTrialFlowDriver = async (profileId, userMobileNumber, engagementType, messageContent, messageType, inboundUploadedImage) => {
    const endpointHandlers = [
        // REGISTRATION ENDPOINTS
        {
            engagementTypes: ["New User"],
            messages: ["*"],
            handler: () => greetingMessageKids(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["School Admin Confirmation", "Parent or Student", "Thankyou Message - School Owner", "Payment Complete"],
            messages: ["start again", "go to start"],
            handler: () => startOfFlow(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Single Student Registration Complete", "Payment Details"],
            messages: ["start again"],
            handler: () => confirmCancelRegistration(profileId, userMobileNumber, engagementType)
        },
        {
            engagementTypes: ["Cancel Registration Confirmation - Single Student Registration Complete", "Cancel Registration Confirmation - Payment Details"],
            messages: ["yes"],
            handler: () => cancelRegistration(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Cancel Registration Confirmation - Single Student Registration Complete"],
            messages: ["no"],
            handler: () => singleStudentRegistationComplate(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Cancel Registration Confirmation - Payment Details"],
            messages: ["no"],
            handler: () => paymentDetails(profileId, userMobileNumber)
        },
        // REGISTRATION START ENDPOINTS
        {
            engagementTypes: ["User Profile"],
            messages: ["parent or student"],
            handler: () => parentOrStudentSelection(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["User Profile"],
            messages: ["school admin"],
            handler: () => schoolAdminConfirmation(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["School Admin Confirmation"],
            messages: ["school admin"],
            handler: () => getSchoolName(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["School Admin Confirmation"],
            messages: ["parent or student"],
            handler: () => parentOrStudentSelection(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["School Name"],
            messages: ["*"],
            handler: () => confirmSchoolName(profileId, userMobileNumber, messageContent)
        },
        {
            engagementTypes: ["Confirm School Name"],
            messages: ["yes"],
            handler: () => getCityName(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Confirm School Name"],
            messages: ["no"],
            handler: () => getSchoolName(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["City Name", "Confirm City Name"],
            messages: ["*"],
            handler: () => thankyouMessageSchoolOwner(profileId, userMobileNumber, messageContent)
        },
        {
            engagementTypes: ["Confirm City Name"],
            messages: ["no"],
            handler: () => getCityName(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Ready to Pay"],
            messages: ["ready for payment", "ready to register"],
            handler: () => thankyouMessageParent(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Student Name Input"],
            messages: ["*"],
            handler: () => studentNameConfirmation(profileId, userMobileNumber, messageContent)
        },
        {
            engagementTypes: ["Student Name Confirmation"],
            messages: ["no", "no, type again"],
            handler: () => studentNameInput(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Student Name Confirmation"],
            messages: ["yes"],
            handler: () => studentGenericClassInput(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Student Generic Class Input"],
            messages: ["class 1, 2 or 3", "class 4, 5 or 6"],
            handler: () => studentGenericClassConfirmation(profileId, userMobileNumber, messageContent)
        },
        {
            engagementTypes: ["Student Generic Class Input"],
            messages: ["class 7 and above"],
            handler: () => studentSpecificClassConfirmation(profileId, userMobileNumber, messageContent)
        },
        {
            engagementTypes: ["Student Generic Class Confirmation"],
            messages: ["no", "no, choose again"],
            handler: () => studentGenericClassInput(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Student Generic Class Confirmation"],
            messages: ["yes"],
            handler: () => studentSpecificClassInput(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Student Specific Class Input"],
            messages: ["class 1", "class 2", "class 3", "class 4", "class 5", "class 6", "class 7 and above"],
            handler: () => studentSpecificClassConfirmation(profileId, userMobileNumber, messageContent)
        },
        {
            engagementTypes: ["Student Specific Class Confirmation"],
            messages: ["no", "no, choose again"],
            handler: () => studentSpecificClassInput(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Student Specific Class Confirmation"],
            messages: ["yes"],
            handler: () => singleStudentRegistationComplate(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Single Student Registration Complete"],
            messages: ["go to payment"],
            handler: () => paymentDetails(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Single Student Registration Complete"],
            messages: ["register new student"],
            handler: () => registerNewStudent(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Payment Details"],
            handler: () => paymentComplete(profileId, userMobileNumber, inboundUploadedImage, messageType)
        },
        // DEMO COURSE ENDPOINTS
        {
            engagementTypes: ["Greeting Message", "Greeting Message - Kids"],
            messages: ["start", "start free trial"],
            handler: () => kidsChooseClass(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Confirm Class - Level 1", "Confirm Class - Level 3"],
            messages: ["no, choose again"],
            handler: () => kidsChooseClassLoop(profileId, userMobileNumber, messageContent)
        },
        {
            engagementTypes: ["Free Trial - Kids - Level 1", "Free Trial - Kids - Level 3", "Greeting Message - Kids", "Choose Class"],
            messages: ["end now", "go to registration", "register now", "skip trial"],
            handler: () => getUserProfile(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Free Trial - Kids - Level 1", "Free Trial - Kids - Level 3", "End Now", "Greeting Message - Kids"],
            messages: ["register", "camp registration", "go to registration", "register now"],
            handler: () => getUserProfile(profileId, userMobileNumber)
        },
        // KEEP BELOW TWO TOGETHER IN SAME ORDER
        {
            engagementTypes: ["Free Trial - Kids - Level 1", "Free Trial - Kids - Level 3", "End Now", "Thankyou Message - Parent", "Thankyou Message - School Owner", "Thankyou Message"],
            messages: ["get another trial"],
            handler: () => kidsChooseClassLoop(profileId, userMobileNumber)
        },
        {
            engagementTypes: ["Thankyou Message - Parent", "Thankyou Message - School Owner", "Thankyou Message"],
            messages: ["*"],
            handler: () => sendMessage(userMobileNumber, "Your free trial is complete. We will get back to you soon.")
        },
    ];

    let matchedHandler = null;

    if (messageContent && messageType) {
        for (const config of endpointHandlers) {
            if (!config.engagementTypes.includes(engagementType)) continue;

            if (config.messages.includes(messageContent.toLowerCase()) || config.messages.includes('*')) {
                matchedHandler = config.handler;
                break;
            }
        }
    } else {
        for (const config of endpointHandlers) {
            if (config.engagementTypes.includes(engagementType)) {
                matchedHandler = config.handler;
                break;
            }
        }
    }

    if (matchedHandler) {
        await matchedHandler();
        return true;
    }

    return true;
};


export default { kidsTrialFlowDriver };