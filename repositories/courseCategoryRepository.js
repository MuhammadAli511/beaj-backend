import CourseCategory from '../models/CourseCategory.js';

const totalCourseCategoriesRepository = async () => {
    return await CourseCategory.count();
}

export default {
    totalCourseCategoriesRepository
}