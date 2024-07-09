import Lesson from '../models/Lesson.js';
import Sequelize from 'sequelize';

const totalLessonsRepository = async () => {
    return await Lesson.count();
};

const create = async (lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber) => {
    const lesson = new Lesson({
        lessonType: lessonType,
        dayNumber: dayNumber,
        activity: activity,
        activityAlias: activityAlias,
        weekNumber: weekNumber,
        text: text,
        courseId: courseId,
        SequenceNumber: sequenceNumber
    });
    const result = await lesson.save();
    return result;
};

const getAll = async () => {
    return await Lesson.findAll();
};

const getById = async (id) => {
    return await Lesson.findByPk(id);
};

const update = async (id, lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber) => {
    const lesson = await Lesson.findByPk(id);
    lesson.lessonType = lessonType;
    lesson.dayNumber = dayNumber;
    lesson.activity = activity;
    lesson.activityAlias = activityAlias;
    lesson.weekNumber = weekNumber;
    lesson.text = text;
    lesson.courseId = courseId;
    lesson.SequenceNumber = sequenceNumber;
    await lesson.save();
    return lesson;
};

const deleteLesson = async (id) => {
    const lesson = await Lesson.findByPk(id);
    await lesson.destroy();
};


const getNextLesson = async (courseId, weekNumber, dayNumber, sequenceNumber) => {
    // If weekNumber, dayNumber, and sequenceNumber are all null, return the first lesson in the course
    if (!dayNumber && !sequenceNumber) {
        // Find the minimum dayNumber for the given courseId and weekNumber
        const minDay = await Lesson.min('dayNumber', { where: { courseId: courseId, weekNumber: weekNumber } });

        // Find the minimum sequenceNumber for the given courseId, weekNumber, and minDay
        return await Lesson.findOne({
            where: {
                courseId: courseId,
                weekNumber: weekNumber,
                dayNumber: minDay
            },
            order: [
                ['SequenceNumber', 'ASC']
            ]
        });
    }

    // If weekNumber, dayNumber, and sequenceNumber are all not null, they are the values of the previous lesson
    if (weekNumber && dayNumber && sequenceNumber) {
        // Try to find the next lesson in the same day
        let nextLesson = await Lesson.findOne({
            where: {
                courseId: courseId,
                weekNumber: weekNumber,
                dayNumber: dayNumber,
                SequenceNumber: {
                    [Sequelize.Op.gt]: sequenceNumber
                }
            },
            order: [
                ['SequenceNumber', 'ASC']
            ]
        });

        // If no lesson found in the same day, try the next day
        if (!nextLesson) {
            nextLesson = await Lesson.findOne({
                where: {
                    courseId: courseId,
                    weekNumber: weekNumber,
                    dayNumber: {
                        [Sequelize.Op.gt]: dayNumber
                    }
                },
                order: [
                    ['dayNumber', 'ASC'],
                    ['SequenceNumber', 'ASC']
                ]
            });
        }

        // If no lesson found in the same week, try the next week
        if (!nextLesson) {
            nextLesson = await Lesson.findOne({
                where: {
                    courseId: courseId,
                    weekNumber: {
                        [Sequelize.Op.gt]: weekNumber
                    }
                },
                order: [
                    ['weekNumber', 'ASC'],
                    ['dayNumber', 'ASC'],
                    ['SequenceNumber', 'ASC']
                ]
            });
        }

        // If no further lessons found, return null
        if (!nextLesson) {
            return null;
        }

        return nextLesson;
    }
};



export default {
    totalLessonsRepository,
    create,
    getAll,
    getById,
    update,
    deleteLesson,
    getNextLesson,
};