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
            remark = "Excellent";
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
        mispronouncedWordsList.forEach((wordObj, index) => {
            let word = wordObj.Word;
            if (index === 0) {
                word = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            } else {
                word = word.toLowerCase();
            }
            mispronText += (index > 0 ? ', ' : '') + word;
        });

        // Draw wrapped mispronounced words text
        ctx.font = '24px Arial';
        ctx.fillStyle = '#ff0000';
        ctx.textAlign = 'left';
        const mispronLines = wrapText(mispronText || 'None', mispronRectWidth - 40);
        const mispronStartY = mispronRectY + 35;

        mispronLines.slice(0, 4).forEach((line, index) => {
            ctx.fillText(line, mispronRectX + 20, mispronStartY + (index * lineHeight));
        });

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

export {
    weekEndImage,
    createAndUploadScoreImage,
    createAndUploadMonologueScoreImage,
    createAndUploadSpeakingPracticeScoreImage,
    generateInvoiceImage,
    createAndUploadScoreImageNoAnswer,
    createAndUploadKidsScoreImage
};