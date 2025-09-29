import LessonInstructions from '../models/LessonInstructions.js';
import Lesson from '../models/Lesson.js';
import sequelize from '../config/sequelize.js';

const create = async (lessonId, instructionType, position, url, mediaId, caption) => {
    const instruction = new LessonInstructions({
        lessonId: lessonId,
        instructionType: instructionType,
        position: position,
        url: url,
        mediaId: mediaId,
        caption: caption,
    });
    const result = await instruction.save();
    return result;
};

const getByLessonId = async (lessonId) => {
    return await LessonInstructions.findAll({
        where: { lessonId: lessonId },
        order: [['instructionType', 'ASC'], ['position', 'ASC']]
    });
};

const getByLessonIdAndType = async (lessonId, instructionType, position) => {
    return await LessonInstructions.findOne({
        where: {
            lessonId: lessonId,
            instructionType: instructionType,
            position: position
        }
    });
};

const update = async (id, lessonId, instructionType, position, url, mediaId, caption) => {
    const instruction = await LessonInstructions.findByPk(id);
    if (instruction) {
        instruction.lessonId = lessonId;
        instruction.instructionType = instructionType;
        instruction.position = position;
        instruction.url = url;
        instruction.mediaId = mediaId;
        instruction.caption = caption;
        await instruction.save();
        return instruction;
    }
    return null;
};

const deleteById = async (id) => {
    const instruction = await LessonInstructions.findByPk(id);
    if (instruction) {
        await instruction.destroy();
        return true;
    }
    return false;
};

const deleteByLessonId = async (lessonId) => {
    return await LessonInstructions.destroy({
        where: { lessonId: lessonId }
    });
};

const getInstructionsByLessonIds = async (lessonIds) => {
    return await LessonInstructions.findAll({
        where: {
            lessonId: {
                [sequelize.Sequelize.Op.in]: lessonIds
            }
        },
        include: [{
            model: Lesson,
            as: 'lesson',
            attributes: ['LessonId', 'activity', 'activityAlias']
        }],
        order: [['lessonId', 'ASC'], ['instructionType', 'ASC'], ['position', 'ASC']]
    });
};

export default {
    create,
    getByLessonId,
    getByLessonIdAndType,
    update,
    deleteById,
    deleteByLessonId,
    getInstructionsByLessonIds
};