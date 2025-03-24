import multer from 'multer';

const storage = multer.memoryStorage();
const multipleUpload = multer({ storage: storage }).fields([
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 },
    { name: 'customAnswerFeedbackImage', maxCount: 1 },
    { name: 'customAnswerFeedbackAudio', maxCount: 1 }
]);

export default multipleUpload;