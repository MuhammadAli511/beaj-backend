import express from 'express';
import audioChatController from '../controllers/audioChatController.js';
import upload from '../config/multerConfig.js';

const router = express.Router();

// GET  api/audioChat/status
router.get('/status', (req, res) => {
    res.status(200).send("Audio Chat Route Status : Working");
});

// POST api/audioChat/analyze
router.post('/analyze', upload.single('file'), audioChatController.analyzeAudioChatController);


export default router;