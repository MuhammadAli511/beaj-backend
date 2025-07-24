import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createCanvas, registerFont, loadImage } from 'canvas';
import azureBlobStorage from './azureBlobStorage.js';
import waUserActivityLogsRepository from '../repositories/waUserActivityLogsRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Register the Arial font
registerFont(join(__dirname, '../fonts/arial.ttf'), { family: 'Arial' });

const weekEndImage = async (score, week) => {
    try {
        // Set up canvas dimensions
        const width = 900;
        const height = 800;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Define colors
        const backgroundColor = '#51bccc';
        const chartColor = '#e6f035';
        const whiteColor = '#FFFFFF';


        // Draw background
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        // Draw title
        ctx.fillStyle = 'white';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Week ${week}`, width / 2, 100);
        ctx.fillStyle = 'black';
        ctx.font = 'bold 50px Arial';
        ctx.fillText('Your End-of-Week Score', width / 2, 170);

        // Draw circular progress chart (donut shape)
        const centerX = width / 2;
        const centerY = height / 2 + 50;
        const outerRadius = 200;
        const innerRadius = 120;
        const scorePercentage = score / 100;

        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
        ctx.fillStyle = whiteColor;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, outerRadius, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * scorePercentage);
        ctx.lineTo(centerX, centerY);
        ctx.fillStyle = chartColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
        ctx.fillStyle = backgroundColor;
        ctx.fill();

        ctx.fillStyle = chartColor;
        ctx.font = 'bold 60px Arial';
        ctx.fillText(`${score}%`, centerX, centerY + 20);

        ctx.font = 'bold 60px Arial';
        let remark = '';
        if (parseInt(score) <= 60) {
            remark = "Good Effort!";
        } else if (parseInt(score) <= 79) {
            remark = "Well done!";
        } else {
            remark = "Excellent!";
        }
        ctx.fillText(remark, centerX, centerY + 300);


        // Convert the canvas to a buffer
        const buffer = canvas.toBuffer('image/jpeg');

        // Upload to Azure Blob Storage
        const imageUrl = await azureBlobStorage.uploadImageToBlobStorage(buffer);
        return imageUrl;
    } catch (err) {
        console.log('Error creating and uploading image:', err);
        throw new Error('Failed to create and upload image');
    }
};

const createAndUploadScoreImage = async (pronunciationAssessment, threshold) => {
    try {
        if (pronunciationAssessment === undefined || pronunciationAssessment == [] || pronunciationAssessment == null) {
            return null;
        };

        const fluencyScoreNumber = Math.round(pronunciationAssessment.scoreNumber.fluencyScore);
        let accuracyScoreNumber = Math.round(pronunciationAssessment.scoreNumber.accuracyScore);
        const completenessScoreNumber = Math.round(pronunciationAssessment.scoreNumber.compScore);
        const words = pronunciationAssessment.words;

        const mispronouncedWordsList = pronunciationAssessment.words.filter(word =>
            word && word.PronunciationAssessment &&
            (word.PronunciationAssessment.ErrorType == "Mispronunciation" ||
                word.PronunciationAssessment.AccuracyScore < threshold)
        );
        if (mispronouncedWordsList.length == 0 && accuracyScoreNumber > threshold) {
            accuracyScoreNumber = 100;
        }

        // Set up canvas dimensions
        const width = 900;
        const height = 850;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Draw background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Load and add the company logo in the top - right corner
        const image = await loadImage("https://beajbloblive.blob.core.windows.net/beajdocuments/logo.jpeg");  // Path to the logo image
        ctx.drawImage(image, width - 160, 20, image.width / 7.5, image.height / 7.5);

        // Add "YOUR SCORE" Title
        ctx.font = 'bold 40px Arial';
        ctx.fillStyle = '#000000';
        ctx.fillText('YOUR SCORE', 50, 80);

        // Add "Completeness" Bar with dynamic score
        ctx.font = '25px Arial';
        ctx.fillText('Sentence Completion', 50, 120);

        // Draw light magenta background bar for full length
        ctx.fillStyle = '#eecef7';
        ctx.fillRect(50, 125, 790, 40);

        // Draw dark magenta foreground bar for actual score
        ctx.fillStyle = '#cb6ce6';
        ctx.fillRect(50, 125, 790 * (completenessScoreNumber / 100), 40);

        // Add score text inside the bar
        ctx.fillStyle = '#000000';
        // Position till the end of dark magenta bar
        ctx.fillText(`${completenessScoreNumber}%`, 50 + 790 * (completenessScoreNumber / 100) - 70, 155);


        // Add "Pronunciation" Bar with dynamic score
        ctx.font = '25px Arial';
        ctx.fillText('Correct Pronunciation', 50, 215);

        // Draw light blue background bar for full length
        ctx.fillStyle = '#B2EBF2';
        ctx.fillRect(50, 220, 790, 40);

        // Draw dark blue foreground bar for actual score
        ctx.fillStyle = '#30D5C8';
        ctx.fillRect(50, 220, 790 * (accuracyScoreNumber / 100), 40);

        // Add score text inside the bar
        ctx.fillStyle = '#000000';
        // Position till the end of dark blue bar
        ctx.fillText(`${accuracyScoreNumber}%`, 50 + 790 * (accuracyScoreNumber / 100) - 70, 250);


        // Add "Fluency" Bar with dynamic score
        ctx.font = '25px Arial';
        ctx.fillText('Fluency', 50, 310);

        // Draw light yellow background bar for full length
        ctx.fillStyle = '#F0F4C3';
        ctx.fillRect(50, 315, 790, 40);

        // Draw darker yellow foreground bar for actual score
        ctx.fillStyle = '#C7EA46';
        ctx.fillRect(50, 315, 790 * (fluencyScoreNumber / 100), 40);

        // Add score text inside the bar
        ctx.fillStyle = '#000000';
        ctx.fillText(`${fluencyScoreNumber}%`, 50 + 790 * (fluencyScoreNumber / 100) - 70, 345);

        ctx.font = 'bold 30px Arial';
        ctx.fillText('You said:', 50, 410);

        // Create a paragraph format for the text
        ctx.font = '25px Arial';
        const marginLeft = 50;
        const maxWidth = 850;
        let lineHeight = 40;
        let cursorX = marginLeft;
        let cursorY = 450; // Starting Y position for the text

        // Loop through words and handle line breaks
        words.forEach((wordObj, index) => {
            // If undefined, skip the word
            if (wordObj == undefined || !wordObj.PronunciationAssessment) {
                return;
            }

            // If not Mispronunciation, Omission, or None, skip the word
            if (!['Mispronunciation', 'Omission', 'None'].includes(wordObj.PronunciationAssessment.ErrorType)) {
                return;
            }
            let word = wordObj.Word;

            // Capitalize only the first letter of the first word
            if (index == 0) {
                word = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            } else {
                word = word.toLowerCase();
            }

            const errorType = wordObj.PronunciationAssessment.ErrorType;
            const wordAccuracyScore = wordObj.PronunciationAssessment.AccuracyScore;
            const wordWidth = ctx.measureText(word).width + 15; // Measure width of the word

            // If the word exceeds the max width, move to a new line
            if (cursorX + wordWidth > maxWidth) {
                cursorX = marginLeft; // Reset X position to the left margin
                cursorY += lineHeight; // Move to the next line
            }

            if (errorType == 'Mispronunciation' || wordAccuracyScore < threshold) {
                // Highlight mispronounced words in yellow
                ctx.fillStyle = '#FFD700'; // Yellow
                ctx.fillRect(cursorX - 5, cursorY - 25, wordWidth - 5, 30);
                ctx.fillStyle = '#000000'; // Black text
                ctx.fillText(word, cursorX, cursorY);
            } else if (errorType == 'Omission') {
                // Highlight skipped words in grey
                ctx.fillStyle = '#A9A9A9'; // Grey
                ctx.fillRect(cursorX - 5, cursorY - 25, wordWidth - 5, 30);
                ctx.fillStyle = '#000000'; // Black text
                ctx.fillText(word, cursorX, cursorY);
            } else if (errorType == 'None') {
                // Regular words
                ctx.fillStyle = '#000000';
                ctx.fillText(word, cursorX, cursorY);
            }

            // Move cursor for the next word
            cursorX += wordWidth;
        });

        // Add the legends at the bottom
        ctx.font = '20px Arial';

        // Mispronounced Words Legend (Yellow Circle)
        ctx.fillStyle = '#FFD700'; // Yellow color
        ctx.beginPath(); // Start a new path
        ctx.arc(60, 820, 10, 0, 2 * Math.PI);
        ctx.fill(); // Fill the circle
        ctx.fillStyle = '#000000';
        ctx.fillText('Mispronounced Words', 80, 827);

        // Skipped Words Legend (Grey Circle)
        ctx.fillStyle = '#A9A9A9'; // Grey color
        ctx.beginPath(); // Start a new path
        ctx.arc(350, 820, 10, 0, 2 * Math.PI);
        ctx.fill(); // Fill the circle
        ctx.fillStyle = '#000000';
        ctx.fillText('Skipped Words', 370, 827);

        // Convert the canvas to a buffer
        const buffer = canvas.toBuffer('image/jpeg');

        // Upload to Azure Blob Storage
        const imageUrl = await azureBlobStorage.uploadImageToBlobStorage(buffer);
        return imageUrl;
    } catch (err) {
        console.log('Error creating and uploading image:', err);
        throw new Error('Failed to create and upload image');
    }
};

const createAndUploadScoreImageNoAnswer = async (pronunciationAssessment, threshold) => {
    try {
        if (pronunciationAssessment === undefined || pronunciationAssessment == [] || pronunciationAssessment == null) {
            return null;
        };

        const fluencyScoreNumber = Math.round(pronunciationAssessment.scoreNumber.fluencyScore);
        let accuracyScoreNumber = Math.round(pronunciationAssessment.scoreNumber.accuracyScore);
        const words = pronunciationAssessment.words;

        const mispronouncedWordsList = pronunciationAssessment.words.filter(word =>
            word?.PronunciationAssessment &&
            (word?.PronunciationAssessment?.ErrorType == "Mispronunciation" ||
                word?.PronunciationAssessment?.AccuracyScore < threshold)
        );
        if (mispronouncedWordsList.length == 0 && accuracyScoreNumber > threshold) {
            accuracyScoreNumber = 100;
        }

        // Set up canvas dimensions
        const width = 900;
        const height = 850;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Draw background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Load and add the company logo in the top - right corner
        const image = await loadImage("https://beajbloblive.blob.core.windows.net/beajdocuments/logo.jpeg");  // Path to the logo image
        ctx.drawImage(image, width - 160, 20, image.width / 7.5, image.height / 7.5);

        // Add "YOUR SCORE" Title
        ctx.font = 'bold 40px Arial';
        ctx.fillStyle = '#000000';
        ctx.fillText('YOUR SCORE', 50, 80);

        // Add "Pronunciation" Bar with dynamic score
        ctx.font = '25px Arial';
        ctx.fillText('Correct Pronunciation', 50, 120);

        // Draw light blue background bar for full length
        ctx.fillStyle = '#B2EBF2';
        ctx.fillRect(50, 125, 790, 40);

        // Draw dark blue foreground bar for actual score
        ctx.fillStyle = '#30D5C8';
        ctx.fillRect(50, 125, 790 * (accuracyScoreNumber / 100), 40);

        // Add score text inside the bar
        ctx.fillStyle = '#000000';
        // Position till the end of dark blue bar
        ctx.fillText(`${accuracyScoreNumber}%`, 50 + 790 * (accuracyScoreNumber / 100) - 70, 155);

        // Add "Fluency" Bar with dynamic score
        ctx.font = '25px Arial';
        ctx.fillText('Fluency', 50, 215);

        // Draw light yellow background bar for full length
        ctx.fillStyle = '#F0F4C3';
        ctx.fillRect(50, 220, 790, 40);

        // Draw darker yellow foreground bar for actual score
        ctx.fillStyle = '#C7EA46';
        ctx.fillRect(50, 220, 790 * (fluencyScoreNumber / 100), 40);

        // Add score text inside the bar
        ctx.fillStyle = '#000000';
        ctx.fillText(`${fluencyScoreNumber}%`, 50 + 790 * (fluencyScoreNumber / 100) - 70, 250);

        ctx.font = 'bold 30px Arial';
        ctx.fillText('You said:', 50, 315);

        // Create a paragraph format for the text
        ctx.font = '25px Arial';
        const marginLeft = 50;
        const maxWidth = 850;
        let lineHeight = 40;
        let cursorX = marginLeft;
        let cursorY = 355; // Starting Y position for the text

        // Loop through words and handle line breaks
        words.forEach((wordObj, index) => {
            // If undefined, skip the word
            if (wordObj == undefined || !wordObj.PronunciationAssessment) {
                return;
            }

            // If not Mispronunciation, Omission, or None, skip the word
            if (!['Mispronunciation', 'Omission', 'None'].includes(wordObj.PronunciationAssessment.ErrorType)) {
                return;
            }
            let word = wordObj.Word;

            // Capitalize only the first letter of the first word
            if (index == 0) {
                word = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            } else {
                word = word.toLowerCase();
            }

            const errorType = wordObj.PronunciationAssessment.ErrorType;
            const wordAccuracyScore = wordObj.PronunciationAssessment.AccuracyScore;
            const wordWidth = ctx.measureText(word).width + 15; // Measure width of the word

            // If the word exceeds the max width, move to a new line
            if (cursorX + wordWidth > maxWidth) {
                cursorX = marginLeft; // Reset X position to the left margin
                cursorY += lineHeight; // Move to the next line
            }

            if (errorType == 'Mispronunciation' || wordAccuracyScore < threshold) {
                // Highlight mispronounced words in yellow
                ctx.fillStyle = '#FFD700'; // Yellow
                ctx.fillRect(cursorX - 5, cursorY - 25, wordWidth - 5, 30);
                ctx.fillStyle = '#000000'; // Black text
                ctx.fillText(word, cursorX, cursorY);
            } else if (errorType == 'Omission') {
                // Highlight skipped words in grey
                ctx.fillStyle = '#A9A9A9'; // Grey
                ctx.fillRect(cursorX - 5, cursorY - 25, wordWidth - 5, 30);
                ctx.fillStyle = '#000000'; // Black text
                ctx.fillText(word, cursorX, cursorY);
            } else if (errorType == 'None') {
                // Regular words
                ctx.fillStyle = '#000000';
                ctx.fillText(word, cursorX, cursorY);
            }

            // Move cursor for the next word
            cursorX += wordWidth;
        });

        // Add the legends at the bottom
        ctx.font = '20px Arial';

        // Mispronounced Words Legend (Yellow Circle)
        ctx.fillStyle = '#FFD700'; // Yellow color
        ctx.beginPath(); // Start a new path
        ctx.arc(60, 820, 10, 0, 2 * Math.PI);
        ctx.fill(); // Fill the circle
        ctx.fillStyle = '#000000';
        ctx.fillText('Mispronounced Words', 80, 827);

        // Skipped Words Legend (Grey Circle)
        ctx.fillStyle = '#A9A9A9'; // Grey color
        ctx.beginPath(); // Start a new path
        ctx.arc(350, 820, 10, 0, 2 * Math.PI);
        ctx.fill(); // Fill the circle
        ctx.fillStyle = '#000000';
        ctx.fillText('Skipped Words', 370, 827);

        // Convert the canvas to a buffer
        const buffer = canvas.toBuffer('image/jpeg');

        // Upload to Azure Blob Storage
        const imageUrl = await azureBlobStorage.uploadImageToBlobStorage(buffer);
        return imageUrl;
    } catch (err) {
        console.log('Error creating and uploading image:', err);
        throw new Error('Failed to create and upload image');
    }
};

const createAndUploadKidsScoreImage = async (pronunciationAssessment, threshold, level) => {
    try {
        if (pronunciationAssessment === undefined || pronunciationAssessment == [] || pronunciationAssessment == null) {
            return null;
        };

        const fluencyScoreNumber = Math.round(pronunciationAssessment.scoreNumber.fluencyScore);
        let accuracyScoreNumber = Math.round(pronunciationAssessment.scoreNumber.accuracyScore);
        const words = pronunciationAssessment.words;

        const mispronouncedWordsList = pronunciationAssessment.words.filter(word =>
            word?.PronunciationAssessment?.ErrorType == "Mispronunciation" ||
            word?.PronunciationAssessment?.AccuracyScore < threshold
        );
        if (mispronouncedWordsList.length == 0 && accuracyScoreNumber > threshold) {
            accuracyScoreNumber = 100;
        }

        // Set up canvas dimensions
        const width = 900;
        const height = 850;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Draw background
        ctx.fillStyle = '#f2fdf7';
        ctx.fillRect(0, 0, width, height);

        // Add "Your Score" Title
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.fillText('Your Score', width / 2, 80);

        // Pronunciation section
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000000';
        ctx.fillText('Pronunciation', 225, 140);

        // Draw pronunciation semi-circle arc
        const pronunciationCenterX = 225;
        const pronunciationCenterY = 280;
        const arcRadius = 100;
        const arcWidth = 35;

        // Background arc (light pink)
        ctx.beginPath();
        ctx.arc(pronunciationCenterX, pronunciationCenterY, arcRadius, Math.PI, 0, false);
        ctx.lineWidth = arcWidth;
        ctx.strokeStyle = '#f7b7cc';
        ctx.stroke();

        // Foreground arc (dark pink) - score percentage
        const pronunciationAngle = Math.PI * (accuracyScoreNumber / 100);
        ctx.beginPath();
        ctx.arc(pronunciationCenterX, pronunciationCenterY, arcRadius, Math.PI, Math.PI + pronunciationAngle, false);
        ctx.lineWidth = arcWidth;
        ctx.strokeStyle = '#f94e6b';
        ctx.stroke();

        // Pronunciation score text - inside the arc, positioned higher
        ctx.font = 'bold 36px Arial';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.fillText(`${accuracyScoreNumber}%`, pronunciationCenterX, pronunciationCenterY - 20);

        // Fluency section
        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.fillText('Fluency', 675, 140);

        // Draw fluency semi-circle arc
        const fluencyCenterX = 675;
        const fluencyCenterY = 280;

        // Background arc (light teal)
        ctx.beginPath();
        ctx.arc(fluencyCenterX, fluencyCenterY, arcRadius, Math.PI, 0, false);
        ctx.lineWidth = arcWidth;
        ctx.strokeStyle = '#95eaf1';
        ctx.stroke();

        // Foreground arc (dark teal) - score percentage
        const fluencyAngle = Math.PI * (fluencyScoreNumber / 100);
        ctx.beginPath();
        ctx.arc(fluencyCenterX, fluencyCenterY, arcRadius, Math.PI, Math.PI + fluencyAngle, false);
        ctx.lineWidth = arcWidth;
        ctx.strokeStyle = '#51bccc';
        ctx.stroke();

        // Fluency score text - inside the arc, positioned higher
        ctx.font = 'bold 36px Arial';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.fillText(`${fluencyScoreNumber}%`, fluencyCenterX, fluencyCenterY - 20);

        // Load and add the avatars positioned above the "You said" box
        const avatarImage = await loadImage(`https://beajbloblive.blob.core.windows.net/beajdocuments/level${level}_scorecard_avatars.png`);

        // "You said" section with rounded rectangle
        ctx.font = 'bold 30px Arial';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.fillText('You said', width / 2, 420);

        // Draw large rounded rectangle for "You said" content
        const youSaidRectX = 50;
        const youSaidRectY = 440;
        const youSaidRectWidth = 800;
        const youSaidRectHeight = 180;
        const cornerRadius = 20;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(youSaidRectX, youSaidRectY, youSaidRectWidth, youSaidRectHeight, cornerRadius);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Position avatars above the "You said" rectangle - way bigger
        if (level == 1) {
            const avatarSize = 550;
            // Left avatar (girl) - positioned on left edge of "You said" box
            ctx.drawImage(avatarImage, 0, 0, avatarImage.width / 2, avatarImage.height,
                youSaidRectX - 150, youSaidRectY - avatarSize + 178, avatarSize, avatarSize);
            // Right avatar (boy) - positioned on right edge of "You said" box
            ctx.drawImage(avatarImage, avatarImage.width / 2, 0, avatarImage.width / 2, avatarImage.height,
                youSaidRectX + youSaidRectWidth - avatarSize + 150, youSaidRectY - avatarSize + 178, avatarSize, avatarSize);
        } else if (level == 2) {
            const avatarSize = 530;
            // Left avatar (girl) - positioned more to the left
            ctx.drawImage(avatarImage, 0, 0, avatarImage.width / 2, avatarImage.height,
                youSaidRectX - 180, youSaidRectY - avatarSize + 175, avatarSize, avatarSize);
            // Right avatar (boy) - positioned more to the right
            ctx.drawImage(avatarImage, avatarImage.width / 2, 0, avatarImage.width / 2, avatarImage.height,
                youSaidRectX + youSaidRectWidth - avatarSize + 170, youSaidRectY - avatarSize + 175, avatarSize, avatarSize);
        } else if (level == 3) {
            const avatarSize = 500;
            // Left avatar (girl) - positioned more to the left
            ctx.drawImage(avatarImage, 0, 0, avatarImage.width / 2, avatarImage.height,
                youSaidRectX - 120, youSaidRectY - avatarSize + 170, avatarSize, avatarSize);
            // Right avatar (boy) - positioned more to the right
            ctx.drawImage(avatarImage, avatarImage.width / 2, 0, avatarImage.width / 2, avatarImage.height,
                youSaidRectX + youSaidRectWidth - avatarSize + 130, youSaidRectY - avatarSize + 165, avatarSize, avatarSize);
        }

        // Function to wrap text
        function wrapText(text, maxWidth) {
            const words = text.split(' ');
            const lines = [];
            let currentLine = words[0];

            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = ctx.measureText(currentLine + ' ' + word).width;
                if (width < maxWidth) {
                    currentLine += ' ' + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);
            return lines;
        }

        // Add all words to "You said" section
        let youSaidText = '';
        words.forEach((wordObj, index) => {
            if (wordObj && wordObj.PronunciationAssessment) {
                if (!['Mispronunciation', 'Omission', 'None'].includes(wordObj.PronunciationAssessment.ErrorType)) {
                    return;
                }
                const errorType = wordObj.PronunciationAssessment.ErrorType;
                if (errorType == 'Omission') {
                    return;
                }
                let word = wordObj.Word;
                if (index === 0) {
                    word = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                } else {
                    word = word.toLowerCase();
                }
                youSaidText += (index > 0 ? ' ' : '') + word;
            }
        });

        // Draw wrapped text in "You said" rectangle
        ctx.font = '24px Arial';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';
        const youSaidLines = wrapText(youSaidText, youSaidRectWidth - 40);
        const lineHeight = 28;
        const startY = youSaidRectY + 35;

        youSaidLines.slice(0, 6).forEach((line, index) => {
            ctx.fillText(line, youSaidRectX + 20, startY + (index * lineHeight));
        });

        // "Mispronounced Words" section
        ctx.font = 'bold 30px Arial';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.fillText('Mispronounced Words', width / 2, 670);

        // Draw rounded rectangle for mispronounced words
        const mispronRectX = 50;
        const mispronRectY = 690;
        const mispronRectWidth = 800;
        const mispronRectHeight = 140;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(mispronRectX, mispronRectY, mispronRectWidth, mispronRectHeight, cornerRadius);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Add mispronounced words text
        let mispronText = '';
        if (mispronouncedWordsList.length > 0) {
            mispronouncedWordsList.forEach((wordObj, index) => {
                let word = wordObj.Word;
                if (index === 0) {
                    word = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                } else {
                    word = word.toLowerCase();
                }
                mispronText += (index > 0 ? ', ' : '') + word;
            });
        }

        // Draw wrapped mispronounced words text
        ctx.font = '24px Arial';
        ctx.fillStyle = '#ff0000';
        ctx.textAlign = 'left';
        if (mispronText != '') {
            const mispronLines = wrapText(mispronText, mispronRectWidth - 40);
            const mispronStartY = mispronRectY + 35;

            mispronLines.slice(0, 4).forEach((line, index) => {
                ctx.fillText(line, mispronRectX + 20, mispronStartY + (index * lineHeight));
            });
        }

        // Convert the canvas to a buffer
        const buffer = canvas.toBuffer('image/jpeg');

        // Upload to Azure Blob Storage
        const imageUrl = await azureBlobStorage.uploadImageToBlobStorage(buffer);
        return imageUrl;
    } catch (err) {
        console.log('Error creating and uploading image:', err);
        throw new Error('Failed to create and upload image');
    }
};

const createAndUploadMonologueScoreImage = async (pronunciationAssessment, threshold) => {
    try {
        if (pronunciationAssessment === undefined || pronunciationAssessment == [] || pronunciationAssessment == null) {
            return null;
        };

        const fluencyScoreNumber = Math.round(pronunciationAssessment.scoreNumber.fluencyScore);
        let accuracyScoreNumber = Math.round(pronunciationAssessment.scoreNumber.accuracyScore);
        const words = pronunciationAssessment.words;

        const mispronouncedWordsList = pronunciationAssessment.words.filter(word =>
            word && word.PronunciationAssessment &&
            (word.PronunciationAssessment.ErrorType == "Mispronunciation" ||
                word.PronunciationAssessment.AccuracyScore < threshold)
        );
        if (mispronouncedWordsList.length == 0 && accuracyScoreNumber > threshold) {
            accuracyScoreNumber = 100;
        }

        // Set up canvas dimensions
        const width = 900;
        const height = 850;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Draw background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Load and add the company logo in the top - right corner
        const image = await loadImage("https://beajbloblive.blob.core.windows.net/beajdocuments/logo.jpeg");  // Path to the logo image
        ctx.drawImage(image, width - 160, 20, image.width / 7.5, image.height / 7.5);

        // Add "YOUR SCORE" Title
        ctx.font = 'bold 40px Arial';
        ctx.fillStyle = '#000000';
        ctx.fillText('YOUR SCORE', 50, 80);

        // Add "Completeness" Bar with dynamic score
        ctx.font = '25px Arial';
        ctx.fillText('Correct Pronunciation', 50, 120);

        // Draw light magenta background bar for full length
        ctx.fillStyle = '#eecef7';
        ctx.fillRect(50, 125, 790, 40);

        // Draw dark magenta foreground bar for actual score
        ctx.fillStyle = '#cb6ce6';
        ctx.fillRect(50, 125, 790 * (accuracyScoreNumber / 100), 40);

        // Add score text inside the bar
        ctx.fillStyle = '#000000';
        // Position till the end of dark magenta bar
        ctx.fillText(`${accuracyScoreNumber}%`, 50 + 790 * (accuracyScoreNumber / 100) - 70, 155);


        // Add "Pronunciation" Bar with dynamic score
        ctx.font = '25px Arial';
        ctx.fillText('Fluency', 50, 215);

        // Draw light blue background bar for full length
        ctx.fillStyle = '#B2EBF2';
        ctx.fillRect(50, 220, 790, 40);

        // Draw dark blue foreground bar for actual score
        ctx.fillStyle = '#30D5C8';
        ctx.fillRect(50, 220, 790 * (fluencyScoreNumber / 100), 40);

        // Add score text inside the bar
        ctx.fillStyle = '#000000';
        // Position till the end of dark blue bar
        ctx.fillText(`${fluencyScoreNumber}%`, 50 + 790 * (fluencyScoreNumber / 100) - 70, 250);

        ctx.font = 'bold 30px Arial';
        ctx.fillText('You said:', 50, 315);

        // Create a paragraph format for the text
        ctx.font = '25px Arial';
        const marginLeft = 50;
        const maxWidth = 850;
        let lineHeight = 40;
        let cursorX = marginLeft;
        let cursorY = 355; // Starting Y position for the text

        // Loop through words and handle line breaks
        words.forEach((wordObj) => {
            // If undefined, skip the word
            if (wordObj == undefined || !wordObj.PronunciationAssessment) {
                return;
            }

            // If not Mispronunciation, Omission, or None, skip the word
            if (!['Mispronunciation', 'Omission', 'None'].includes(wordObj.PronunciationAssessment.ErrorType)) {
                return;
            }
            const word = wordObj.Word;
            const errorType = wordObj.PronunciationAssessment.ErrorType;
            const wordAccuracyScore = wordObj.PronunciationAssessment.AccuracyScore;
            const wordWidth = ctx.measureText(word).width + 15; // Measure width of the word

            // If the word exceeds the max width, move to a new line
            if (cursorX + wordWidth > maxWidth) {
                cursorX = marginLeft; // Reset X position to the left margin
                cursorY += lineHeight; // Move to the next line
            }

            if (errorType == 'Mispronunciation' || wordAccuracyScore < threshold) {
                // Highlight mispronounced words in yellow
                ctx.fillStyle = '#FFD700'; // Yellow
                ctx.fillRect(cursorX - 5, cursorY - 25, wordWidth - 5, 30);
                ctx.fillStyle = '#000000'; // Black text
                ctx.fillText(word, cursorX, cursorY);
            } else {
                // Regular words
                ctx.fillStyle = '#000000';
                ctx.fillText(word, cursorX, cursorY);
            }

            // Move cursor for the next word
            cursorX += wordWidth;
        });

        // Add the legends at the bottom
        ctx.font = '20px Arial';

        // Mispronounced Words Legend (Yellow Circle)
        ctx.fillStyle = '#FFD700'; // Yellow color
        ctx.beginPath(); // Start a new path
        ctx.arc(60, 820, 10, 0, 2 * Math.PI);
        ctx.fill(); // Fill the circle
        ctx.fillStyle = '#000000';
        ctx.fillText('Mispronounced Words', 80, 827);

        // Convert the canvas to a buffer
        const buffer = canvas.toBuffer('image/jpeg');

        // Upload to Azure Blob Storage
        const imageUrl = await azureBlobStorage.uploadImageToBlobStorage(buffer);
        return imageUrl;
    } catch (err) {
        console.log('Error creating and uploading image:', err);
        throw new Error('Failed to create and upload image');
    }
};

const createAndUploadSpeakingPracticeScoreImage = async (pronunciationAssessments, threshold) => {
    try {
        if (pronunciationAssessments === undefined || pronunciationAssessments == [] || pronunciationAssessments == null) {
            return null;
        };

        let totalFluencyScore = 0;
        let totalAccuracyScore = 0;
        let allWords = [];

        pronunciationAssessments.forEach(assessment => {
            totalFluencyScore += Math.round(assessment.scoreNumber.fluencyScore || 0);
            totalAccuracyScore += Math.round(assessment.scoreNumber.accuracyScore || 0);
            if (assessment.words && Array.isArray(assessment.words)) {
                allWords = [...allWords, ...assessment.words];
            }
        });

        const avgFluencyScore = Math.round(totalFluencyScore / pronunciationAssessments.length);
        const avgAccuracyScore = Math.round(totalAccuracyScore / pronunciationAssessments.length);

        const width = 900;
        const height = 950;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Draw background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Load and add the company logo in the top - right corner
        const image = await loadImage("https://beajbloblive.blob.core.windows.net/beajdocuments/logo.jpeg");  // Path to the logo image
        ctx.drawImage(image, width - 160, 20, image.width / 7.5, image.height / 7.5);

        // Add "YOUR SCORE" Title
        ctx.font = 'bold 40px Arial';
        ctx.fillStyle = '#000000';
        ctx.fillText('YOUR SCORE', 50, 80);

        // Add "Completeness" Bar with dynamic score
        ctx.font = '25px Arial';
        ctx.fillText('Correct Pronunciation', 50, 120);

        // Draw light magenta background bar for full length
        ctx.fillStyle = '#eecef7';
        ctx.fillRect(50, 125, 790, 40);

        // Draw dark magenta foreground bar for actual score
        ctx.fillStyle = '#cb6ce6';
        ctx.fillRect(50, 125, 790 * (avgAccuracyScore / 100), 40);

        // Add score text inside the bar
        ctx.fillStyle = '#000000';
        // Position till the end of dark magenta bar
        ctx.fillText(`${avgAccuracyScore}%`, 50 + 790 * (avgAccuracyScore / 100) - 70, 155);

        // Add "Pronunciation" Bar with dynamic score
        ctx.font = '25px Arial';
        ctx.fillText('Fluency', 50, 215);

        // Draw light blue background bar for full length
        ctx.fillStyle = '#B2EBF2';
        ctx.fillRect(50, 220, 790, 40);

        // Draw dark blue foreground bar for actual score
        ctx.fillStyle = '#30D5C8';
        ctx.fillRect(50, 220, 790 * (avgFluencyScore / 100), 40);

        // Add score text inside the bar
        ctx.fillStyle = '#000000';
        // Position till the end of dark blue bar
        ctx.fillText(`${avgFluencyScore}%`, 50 + 790 * (avgFluencyScore / 100) - 70, 250);

        ctx.font = 'bold 30px Arial';
        ctx.fillText('You said:', 50, 305);

        // Create a paragraph format for the text
        ctx.font = '17px Arial';
        const marginLeft = 50;
        const maxWidth = 850;
        let lineHeight = 40;
        let cursorX = marginLeft;
        let cursorY = 345; // Starting Y position for the text

        // Loop through words and handle line breaks
        allWords.forEach(wordObj => {
            if (wordObj == undefined || !wordObj.PronunciationAssessment) {
                return;
            }
            if (!['Mispronunciation', 'None'].includes(wordObj.PronunciationAssessment.ErrorType)) {
                return;
            }
            const word = wordObj.Word;
            const errorType = wordObj.PronunciationAssessment.ErrorType;
            if (errorType == 'Omission') {
                return;
            }
            const wordAccuracyScore = wordObj.PronunciationAssessment.AccuracyScore;
            const wordWidth = ctx.measureText(word).width + 13; // Measure width of the word

            // If the word exceeds the max width, move to a new line
            if (cursorX + wordWidth > maxWidth) {
                cursorX = marginLeft; // Reset X position to the left margin
                cursorY += lineHeight; // Move to the next line
            }

            if (errorType == 'Mispronunciation' || wordAccuracyScore < threshold) {
                // Highlight mispronounced words in yellow
                ctx.fillStyle = '#FFD700'; // Yellow
                ctx.fillRect(cursorX - 5, cursorY - 25, wordWidth - 5, 30);
                ctx.fillStyle = '#000000'; // Black text
                ctx.fillText(word, cursorX, cursorY);
            } else {
                // Regular words
                ctx.fillStyle = '#000000';
                ctx.fillText(word, cursorX, cursorY);
            }

            // Move cursor for the next word
            cursorX += wordWidth;
        });

        // Add the legends at the bottom
        ctx.font = '20px Arial';

        // Mispronounced Words Legend (Yellow Circle)
        ctx.fillStyle = '#FFD700'; // Yellow color
        ctx.beginPath(); // Start a new path
        ctx.arc(60, 920, 10, 0, 2 * Math.PI);
        ctx.fill(); // Fill the circle
        ctx.fillStyle = '#000000';
        ctx.fillText('Mispronounced Words', 80, 927);

        // Convert the canvas to a buffer
        const buffer = canvas.toBuffer('image/jpeg');

        // Upload to Azure Blob Storage
        const imageUrl = await azureBlobStorage.uploadImageToBlobStorage(buffer);
        return imageUrl;
    } catch (err) {
        console.log('Error creating and uploading image:', err);
        throw new Error('Failed to create and upload image');
    }
};

const generateInvoiceImage = async (userMobileNumber, registrationsSummary) => {
    try {
        // Set physical dimensions (smaller visually but higher resolution for quality)
        const physicalWidth = 800;  // Physical width in pixels (wider for landscape)
        const physicalHeight = 450; // Physical height in pixels (shorter for landscape)

        // Set a higher DPI scaling factor for better text quality
        const scaleFactor = 3;  // 3x resolution for crisp text

        // Create high-resolution canvas
        const width = physicalWidth * scaleFactor;
        const height = physicalHeight * scaleFactor;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Scale all drawing operations
        ctx.scale(scaleFactor, scaleFactor);

        // Set background to white
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, physicalWidth, physicalHeight);

        // Top section - make more compact
        const marginX = 25;
        const marginY = 20;

        // Load and draw logo
        const logo = await loadImage("https://beajbloblive.blob.core.windows.net/beajdocuments/logo1.png");
        ctx.drawImage(logo, marginX - 20, marginY - 15, 100, 67);

        // Draw "INVOICE" text
        ctx.font = 'bold 35px Mont';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'right';
        ctx.fillText('INVOICE', physicalWidth - marginX, marginY + 35);
        ctx.textAlign = 'left';

        // Billing section - more compact
        const headerY = marginY + 65;
        ctx.font = 'bold 11px Garet';
        ctx.textAlign = 'left';
        ctx.fillText('BILLING TO:', marginX, headerY);
        ctx.fillText(userMobileNumber, marginX, headerY + 15);

        // Invoice details section
        const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        ctx.textAlign = 'right';
        ctx.fillText(`Invoice Date : ${today}`, physicalWidth - marginX, headerY);
        ctx.textAlign = 'left';

        // Table headers - positioned to allow for many rows
        const tableTop = headerY + 35;
        const tableWidth = physicalWidth - (marginX * 2);
        const colWidth1 = tableWidth * 0.08;  // Sr No. (smaller)
        const colWidth2 = tableWidth * 0.34;  // Student Name (wider)
        const colWidth3 = tableWidth * 0.34;  // Student Class (wider)
        const colWidth4 = tableWidth * 0.24;  // Price

        // Make rows smaller to fit more
        const rowHeight = 18;

        // Draw table header background colors
        ctx.fillStyle = '#DBDF10'; // Yellow green color
        ctx.fillRect(marginX, tableTop, colWidth1, rowHeight); // Sr No.
        ctx.fillRect(marginX + colWidth1, tableTop, colWidth2, rowHeight); // Student Name
        ctx.fillRect(marginX + colWidth1 + colWidth2, tableTop, colWidth3, rowHeight); // Student Class
        ctx.fillStyle = '#75C5D3'; // Light blue color
        ctx.fillRect(marginX + colWidth1 + colWidth2 + colWidth3, tableTop, colWidth4, rowHeight); // Price

        // Header text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Garet';
        ctx.fillText('Sr No.', marginX + 5, tableTop + 14);
        ctx.fillText('Student Name', marginX + colWidth1 + 5, tableTop + 14);
        ctx.fillText('Student Class', marginX + colWidth1 + colWidth2 + 5, tableTop + 14);
        ctx.fillText('PRICE', marginX + colWidth1 + colWidth2 + colWidth3 + 5, tableTop + 14);

        // Get total registrations and prepare rows
        const totalRegistrations = registrationsSummary.count;
        let perCoursePrice = await waUserActivityLogsRepository.getStudentCoursePriceByFirstMessage(userMobileNumber);
        if (totalRegistrations > 1 && perCoursePrice == 1500) {
            perCoursePrice = 1200; // Discounted price for multiple registrations
        }

        // Convert registrations to rows for rendering
        const rows = registrationsSummary.registrations.map((reg, index) => ({
            srNo: (index + 1).toString(),
            name: reg.name,
            className: reg.classLevel,
            price: `PKR ${perCoursePrice.toLocaleString()}`
        }));

        // Calculate total
        const totalAmount = totalRegistrations * perCoursePrice;

        // Table content - render all rows
        ctx.fillStyle = '#000000';
        ctx.font = '12px Garet';

        rows.forEach((row, index) => {
            const y = tableTop + rowHeight + (index * rowHeight) + 14;
            ctx.fillText(row.srNo, marginX + 5, y);
            ctx.fillText(row.name, marginX + colWidth1 + 5, y);
            ctx.fillText(row.className, marginX + colWidth1 + colWidth2 + 5, y);

            // Right align the price text
            ctx.textAlign = 'right';
            ctx.fillText(row.price, marginX + colWidth1 + colWidth2 + colWidth3 + colWidth4 - 5, y);
            ctx.textAlign = 'left';

            // Draw a light horizontal line after each row except the last one
            if (index < rows.length - 1) {
                ctx.strokeStyle = '#EEEEEE';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(marginX, tableTop + rowHeight + (index + 1) * rowHeight);
                ctx.lineTo(physicalWidth - marginX, tableTop + rowHeight + (index + 1) * rowHeight);
                ctx.stroke();
            }
        });

        // Draw a horizontal line after the last row
        ctx.strokeStyle = '#CCCCCC';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(marginX, tableTop + rowHeight + (rows.length * rowHeight));
        ctx.lineTo(physicalWidth - marginX, tableTop + rowHeight + (rows.length * rowHeight));
        ctx.stroke();

        // Add watermark
        const watermarkLogo = await loadImage('https://beajbloblive.blob.core.windows.net/beajdocuments/logo1.png');
        ctx.globalAlpha = 0.15; // Less transparent
        ctx.drawImage(watermarkLogo, physicalWidth / 2 - 150, physicalHeight / 2 - 75, 300, 150); // Adjusted for landscape
        ctx.globalAlpha = 1.0; // Reset transparency

        // Total section - position at end of table or with fixed offset from bottom
        // Calculate position based on table size
        const tableBottom = tableTop + rowHeight + (rows.length * rowHeight) + 15;
        const totalY = Math.min(tableBottom, physicalHeight - 50); // Don't let it overlap with footer

        ctx.font = 'bold 12px Garet';
        ctx.textAlign = 'right';
        ctx.fillText('TOTAL', physicalWidth - marginX - 70, totalY);
        ctx.fillText(`PKR ${totalAmount.toLocaleString()}`, physicalWidth - marginX, totalY);
        ctx.textAlign = 'left';

        const footerHeight = physicalHeight - 25;

        // Draw footer background with diagonal cut - adjusted for landscape
        ctx.fillStyle = '#DBDF10'; // Yellow green color
        ctx.beginPath();
        ctx.moveTo(0, footerHeight);
        ctx.lineTo(physicalWidth / 2 + 50, footerHeight); // Wider cut for landscape
        ctx.lineTo(physicalWidth / 2 + 30, footerHeight + 25);
        ctx.lineTo(0, footerHeight + 25);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#75C5D3'; // Light blue color
        ctx.beginPath();
        ctx.moveTo(physicalWidth / 2 + 50, footerHeight);
        ctx.lineTo(physicalWidth, footerHeight);
        ctx.lineTo(physicalWidth, footerHeight + 25);
        ctx.lineTo(physicalWidth / 2 + 30, footerHeight + 25);
        ctx.closePath();
        ctx.fill();

        // Footer text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px Garet'; // Slightly smaller font

        // Phone icon placeholder and number
        ctx.fillText(`☎ ${userMobileNumber}`, marginX + 10, footerHeight + 17);

        // Email icon placeholder and email
        ctx.textAlign = 'right';
        // Draw larger email icon
        ctx.font = 'bold 16px Garet'; // Slightly smaller icon
        ctx.fillText('✉', physicalWidth - marginX - 8 - ctx.measureText("info@beaj.org").width, footerHeight + 17);
        // Switch back to regular font for email text
        ctx.font = 'bold 11px Garet';
        ctx.fillText(`info@beaj.org`, physicalWidth - marginX - 35, footerHeight + 16.5);
        ctx.textAlign = 'left';

        // Reset scale for saving
        ctx.scale(1 / scaleFactor, 1 / scaleFactor);

        // Convert the canvas to a buffer
        const buffer = canvas.toBuffer('image/png');

        // Upload to Azure Blob Storage
        const imageUrl = await azureBlobStorage.uploadImageToBlobStorage(buffer);
        return imageUrl;
    } catch (err) {
        console.log('Error creating and uploading invoice image:', err);
        throw new Error('Failed to create and upload invoice image');
    }
};

const level4ReportCard = async (details) => {
    const { name, grade, section, English } = details;
    const width = 594;
    const height = 810;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const backgroundImage = await loadImage('https://beajbloblive.blob.core.windows.net/beajdocuments/base_report_card.png');
    ctx.drawImage(backgroundImage, 0, 0, width, height);

    // Helper function to draw rounded rectangle
    function drawRoundedRect(x, y, width, height, radius, fillStyle, strokeStyle, lineWidth = 2) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();

        if (fillStyle) {
            ctx.fillStyle = fillStyle;
            ctx.fill();
        }

        if (strokeStyle) {
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
    }

    // Student Information Cards (headers removed as they're in background)
    const infoStartY = 220;

    // Student Name Card
    drawRoundedRect(50, infoStartY, 494, 45, 12, '#FFFFFF', '#e0e0e0', 2);
    ctx.font = '14px Mont';
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'left';
    ctx.fillText('Student Name', 70, infoStartY + 20);
    ctx.font = 'bold 20px Mont';
    ctx.fillStyle = '#000000';
    ctx.fillText(name, 70, infoStartY + 38);

    // Grade and Section Cards
    drawRoundedRect(50, infoStartY + 55, 240, 45, 12, '#FFFFFF', '#e0e0e0', 2);
    ctx.font = '14px Mont';
    ctx.fillStyle = '#666666';
    ctx.fillText('Grade', 70, infoStartY + 75);
    ctx.font = 'bold 18px Mont';
    ctx.fillStyle = '#000000';
    ctx.fillText(`Grade ${grade}`, 70, infoStartY + 93);

    drawRoundedRect(304, infoStartY + 55, 240, 45, 12, '#FFFFFF', '#e0e0e0', 2);
    ctx.font = '14px Mont';
    ctx.fillStyle = '#666666';
    ctx.fillText('Section', 324, infoStartY + 75);
    ctx.font = 'bold 18px Mont';
    ctx.fillStyle = '#000000';
    ctx.fillText(`Section ${section}`, 324, infoStartY + 93);

    // Colors
    const redColor = '#f94e6b';
    const purpleColor = '#8c52ff';

    // Helper function for progress bars
    function drawProgressBar(x, y, width, height, percentage, color) {
        // Background
        drawRoundedRect(x, y, width, height, height / 2, '#f0f0f0', null);

        // Progress fill
        const fillWidth = (percentage / 100) * width;
        if (fillWidth > 0) {
            drawRoundedRect(x, y, fillWidth, height, height / 2, color, null);
        }

        // Percentage text - aligned to a fixed position for consistency
        const originalFont = ctx.font;
        ctx.font = 'bold 16px Mont';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.fillText(`${percentage}%`, x + width + 35, y + height / 2 + 4);
        ctx.textAlign = 'left';
        ctx.font = originalFont; // Reset font
    }

    // Helper function to draw subject section
    function drawSubjectSection(x, y, cardWidth, cardHeight, subjectName, subjectData, color) {
        drawRoundedRect(x, y, cardWidth, cardHeight, 15, '#FFFFFF', '#e0e0e0', 2);

        // Subject header
        const headerWidth = subjectName.length * 10 + 20; // Dynamic width based on text length
        drawRoundedRect(x + 10, y + 10, headerWidth, 30, 15, color, null);
        ctx.font = 'bold 16px Mont';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(subjectName, x + 10 + headerWidth / 2, y + 29);

        // Total percentage
        ctx.font = 'bold 36px Mont';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(`${subjectData.Total}%`, x + cardWidth - 65, y + 32);

        ctx.font = '12px Mont';
        ctx.fillStyle = '#666666';
        ctx.textAlign = 'center';
        ctx.fillText('Total Score', x + cardWidth - 65, y + 47);

        // Skills with progress bars (exclude "Total" from skills)
        const skills = Object.keys(subjectData).filter(key => key !== 'Total');
        ctx.font = '14px Mont';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';

        skills.forEach((skill, index) => {
            const skillY = y + 70 + (index * 32);
            ctx.fillText(skill, x + 15, skillY);
            drawProgressBar(x + 15, skillY + 5, 120, 8, subjectData[skill], color);
        });
    }

    // Academic and Activity Sections - centered layout for 2 cards
    const sectionsY = 380;
    const cardWidth = 240;
    const cardHeight = 230;
    const leftCardX = 50; // Center the two cards
    const rightCardX = 304; // Center the two cards

    // English Section
    drawSubjectSection(leftCardX, sectionsY, cardWidth, cardHeight, 'English', English, redColor);

    // Life Skills Section
    const lifeSkillsY = sectionsY;
    drawRoundedRect(rightCardX, lifeSkillsY, cardWidth, cardHeight, 15, '#FFFFFF', '#e0e0e0', 2);

    // Life Skills header
    drawRoundedRect(rightCardX + 10, lifeSkillsY + 10, 100, 30, 15, purpleColor, null);
    ctx.font = 'bold 16px Mont';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('Life Skills', rightCardX + 60, lifeSkillsY + 29);

    // Activity count - properly aligned
    ctx.font = 'bold 36px Mont';
    ctx.fillStyle = purpleColor;
    ctx.textAlign = 'center';
    ctx.fillText('23', rightCardX + 175, lifeSkillsY + 40);

    ctx.font = '12px Mont';
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'center';
    ctx.fillText('Activities Completed', rightCardX + 175, lifeSkillsY + 55);

    // Topics
    ctx.font = '14px Mont';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';

    // Green checkmarks
    ctx.fillStyle = '#00d084';
    ctx.fillText('✓', rightCardX + 15, lifeSkillsY + 85);
    ctx.fillText('✓', rightCardX + 15, lifeSkillsY + 105);
    ctx.fillText('✓', rightCardX + 15, lifeSkillsY + 125);
    ctx.fillText('✓', rightCardX + 15, lifeSkillsY + 145);
    ctx.fillText('✓', rightCardX + 15, lifeSkillsY + 165);
    ctx.fillText('✓', rightCardX + 15, lifeSkillsY + 185);
    ctx.fillText('✓', rightCardX + 15, lifeSkillsY + 205);

    // Topic text
    ctx.fillStyle = '#000000';
    ctx.fillText('Growth Mindset', rightCardX + 30, lifeSkillsY + 85);
    ctx.fillText('How to Manage Anger', rightCardX + 30, lifeSkillsY + 105);
    ctx.fillText('Helping Others', rightCardX + 30, lifeSkillsY + 125);
    ctx.fillText('Dealing with Bullying', rightCardX + 30, lifeSkillsY + 145);
    ctx.fillText('Modern Technology', rightCardX + 30, lifeSkillsY + 165);
    ctx.fillText('Media Literacy', rightCardX + 30, lifeSkillsY + 185);
    ctx.fillText('Caring for Environment', rightCardX + 30, lifeSkillsY + 205);

    // Save the image
    const buffer = canvas.toBuffer('image/png');
    const imageUrl = await azureBlobStorage.uploadImageToBlobStorage(buffer);
    return imageUrl;
}

const kidsReportCard = async (details) => {
    const { name, grade, section, Maths, English } = details;
    const width = 594;
    const height = 810;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const backgroundImage = await loadImage('https://beajbloblive.blob.core.windows.net/beajdocuments/base_report_card.png');
    ctx.drawImage(backgroundImage, 0, 0, width, height);

    // Helper function to draw rounded rectangle
    function drawRoundedRect(x, y, width, height, radius, fillStyle, strokeStyle, lineWidth = 2) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();

        if (fillStyle) {
            ctx.fillStyle = fillStyle;
            ctx.fill();
        }

        if (strokeStyle) {
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
    }

    // Student Information Cards (headers removed as they're in background)
    const infoStartY = 180;

    // Student Name Card
    drawRoundedRect(50, infoStartY, 494, 45, 12, '#FFFFFF', '#e0e0e0', 2);
    ctx.font = '14px Mont';
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'left';
    ctx.fillText('Student Name', 70, infoStartY + 20);
    ctx.font = 'bold 20px Mont';
    ctx.fillStyle = '#000000';
    ctx.fillText(name, 70, infoStartY + 38);

    // Grade and Section Cards
    drawRoundedRect(50, infoStartY + 55, 240, 45, 12, '#FFFFFF', '#e0e0e0', 2);
    ctx.font = '14px Mont';
    ctx.fillStyle = '#666666';
    ctx.fillText('Grade', 70, infoStartY + 75);
    ctx.font = 'bold 18px Mont';
    ctx.fillStyle = '#000000';
    ctx.fillText(`Grade ${grade}`, 70, infoStartY + 93);

    drawRoundedRect(304, infoStartY + 55, 240, 45, 12, '#FFFFFF', '#e0e0e0', 2);
    ctx.font = '14px Mont';
    ctx.fillStyle = '#666666';
    ctx.fillText('Section', 324, infoStartY + 75);
    ctx.font = 'bold 18px Mont';
    ctx.fillStyle = '#000000';
    ctx.fillText(`Section ${section}`, 324, infoStartY + 93);

    // Colors
    const redColor = '#f94e6b';
    const purpleColor = '#8c52ff';

    // Helper function for progress bars
    function drawProgressBar(x, y, width, height, percentage, color) {
        // Background
        drawRoundedRect(x, y, width, height, height / 2, '#f0f0f0', null);

        // Progress fill
        const fillWidth = (percentage / 100) * width;
        if (fillWidth > 0) {
            drawRoundedRect(x, y, fillWidth, height, height / 2, color, null);
        }

        // Percentage text - aligned to a fixed position for consistency
        const originalFont = ctx.font;
        ctx.font = 'bold 16px Mont';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.fillText(`${percentage}%`, x + width + 35, y + height / 2 + 4);
        ctx.textAlign = 'left';
        ctx.font = originalFont; // Reset font
    }

    // Helper function to draw subject section
    function drawSubjectSection(x, y, cardWidth, cardHeight, subjectName, subjectData, color) {
        drawRoundedRect(x, y, cardWidth, cardHeight, 15, '#FFFFFF', '#e0e0e0', 2);

        // Subject header
        const headerWidth = subjectName.length * 10 + 20; // Dynamic width based on text length
        drawRoundedRect(x + 10, y + 10, headerWidth, 30, 15, color, null);
        ctx.font = 'bold 16px Mont';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(subjectName, x + 10 + headerWidth / 2, y + 29);

        // Total percentage
        ctx.font = 'bold 36px Mont';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(`${subjectData.Total}%`, x + cardWidth - 65, y + 32);

        ctx.font = '12px Mont';
        ctx.fillStyle = '#666666';
        ctx.textAlign = 'center';
        ctx.fillText('Total Score', x + cardWidth - 65, y + 47);

        // Skills with progress bars (exclude "Total" from skills)
        const skills = Object.keys(subjectData).filter(key => key !== 'Total');
        ctx.font = '14px Mont';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';

        skills.forEach((skill, index) => {
            const skillY = y + 70 + (index * 32);
            ctx.fillText(skill, x + 15, skillY);
            drawProgressBar(x + 15, skillY + 5, 120, 8, subjectData[skill], color);
        });
    }

    // Academic Sections
    const sectionsY = 290;
    const cardWidth = 240;
    const cardHeight = 230;

    // English Section
    drawSubjectSection(50, sectionsY, cardWidth, cardHeight, 'English', English, redColor);

    // Math Section
    drawSubjectSection(304, sectionsY, cardWidth, cardHeight, 'Math', Maths, redColor);

    // Activity Sections
    const activitiesY = sectionsY + 240;

    // Science Section
    drawRoundedRect(50, activitiesY, cardWidth, cardHeight, 15, '#FFFFFF', '#e0e0e0', 2);

    // Science header
    drawRoundedRect(60, activitiesY + 10, 90, 30, 15, purpleColor, null);
    ctx.font = 'bold 16px Mont';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('Science', 105, activitiesY + 29);

    // Activity count - properly aligned
    ctx.font = 'bold 36px Mont';
    ctx.fillStyle = purpleColor;
    ctx.textAlign = 'center';
    ctx.fillText('12', 225, activitiesY + 40);

    ctx.font = '12px Mont';
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'center';
    ctx.fillText('Activities Completed', 225, activitiesY + 55);

    // Topics
    ctx.font = '14px Mont';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';

    // Green checkmarks
    ctx.fillStyle = '#00d084';
    ctx.fillText('✓', 65, activitiesY + 85);
    ctx.fillText('✓', 65, activitiesY + 105);
    ctx.fillText('✓', 65, activitiesY + 125);
    ctx.fillText('✓', 65, activitiesY + 145);
    ctx.fillText('✓', 65, activitiesY + 165);
    ctx.fillText('✓', 65, activitiesY + 185);

    // Topic text
    ctx.fillStyle = '#000000';
    ctx.fillText('Natural Materials', 80, activitiesY + 85);
    ctx.fillText('Chemical Reactions', 80, activitiesY + 105);
    ctx.fillText('Forces', 80, activitiesY + 125);
    ctx.fillText('Gravity', 80, activitiesY + 145);
    ctx.fillText('Liquids and Gasses', 80, activitiesY + 165);
    ctx.fillText('Colour Mixing', 80, activitiesY + 185);

    // Life Skills Section
    drawRoundedRect(304, activitiesY, cardWidth, cardHeight, 15, '#FFFFFF', '#e0e0e0', 2);

    // Life Skills header
    drawRoundedRect(314, activitiesY + 10, 100, 30, 15, purpleColor, null);
    ctx.font = 'bold 16px Mont';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('Life Skills', 364, activitiesY + 29);

    // Activity count - properly aligned
    ctx.font = 'bold 36px Mont';
    ctx.fillStyle = purpleColor;
    ctx.textAlign = 'center';
    ctx.fillText('23', 479, activitiesY + 40);

    ctx.font = '12px Mont';
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'center';
    ctx.fillText('Activities Completed', 479, activitiesY + 55);

    // Topics
    ctx.font = '14px Mont';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';

    // Green checkmarks
    ctx.fillStyle = '#00d084';
    ctx.fillText('✓', 319, activitiesY + 85);
    ctx.fillText('✓', 319, activitiesY + 105);
    ctx.fillText('✓', 319, activitiesY + 125);
    ctx.fillText('✓', 319, activitiesY + 145);
    ctx.fillText('✓', 319, activitiesY + 165);
    ctx.fillText('✓', 319, activitiesY + 185);
    ctx.fillText('✓', 319, activitiesY + 205);

    // Topic text
    ctx.fillStyle = '#000000';
    ctx.fillText('Growth Mindset', 334, activitiesY + 85);
    ctx.fillText('How to Manage Anger', 334, activitiesY + 105);
    ctx.fillText('Helping Others', 334, activitiesY + 125);
    ctx.fillText('Dealing with Bullying', 334, activitiesY + 145);
    ctx.fillText('Modern Technology', 334, activitiesY + 165);
    ctx.fillText('Media Literacy', 334, activitiesY + 185);
    ctx.fillText('Caring for Environment', 334, activitiesY + 205);

    // Save the image
    const buffer = canvas.toBuffer('image/png');
    const imageUrl = await azureBlobStorage.uploadImageToBlobStorage(buffer);
    return imageUrl;
}

const generateKidsCertificate = async (name, level) => {
    const width = 1080;
    const height = 720;

    // Helper function to draw certificate content
    const drawCertificate = async (ctx) => {
        // Load the background image
        const backgroundImage = await loadImage(`https://beajbloblive.blob.core.windows.net/beajdocuments/level${level}_certificate.jpeg`);
        ctx.drawImage(backgroundImage, 0, 0, width, height);

        // Write the name in the white box
        // The white box appears to be centered horizontally and positioned around the middle-upper area
        ctx.font = 'bold 30px Arial';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Position the text in the center of the white box
        // Based on the image, the white box appears to be around x: 540, y: 360 (center of canvas)
        ctx.fillText(name, 540, 459);
    };

    // Create image version
    const imageCanvas = createCanvas(width, height);
    const imageCtx = imageCanvas.getContext('2d');
    await drawCertificate(imageCtx);
    const imageBuffer = imageCanvas.toBuffer('image/png');
    const imageUrl = await azureBlobStorage.uploadImageToBlobStorage(imageBuffer);

    // Create PDF version
    const pdfCanvas = createCanvas(width, height, 'pdf');
    const pdfCtx = pdfCanvas.getContext('2d');
    await drawCertificate(pdfCtx);
    const pdfBuffer = pdfCanvas.toBuffer('application/pdf');
    const pdfUrl = await azureBlobStorage.uploadPdfToBlobStorage(pdfBuffer);

    return { imageUrl, pdfUrl };
}

export {
    weekEndImage,
    createAndUploadScoreImage,
    createAndUploadMonologueScoreImage,
    createAndUploadSpeakingPracticeScoreImage,
    generateInvoiceImage,
    createAndUploadScoreImageNoAnswer,
    createAndUploadKidsScoreImage,
    level4ReportCard,
    kidsReportCard,
    generateKidsCertificate
};