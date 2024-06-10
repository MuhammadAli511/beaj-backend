import courseRepository from '../repositories/courseRepository.js';
import courseCategoryRepository from '../repositories/courseCategoryRepository.js';
import lessonRepository from '../repositories/lessonRepository.js';

const totalContentStatsService = async () => {
    const totalCourses = await courseRepository.totalCoursesRepository();
    const totalCourseCategories = await courseCategoryRepository.totalCourseCategoriesRepository();
    const totalLessons = await lessonRepository.totalLessonsRepository();

    return {
        "totalCourses": totalCourses,
        "totalCourseCategories": totalCourseCategories,
        "totalLessons": totalLessons
    };
}

export default {
    totalContentStatsService
}