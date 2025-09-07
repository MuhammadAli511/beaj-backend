const activity_types_to_repeat = [
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
    "feedbackAudio",
    "feedbackMcqs",
    "assessmentMcqs",
    "assessmentWatchAndSpeak",
];

const text_message_types = ["text", "interactive", "button"];

const special_commands = ["reset all", "reset course"];

const talk_to_beaj_rep_messages = [
    "talk to beaj rep",
    "chat with beaj rep",
    "get help",
];

const beaj_team_numbers = [
    "+923008400080",
    "+923303418882",
    "+923345520552",
    "+923225036358",
    "+923365560202",
    "+923170729640",
    "+923328251950",
    "+923225812411",
    "+923390001510",
    "+923288954660",
    "+923704558660",
    "+923012232148",
    "+923331432681",
    "+923196609478",
    "+923151076203",
    "+923222731870",
    "+923475363220",
    "+923009546982",
    "+923349279631",
    "+923352373288",
    "+923231911848",
    "+923325551465",
    "+261320220186",
    "+12028123335",
    "+923232658153",
];

const feedback_acceptable_messages = [
    "it was great",
    "it was great 😁",
    "it can be improved",
    "it can be improved 🤔",
];

const next_activity_acceptable_messages = [
    "start next activity",
    "start part 2",
    "start next game",
    "start next lesson",
    "let's start",
    "it was great",
    "it was great 😁",
    "it can be improved",
    "it can be improved 🤔",
    "start questions",
    "start part b",
    "next",
    "start practice",
    "next activity",
];

const course_start_acceptable_messages = [
    "start",
    "start!",
    "start free trial",
    "class 1 or 2",
    "class 3 to 6",
];

const course_start_states = [
    "Greeting Message",
    "Confirm Class - Level 1",
    "Confirm Class - Level 3",
    "Choose Class",
    "Course Start",
];

const trigger_course_acceptable_messages = [
    "start my course",
    "start next level",
    "complete final task",
    "start level 1",
    "start now!",
];

const grades_and_class_names = [
    "grade 1",
    "grade 2",
    "grade 3",
    "grade 4",
    "grade 5",
    "grade 6",
    "class 1",
    "class 2",
    "class 3",
    "class 4",
    "class 5",
    "class 6",
];

const youth_camp_grades = ["grade 7", "class 7"];

const salman_number = "+923012232148";
const ali_number = "+923225036358";
const salman_endpoint = "http://smiling-pro-sheep.ngrok-free.app/api/chatbot/webhook";
const ali_endpoint = "http://sensibly-solid-aardvark.ngrok-free.app/api/chatbot/webhook";

const teacher_trial_flow_engagement_types = [
    "New User",
    "Free Trial - Teachers",
    "End Now",
    "Thankyou Message",
    "School Name",
    "Confirm School Name",
    "City Name"
];

const kids_trial_flow_engagement_types = [
    "New User",
    "School Admin Confirmation",
    "Parent or Student",
    "Thankyou Message - School Owner",
    "Payment Complete",
    "Single Student Registration Complete",
    "Payment Details",
    "Cancel Registration Confirmation - Single Student Registration Complete",
    "Cancel Registration Confirmation - Payment Details",
    "User Profile",
    "School Admin Confirmation",
    "School Name",
    "Confirm School Name",
    "City Name",
    "Confirm City Name",
    "Ready to Pay",
    "Student Name Input",
    "Student Name Confirmation",
    "Student Generic Class Input",
    "Student Generic Class Confirmation",
    "Student Specific Class Input",
    "Student Specific Class Confirmation",
    "Single Student Registration Complete",
    "Greeting Message",
    "Greeting Message - Kids",
    "Confirm Class - Level 1",
    "Confirm Class - Level 3",
    "Choose Class",
    "Free Trial - Kids - Level 1",
    "Free Trial - Kids - Level 3",
    "End Now",
    "Thankyou Message",
    "Thankyou Message - Parent",
    "Thankyou Message - School Owner"
];

const activity_types = [
    "watch",
    "watchend",
    "mcqs",
    "feedbackaudio",
    "listenandspeak",
    "watchandspeak",
    "watchandaudio",
    "assessmentwatchandspeak",
    "assessmentmcqs",
    "feedbackmcqs",
    "speakingpractice",
    "conversationalquestionsbot",
    "read",
    "watchandimage",
    "conversationalmonologuebot",
    "conversationalagencybot"
]

const columns_order = {
    UPLOAD: 0,
    WEEK_NO: 1,
    DAY_NO: 2,
    SEQ_NO: 3,
    ALIAS: 4,
    ACTIVITY_TYPE: 5,
    TEXT_INSTRUCTION: 6,
    AUDIO_INSTRUCTION: 7,
    COMPLETION_STICKER: 8,
    Q_NO: 9,
    DIFFICULTY_LEVEL: 10,
    Q_TEXT: 11,
    Q_VIDEO_LINK: 12,
    Q_AUDIO_LINK: 13,
    Q_IMAGE_LINK: 14,
    ANSWER: 15,
    CF_TEXT: 16,
    CF_IMAGE: 17,
    CF_AUDIO: 18,
}

export {
    activity_types_to_repeat,
    text_message_types,
    beaj_team_numbers,
    feedback_acceptable_messages,
    next_activity_acceptable_messages,
    special_commands,
    grades_and_class_names,
    youth_camp_grades,
    talk_to_beaj_rep_messages,
    salman_number,
    ali_number,
    salman_endpoint,
    ali_endpoint,
    trigger_course_acceptable_messages,
    course_start_acceptable_messages,
    course_start_states,
    teacher_trial_flow_engagement_types,
    kids_trial_flow_engagement_types,
    activity_types,
    columns_order
};

