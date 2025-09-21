import sequelize from '../config/sequelize.js';
import Lesson from '../models/Lesson.js';
import LessonInstructions from '../models/LessonInstructions.js';

const migrateInstructions = async () => {
  try {
    console.log('Starting instruction migration...');

    // Get all lessons with existing instructions
    const lessons = await Lesson.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { textInstruction: { [sequelize.Sequelize.Op.ne]: null } },
          { textInstruction: { [sequelize.Sequelize.Op.ne]: '' } },
          { audioInstructionUrl: { [sequelize.Sequelize.Op.ne]: null } },
          { audioInstructionUrl: { [sequelize.Sequelize.Op.ne]: '' } }
        ]
      }
    });

    console.log(`Found ${lessons.length} lessons with instructions to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const lesson of lessons) {
      const instructionsToCreate = [];

      // Migrate text instruction (start)
      if (lesson.textInstruction && lesson.textInstruction.trim() !== '') {
        instructionsToCreate.push({
          lessonId: lesson.LessonId,
          instructionType: 'text',
          position: 'start',
          url: lesson.textInstruction,
          mediaId: null
        });
      }

      // Migrate audio instruction (start)
      if (lesson.audioInstructionUrl && lesson.audioInstructionUrl.trim() !== '') {
        instructionsToCreate.push({
          lessonId: lesson.LessonId,
          instructionType: 'audio',
          position: 'start',
          url: lesson.audioInstructionUrl,
          mediaId: lesson.audioInstructionMediaId
        });
      }

      // Create all instructions for this lesson
      if (instructionsToCreate.length > 0) {
        try {
          await LessonInstructions.bulkCreate(instructionsToCreate);
          migratedCount++;
          console.log(`✓ Migrated ${instructionsToCreate.length} instructions for lesson ${lesson.LessonId}`);
        } catch (error) {
          console.error(`✗ Failed to migrate instructions for lesson ${lesson.LessonId}:`, error);
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    console.log(`\n=== Migration Summary ===`);
    console.log(`✓ Successfully migrated: ${migratedCount} lessons`);
    console.log(`✗ Skipped/Failed: ${skippedCount} lessons`);
    console.log(`Total lessons processed: ${lessons.length}`);

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateInstructions()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export default migrateInstructions;