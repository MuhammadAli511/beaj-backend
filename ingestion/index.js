import { activity_types } from '../constants/constants.js';
import { toCamelCase } from '../utils/utils.js';
import video from './video.js';
import videoEnd from './videoEnd.js';
import feedbackAudio from './feedbackAudio.js';
import read from './read.js';
import watchAndImage from './watchAndImage.js';
import watchAndAudio from './watchAndAudio.js';
import speakingPractice from './speakingPractice.js';
import watchAndSpeak from './watchAndSpeak.js';
import assessmentWatchAndSpeak from './assessmentWatchAndSpeak.js';
import listenAndSpeak from './listenAndSpeak.js';
// import conversationalquestionsbot from './conversationalquestionsbot.js';
// import conversationalmonologuebot from './conversationalmonologuebot.js';
// import conversationalagencybot from './conversationalagencybot.js';
// import mcqs from './mcqs.js';
// import assessmentmcqs from './assessmentmcqs.js';
// import feedbackmcqs from './feedbackmcqs.js';


// Map of activity types to their modules
const activityModules = {
    video: video,
    videoEnd: videoEnd,
    feedbackAudio: feedbackAudio,
    read: read,
    watchAndImage: watchAndImage,
    watchAndAudio: watchAndAudio,
    speakingPractice: speakingPractice,
    watchAndSpeak: watchAndSpeak,
    assessmentWatchAndSpeak: assessmentWatchAndSpeak,
    listenAndSpeak: listenAndSpeak,
};

// Create unified ingestion object
const ingestion = {};

// Generate all validation and ingestion function names
activity_types.forEach(activityType => {
    const camelCaseType = toCamelCase(activityType);
    const module = activityModules[activityType];

    // Add validation function
    const validationFunctionName = `${camelCaseType}Validation`;
    ingestion[validationFunctionName] = async (activities) => {
        if (module && module.validation) {
            return await module.validation(activities);
        }
        // Default validation response if module doesn't exist
        return {
            errors: [],
            toCreateCount: 0,
            toUpdateCount: 0,
            toDeleteCount: 0
        };
    };

    // Add ingestion function
    const ingestionFunctionName = `${camelCaseType}Ingestion`;
    ingestion[ingestionFunctionName] = async (activities) => {
        if (module && module.ingestion) {
            return await module.ingestion(activities);
        }
        // Default ingestion response if module doesn't exist
        return {
            success: true,
            message: `${activityType} ingestion not implemented yet`,
            processed: 0
        };
    };
});

export default ingestion;