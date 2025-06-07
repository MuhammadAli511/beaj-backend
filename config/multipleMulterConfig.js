import multer from 'multer';

const storage = multer.memoryStorage();
const multipleUpload = multer({ storage: storage }).fields([
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 },
    { name: 'customAnswerFeedbackImage', maxCount: 1 }, // Multiple Choice Question
    { name: 'customAnswerFeedbackAudio', maxCount: 1 }, // Multiple Choice Question
    { name: 'customFeedbackImage', maxCount: 1 }, // Speak Activity Question
    { name: 'customFeedbackAudio', maxCount: 1 } // Speak Activity Question
]);

export default multipleUpload;