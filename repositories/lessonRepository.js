import Lesson from '../models/Lesson.js';
import Sequelize from 'sequelize';

const totalLessonsRepository = async () => {
    return await Lesson.count();
};

const create = async (lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber, status, textInstruction, audioInstructionUrl) => {
    const lesson = new Lesson({
        lessonType: lessonType,
        dayNumber: dayNumber,
        activity: activity,
        activityAlias: activityAlias,
        weekNumber: weekNumber,
        text: text,
        courseId: courseId,
        SequenceNumber: sequenceNumber,
        status: status,
        textInstruction: textInstruction,
        audioInstructionUrl: audioInstructionUrl
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

const getByLessonId = async (lessonId) => {
    return await Lesson.findOne({
        where: {
            LessonId: lessonId
        }
    });
};

const getLessonsArrayForWeek = async (courseId, week) => {
    const lessons = await Lesson.findAll({
        where: {
            courseId: courseId,
            weekNumber: week
        },
        order: [
            ['dayNumber', 'ASC'],
            ['SequenceNumber', 'ASC']
        ]
    });
    return lessons.map(lesson => lesson.LessonId);
};

const getByCourseActivity = async (course, activity) => {
    return await Lesson.findAll({
        where: {
            courseId: course,
            activity: activity
        },
        order: [
            ['weekNumber', 'ASC'],
            ['dayNumber', 'ASC']
        ]
    });
};


const update = async (id, lessonType, dayNumber, activity, activityAlias, weekNumber, text, courseId, sequenceNumber, status, textInstruction, audioInstructionUrl) => {
    const lesson = await Lesson.findByPk(id);
    lesson.lessonType = lessonType;
    lesson.dayNumber = dayNumber;
    lesson.activity = activity;
    lesson.activityAlias = activityAlias;
    lesson.weekNumber = weekNumber;
    lesson.text = text;
    lesson.courseId = courseId;
    lesson.SequenceNumber = sequenceNumber;
    lesson.status = status;
    lesson.textInstruction = textInstruction;
    lesson.audioInstructionUrl = audioInstructionUrl;
    await lesson.save();
    return lesson;
};

const deleteLesson = async (id) => {
    const lesson = await Lesson.findByPk(id);
    await lesson.destroy();
};

const getCurrentLesson = async (lesson_id) => {
    return await Lesson.findOne({
        where: {
            LessonId: lesson_id
        }
    });
};

const isFirstLessonOfDay = async (lessonId) => {
    const lesson = await Lesson.findByPk(lessonId);

    if (!lesson) {
        return false;
    }

    const firstLessonOfDay = await Lesson.findOne({
        where: {
            courseId: lesson.courseId,
            weekNumber: lesson.weekNumber,
            dayNumber: lesson.dayNumber,
            status: 'Active'
        },
        order: [['SequenceNumber', 'ASC']],
        limit: 1
    });

    return firstLessonOfDay && firstLessonOfDay.dataValues.LessonId == lesson.dataValues.LessonId;
};


const isLastLessonOfDay = async (lessonId) => {
    const lesson = await Lesson.findByPk(lessonId);

    if (!lesson) {
        return false;
    }

    const lastLessonOfDay = await Lesson.findOne({
        where: {
            courseId: lesson.courseId,
            weekNumber: lesson.weekNumber,
            dayNumber: lesson.dayNumber,
            status: 'Active'
        },
        order: [['SequenceNumber', 'DESC']],
        limit: 1
    });

    return lastLessonOfDay && lastLessonOfDay.dataValues.LessonId == lesson.dataValues.LessonId;
};


const getTotalDaysInCourse = async (courseId) => {
    const maxWeekNumber = await Lesson.max('weekNumber', {
        where: {
            courseId: courseId
        }
    });

    let totalDays = 0;

    for (let week = 1; week <= maxWeekNumber; week++) {
        const maxDayNumberInWeek = await Lesson.max('dayNumber', {
            where: {
                courseId: courseId,
                weekNumber: week
            }
        });
        totalDays += maxDayNumberInWeek || 0;
    }

    return totalDays;
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
                dayNumber: minDay,
                status: 'Active'
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
                status: 'Active',
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
                    status: 'Active',
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
                    status: 'Active',
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


const getLessonsByCourse = async (courseId) => {
    return await Lesson.findAll({
        where: {
            courseId: courseId
        }
    });
};

const getLessonIdsByCourseAndWeekAndActivityType = async (courseId, weekNumber, activityType) => {
    const lessons = await Lesson.findAll({
        where: {
            courseId: courseId,
            weekNumber: weekNumber,
            activity: activityType
        },
        attributes: ['LessonId']
    });
    return lessons.map(lesson => lesson.LessonId);
};

const getLessonIdsByCourseWeekDaySeq = async (courseId, weekNumber, dayNumber, sequenceNumber) => {
    const lessons = await Lesson.findOne({
        where: {
            courseId: courseId,
            weekNumber: weekNumber,
            dayNumber: dayNumber,
            SequenceNumber: sequenceNumber
        },
        attributes: ['LessonId']
    });
    return lessons ? lessons.LessonId : null;
};

const getLessonIdsByCourseAndAliasAndWeekAndDay = async (courseId, alias, weekDayPairs) => {
    let whereClause = {
        courseId: courseId,
        activityAlias: alias
    };

    if (weekDayPairs && weekDayPairs.length > 0) {
        // Create OR conditions for each [week, day] pair
        const orConditions = weekDayPairs.map(pair => ({
            weekNumber: pair[0],
            dayNumber: pair[1]
        }));

        whereClause[Sequelize.Op.or] = orConditions;
    }

    const lessons = await Lesson.findAll({
        where: whereClause,
        attributes: ['LessonId']
    });

    return lessons.map(lesson => lesson.LessonId);
};

const getLessonIdsByCourseAndAlias = async (courseId, aliasArray) => {
    const lessons = await Lesson.findAll({
        where: {
            courseId: courseId,
            activityAlias: {
                [Sequelize.Op.in]: aliasArray
            }
        }
    });
    return lessons.map(lesson => lesson.LessonId);
};

const getActivityByLessonId = async (lessonId) => {
    const lesson = await Lesson.findByPk(lessonId);
    return lesson.activity;
};

const getByLessonIds = async (lessonIds) => {
    return await Lesson.findAll({
        where: {
            LessonId: {
                [Sequelize.Op.in]: lessonIds
            }
        }
    });
};

const getLessonsByCourseOrdered = async (courseId) => {
    return await Lesson.findAll({
        where: { courseId },
        order: [
            ['weekNumber', 'ASC'],
            ['dayNumber', 'ASC'],
            ['SequenceNumber', 'ASC'],
        ],
        raw: true, // optional, for plain objects
    });
};


export default {
    totalLessonsRepository,
    create,
    getAll,
    getById,
    update,
    deleteLesson,
    getNextLesson,
    getCurrentLesson,
    getByCourseActivity,
    getLessonsArrayForWeek,
    isFirstLessonOfDay,
    isLastLessonOfDay,
    getTotalDaysInCourse,
    getLessonsByCourse,
    getLessonIdsByCourseAndWeekAndActivityType,
    getActivityByLessonId,
    getByLessonIds,
    getByLessonId,
    getLessonsByCourseOrdered,
    getLessonIdsByCourseAndAliasAndWeekAndDay,
    getLessonIdsByCourseAndAlias,
    getLessonIdsByCourseWeekDaySeq,
};