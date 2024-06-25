import Lesson from '../models/Lesson.js';

const totalLessonsRepository = async () => {
    return await Lesson.count();
};

const create = async (lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber) => {
    console.log(activityAlias)
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
    lesson.sequenceNumber = sequenceNumber;
    await lesson.save();
    return lesson;
};

const deleteLesson = async (id) => {
    const lesson = await Lesson.findByPk(id);
    await lesson.destroy();
};

export default {
    totalLessonsRepository,
    create,
    getAll,
    getById,
    update,
    deleteLesson
};