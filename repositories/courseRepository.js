import Course from '../models/Course.js';

const totalCoursesRepository = async () => {
    return await Course.count();
}

export default {
    totalCoursesRepository
}