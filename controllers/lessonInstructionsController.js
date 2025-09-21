import lessonInstructionsService from '../services/lessonInstructionsService.js';

const createLessonInstruction = async (req, res) => {
  try {
    const { lessonId, instructionType, position, mediaId } = req.body;
    const file = req.file;
    const instruction = await lessonInstructionsService.createLessonInstructionService(
      lessonId, instructionType, position, file, mediaId
    );
    
    res.status(201).json({
      success: true,
      message: 'Lesson instruction created successfully',
      data: instruction
    });
  } catch (error) {
    console.error('Error creating lesson instruction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create lesson instruction',
      error: error.message
    });
  }
};

const getLessonInstructions = async (req, res) => {
  try {
    const { lessonId } = req.params;
    
    const instructions = await lessonInstructionsService.getLessonInstructionsService(lessonId);
    
    res.status(200).json({
      success: true,
      data: instructions
    });
  } catch (error) {
    console.error('Error getting lesson instructions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get lesson instructions',
      error: error.message
    });
  }
};

const getLessonInstruction = async (req, res) => {
  try {
    const { lessonId, instructionType, position } = req.params;
    
    const instruction = await lessonInstructionsService.getLessonInstructionService(
      lessonId, instructionType, position
    );
    
    if (!instruction) {
      return res.status(404).json({
        success: false,
        message: 'Lesson instruction not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: instruction
    });
  } catch (error) {
    console.error('Error getting lesson instruction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get lesson instruction',
      error: error.message
    });
  }
};

const updateLessonInstruction = async (req, res) => {
  try {
    const { id } = req.params;
    const { lessonId, instructionType, position, mediaId } = req.body;
    const file = req.file;
    
    const instruction = await lessonInstructionsService.updateLessonInstructionService(
      id, lessonId, instructionType, position, file, mediaId
    );
    
    if (!instruction) {
      return res.status(404).json({
        success: false,
        message: 'Lesson instruction not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Lesson instruction updated successfully',
      data: instruction
    });
  } catch (error) {
    console.error('Error updating lesson instruction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update lesson instruction',
      error: error.message
    });
  }
};

const deleteLessonInstruction = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleted = await lessonInstructionsService.deleteLessonInstructionService(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Lesson instruction not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Lesson instruction deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting lesson instruction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete lesson instruction',
      error: error.message
    });
  }
};

export default {
  createLessonInstruction,
  getLessonInstructions,
  getLessonInstruction,
  updateLessonInstruction,
  deleteLessonInstruction
};