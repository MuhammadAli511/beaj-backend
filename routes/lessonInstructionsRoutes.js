import express from 'express';
import beajEmployeesAuth from '../middlewares/beajEmployeesAuth.js';
import lessonInstructionsController from '../controllers/lessonInstructionsController.js';
import upload from '../config/multerConfig.js';
import errorHandler from '../middlewares/errorHandler.js';

const router = express.Router();

// GET  api/lessonInstructions/status
router.get('/status', (req, res) => {
    res.status(200).send("Lesson Instructions Route Status : Working");
});

// GET /api/lesson-instructions/:lessonId - Get all instructions for a lesson
router.get('/:lessonId', beajEmployeesAuth, lessonInstructionsController.getLessonInstructions);

// GET /api/lesson-instructions/:lessonId/:instructionType/:position - Get specific instruction
router.get('/:lessonId/:instructionType/:position', beajEmployeesAuth, lessonInstructionsController.getLessonInstruction);

// POST /api/lesson-instructions - Create new instruction
router.post('/', beajEmployeesAuth, upload.single('file'), lessonInstructionsController.createLessonInstruction);

// PUT /api/lesson-instructions/:id - Update instruction
router.put('/:id', beajEmployeesAuth, upload.single('file'), lessonInstructionsController.updateLessonInstruction);

// DELETE /api/lesson-instructions/:id - Delete instruction
router.delete('/:id', beajEmployeesAuth, lessonInstructionsController.deleteLessonInstruction);

// Use error handler middleware
router.use(errorHandler);

export default router;