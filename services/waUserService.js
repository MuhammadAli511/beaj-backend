import waUser from "../repositories/waUser.js";
import questionResponseRepository from "../repositories/questionResponseRepository.js";

const lessonIdSequence = [1213, 1214, 1215, 1217, 1218, 1219, 1220, 1221, 1222, 1223, 1224, 1225, 1226, 1228, 1229, 1230, 1232];

const getAllWaUsersService = async () => {
    try {
        const result = await waUser.getAll();
        const responses = await questionResponseRepository.getAllWhatsappUserResponses();
        const waUsers = [];

        const activityTypes = ['listenAndSpeak', 'postListenAndSpeak', 'preListenAndSpeak', 'mcqs', 'preMCQs', 'postMCQs'];

        result.forEach(user => {
            const userResponses = responses.filter(response => response.UserId === user.phone_number);
            let totalCorrect = 0;
            let totalWrong = 0;
            let totalQuestions = 0;

            userResponses.forEach(response => {
                if (activityTypes.includes(response.activityType)) {
                    totalQuestions += 1;
                    if (response.correct) {
                        totalCorrect += 1;
                    } else {
                        totalWrong += 1;
                    }
                }
            });

            const average = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

            // Find the position of the current lesson_id in the lessonIdSequence array
            const currentLessonIndex = lessonIdSequence.indexOf(parseInt(user.lesson_id));
            const lessonsCompleted = currentLessonIndex + 1;

            const waUser = {
                phone_number: user.phone_number,
                level: user.level,
                week: user.week,
                day: user.day,
                activity_type: user.activity_type,
                lesson_id: user.lesson_id,
                question_number: user.question_number,
                last_updated: user.last_updated,
                totalCorrect,
                totalWrong,
                totalQuestions,
                average: average.toFixed(2),
                lessonsCompleted
            };
            waUsers.push(waUser);
        });
        return waUsers;
    } catch (error) {
        error.fileName = 'waUserService.js';
        throw error;
    }
};



export default {
    getAllWaUsersService
};