import { activity_types } from '../constants/constants.js';
import { toCamelCase } from '../utils/utils.js';

// Import all activity type modules
// You can uncomment these as you create each file
import watch from './watch.js';
// import watchend from './watchend.js';
// import videoend from './videoend.js';
// import mcqs from './mcqs.js';
// import feedbackaudio from './feedbackaudio.js';
// import listenandspeak from './listenandspeak.js';
// import watchandspeak from './watchandspeak.js';
// import watchandaudio from './watchandaudio.js';
// import assessmentwatchandspeak from './assessmentwatchandspeak.js';
// import assessmentmcqs from './assessmentmcqs.js';
// import feedbackmcqs from './feedbackmcqs.js';
// import speakingpractice from './speakingpractice.js';
// import conversationalquestionsbot from './conversationalquestionsbot.js';
// import read from './read.js';
// import watchandimage from './watchandimage.js';
// import conversationalmonologuebot from './conversationalmonologuebot.js';
// import conversationalagencybot from './conversationalagencybot.js';


// Map of activity types to their modules (add as you create files)
const activityModules = {
    watch: watch,
    // watchend: watchend,
    // mcqs: mcqs,
    // Add other modules as you create them...
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
    ingestion[ingestionFunctionName] = async (activities, courseId) => {
        if (module && module.ingestion) {
            return await module.ingestion(activities, courseId);
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