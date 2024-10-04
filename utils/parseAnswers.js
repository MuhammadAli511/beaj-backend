const parseAnswers = (answerString) => {
    const regex = /"([^"]*)"|([^,]+)/g;
    const answers = [];
    let match;
    while ((match = regex.exec(answerString)) !== null) {
        if (match[1]) {
            answers.push(match[1].replace(/\\"/g, '"'));
        } else if (match[2]) {
            // Matched a non-quoted string
            answers.push(match[2].trim());
        }
    }
    return answers;
};

export default parseAnswers;