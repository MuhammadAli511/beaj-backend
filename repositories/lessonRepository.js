import Lesson from '../models/Lesson.js';

const totalLessonsRepository = async () => {
    return await Lesson.count();
}

export default {
    totalLessonsRepository
}