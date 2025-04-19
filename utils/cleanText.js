const cleanTextForSpeech = async (model_response) => {
    // Replace newline characters with spaces
    let cleanedText = model_response.replace(/\n/g, ' ');

    // Replace escaped quotes with regular quotes
    cleanedText = cleanedText.replace(/\\"/g, '"');

    // Replace multiple spaces with a single space
    cleanedText = cleanedText.replace(/\s+/g, ' ');

    // Remove other special characters that might cause issues in text-to-speech
    cleanedText = cleanedText.replace(/[^\w\s.,!?'"()-]/g, '');

    // Additional replacements for any remaining problematic escape sequences
    cleanedText = cleanedText.replace(/\\t/g, ' '); // Replace tab characters with a space
    cleanedText = cleanedText.replace(/\\r/g, ' '); // Replace carriage returns with a space
    cleanedText = cleanedText.replace(/\\n/g, ' '); // Replace literal \n with a space
    cleanedText = cleanedText.replace(/\\'/g, "'"); // Replace escaped single quotes with single quotes
    cleanedText = cleanedText.replace('\"', ""); // Replace escaped single quotes with single quotes

    return cleanedText.trim();
};



export default cleanTextForSpeech;
