import etlRepository from "../repositories/etlRepository.js";
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';
import { fileURLToPath } from 'url';
import { et } from "date-fns/locale";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getAllUserProgressService = async (botType, rollout, level, cohort, targetGroup, courseId1, courseId2, courseId3, courseId4, courseId5, module, assessmentView) => {
  let array_list = [];

  if (module === 'lesson') {
    array_list = await etlRepository.getLessonCompletions(botType, rollout, level, cohort, targetGroup, courseId1, courseId2, courseId3);
  }
  else if (module === 'week' && botType === 'teacher') {

    let weekly_score_l1_list = await etlRepository.getWeeklyScore(botType, rollout, level, cohort, targetGroup, courseId1);
    let weekly_score_l2_list = await etlRepository.getWeeklyScore(botType, rollout, level, cohort, targetGroup, courseId2);
    let weekly_score_l3_list = await etlRepository.getWeeklyScore(botType, rollout, level, cohort, targetGroup, courseId3);

    for (let i = 0; i < weekly_score_l1_list.length; i++) {

      const l1_entry = weekly_score_l1_list[i];
      const l2_entry = weekly_score_l2_list[i];
      const l3_entry = weekly_score_l3_list[i];

      array_list.push([
        l1_entry.sr_no,
        l1_entry.profile_id,
        l1_entry.phoneNumber,
        l1_entry.name,
        l1_entry.final_percentage_week1,
        l1_entry.final_percentage_week2,
        l1_entry.final_percentage_week3,
        l1_entry.final_percentage_week4,
        l2_entry.final_percentage_week1,
        l2_entry.final_percentage_week2,
        l2_entry.final_percentage_week3,
        l2_entry.final_percentage_week4,
        l3_entry.final_percentage_week1,
        l3_entry.final_percentage_week2,
        l3_entry.final_percentage_week3,
        l3_entry.final_percentage_week4,
      ])
    }
    array_list = array_list.map(obj => Object.values(obj).map(value => value));
    array_list = capitalizeNames(array_list);
    let leaderboardBase64 = [];
    // let columnIndex = await getColumnIndexWithPercentageValues(array_list, 1);
    for (let j = 4; j < 16; j++) {
      const buffer = await generateStarTeachersImage(array_list, j);

      // Convert buffer to base64 string
      // leaderboardBase64 = buffer.toString('base64');
      if (buffer) {
        leaderboardBase64.push({
          columnIndex: j,
          imageBase64: buffer.toString('base64')
        });
      }
    }
    return {
      array_list: array_list,
      leaderboard: leaderboardBase64,
    };
  }
  else if (module === 'activity') {
    array_list = await etlRepository.getActivity_Completions(botType, rollout, level, cohort, targetGroup, courseId1, courseId2, courseId3);
  }
  else if (module === 'assessment') {
    let array_list_Pre = await etlRepository.getActivityAssessmentScoreDay(botType, rollout, level, cohort, targetGroup, courseId4, assessmentView);
    let array_listt_Post = await etlRepository.getActivityAssessmentScoreDay(botType, rollout, level, cohort, targetGroup, courseId5, assessmentView);
    
    let totalRow = [], arrayT1_List01 = [];

    let maxL1 = {
      total_mcqs: 0,
      total_mcqs: 0,
      day1_mcqs_total: 0,
      day2_mcqs_total: 0,
      day3_mcqs_total: 0,
    };

    let maxL2 = {
      total_mcqs: 0,
      total_mcqs: 0,
      day1_mcqs_total: 0,
      day2_mcqs_total: 0,
      day3_mcqs_total: 0,
    };

    if (level === 'grade 7' || botType === 'teacher') {
      maxL1.total_speaking_practice = 0;
      maxL2.total_speaking_practice = 0;
    }
    else {
      maxL1.total_watchandspeak = 0;
      maxL2.total_watchandspeak = 0;
    }

    if(assessmentView === 'week') {
     
    for (let i = 0; i < array_list_Pre.length; i++) {
      let l1_entry = array_list_Pre[i];
      let l2_entry = array_listt_Post[i];

      // Update max totals for L1
      maxL1.total_mcqs = Math.max(maxL1.total_mcqs, l1_entry.total_mcqs);

      // Update max totals for L2
      maxL2.total_mcqs = Math.max(maxL2.total_mcqs, l2_entry.total_mcqs);

      if (level === 'grade 7' || botType === 'teacher') {
        maxL1.total_speaking_practice = Math.max(maxL1.total_speaking_practice, l1_entry.total_speaking_practice);
        maxL2.total_speaking_practice = Math.max(maxL2.total_speaking_practice, l2_entry.total_speaking_practice);
        // Your existing array push
        arrayT1_List01.push([
          i + 1,
          l1_entry.profile_id,
          l1_entry.phoneNumber,
          l1_entry.name,
          l1_entry.total_mcqs_score,
          l1_entry.day1_sp,
          l1_entry.total_score,
          null,
          l2_entry.total_mcqs_score,
          l2_entry.day1_sp,
          l2_entry.total_score,
        ]);
      }
      else {
        maxL1.total_watchandspeak = Math.max(maxL1.total_watchandspeak, l1_entry.total_watchandspeak);
        maxL2.total_watchandspeak = Math.max(maxL2.total_watchandspeak, l2_entry.total_watchandspeak);
        // Your existing array push
        arrayT1_List01.push([
          i + 1,
          l1_entry.profile_id,
          l1_entry.phoneNumber,
          l1_entry.name,
          l1_entry.total_mcqs_score,
          l1_entry.day1_ws,
          l1_entry.total_score,
          null,
          l2_entry.total_mcqs_score,
          l2_entry.day1_ws,
          l2_entry.total_score,
        ]);
      }
    }
    if (level === 'grade 7' || botType === 'teacher') {
      totalRow = [
        null,
        null,
        null,
        null,
        maxL1.total_mcqs,
        maxL1.total_speaking_practice,
        maxL1.total_mcqs + maxL1.total_speaking_practice,
        null,
        maxL2.total_mcqs,
        maxL2.total_speaking_practice,
        maxL2.total_mcqs + maxL2.total_speaking_practice,
      ];
    }
    else {
      totalRow = [
        null,
        null,
        null,
        null,
        maxL1.total_mcqs,
        maxL1.total_watchandspeak,
        maxL1.total_mcqs + maxL1.total_watchandspeak,
        null,
        maxL2.total_mcqs,
        maxL2.total_watchandspeak,
        maxL2.total_mcqs + maxL2.total_watchandspeak,
      ];
    }
    }
    else{

    for (let i = 0; i < array_list_Pre.length; i++) {
      let l1_entry = array_list_Pre[i];
      let l2_entry = array_listt_Post[i];

      // Update max totals for L1
      maxL1.day1_mcqs_total = Math.max(maxL1.day1_mcqs_total, l1_entry.day1_mcqs_total);
      maxL1.day2_mcqs_total = Math.max(maxL1.day2_mcqs_total, l1_entry.day2_mcqs_total);
      maxL1.day3_mcqs_total = Math.max(maxL1.day3_mcqs_total, l1_entry.day3_mcqs_total);
      maxL1.total_mcqs = Math.max(maxL1.total_mcqs, l1_entry.total_mcqs);

      // Update max totals for L2
      maxL2.day1_mcqs_total = Math.max(maxL2.day1_mcqs_total, l2_entry.day1_mcqs_total);
      maxL2.day2_mcqs_total = Math.max(maxL2.day2_mcqs_total, l2_entry.day2_mcqs_total);
      maxL2.day3_mcqs_total = Math.max(maxL2.day3_mcqs_total, l2_entry.day3_mcqs_total);
      maxL2.total_mcqs = Math.max(maxL2.total_mcqs, l2_entry.total_mcqs);

      if (level === 'grade 7' || botType === 'teacher') {
        maxL1.total_speaking_practice = Math.max(maxL1.total_speaking_practice, l1_entry.total_speaking_practice);
        maxL2.total_speaking_practice = Math.max(maxL2.total_speaking_practice, l2_entry.total_speaking_practice);
        // Your existing array push
        arrayT1_List01.push([
          i + 1,
          l1_entry.profile_id,
          l1_entry.phoneNumber,
          l1_entry.name,
          l1_entry.day1_mcqs,
          l1_entry.day2_mcqs,
          l1_entry.day3_mcqs,
          l1_entry.total_mcqs_score,
          l1_entry.day1_sp,
          l1_entry.total_score,
          null,
          l2_entry.day1_mcqs,
          l2_entry.day2_mcqs,
          l2_entry.day3_mcqs,
          l2_entry.total_mcqs_score,
          l2_entry.day1_sp,
          l2_entry.total_score,
        ]);
      }
      else {
        maxL1.total_watchandspeak = Math.max(maxL1.total_watchandspeak, l1_entry.total_watchandspeak);
        maxL2.total_watchandspeak = Math.max(maxL2.total_watchandspeak, l2_entry.total_watchandspeak);
        // Your existing array push
        arrayT1_List01.push([
          i + 1,
          l1_entry.profile_id,
          l1_entry.phoneNumber,
          l1_entry.name,
          l1_entry.day1_mcqs,
          l1_entry.day2_mcqs,
          l1_entry.day3_mcqs,
          l1_entry.total_mcqs_score,
          l1_entry.day1_ws,
          l1_entry.total_score,
          null,
          l2_entry.day1_mcqs,
          l2_entry.day2_mcqs,
          l2_entry.day3_mcqs,
          l2_entry.total_mcqs_score,
          l2_entry.day1_ws,
          l2_entry.total_score,
        ]);
      }
    }
    if (level === 'grade 7' || botType === 'teacher') {
      totalRow = [
        null,
        null,
        null,
        null,
        maxL1.day1_mcqs_total,
        maxL1.day2_mcqs_total,
        maxL1.day3_mcqs_total,
        maxL1.total_mcqs,
        maxL1.total_speaking_practice,
        maxL1.total_mcqs + maxL1.total_speaking_practice,
        null,
        maxL2.day1_mcqs_total,
        maxL2.day2_mcqs_total,
        maxL2.day3_mcqs_total,
        maxL2.total_mcqs,
        maxL2.total_speaking_practice,
        maxL2.total_mcqs + maxL2.total_speaking_practice,
      ];
    }
    else {
      totalRow = [
        null,
        null,
        null,
        null,
        maxL1.day1_mcqs_total,
        maxL1.day2_mcqs_total,
        maxL1.day3_mcqs_total,
        maxL1.total_mcqs,
        maxL1.total_watchandspeak,
        maxL1.total_mcqs + maxL1.total_watchandspeak,
        null,
        maxL2.day1_mcqs_total,
        maxL2.day2_mcqs_total,
        maxL2.day3_mcqs_total,
        maxL2.total_mcqs,
        maxL2.total_watchandspeak,
        maxL2.total_mcqs + maxL2.total_watchandspeak,
      ];
    }
    }
    array_list = [totalRow, ...arrayT1_List01];
  }
  array_list = array_list.map(obj => Object.values(obj).map(value => value));
  array_list = capitalizeNames(array_list);

  // console.log(array_list);
  return {
    array_list: array_list
  };
};

const getUserProgressLeaderboardService = async (targetGroup, cohort, module, courseId1, courseId2, courseId3) => {
  let array_list = [];

  if (module === 'week') {
    let weekly_score_l1_list = await etlRepository.getWeeklyScore(courseId1, targetGroup, cohort);
    let weekly_score_l2_list = await etlRepository.getWeeklyScore(courseId2, targetGroup, cohort);
    let weekly_score_l3_list = await etlRepository.getWeeklyScore(courseId3, targetGroup, cohort);

    for (let i = 0; i < weekly_score_l1_list.length; i++) {

      const l1_entry = weekly_score_l1_list[i];
      const l2_entry = weekly_score_l2_list[i];
      const l3_entry = weekly_score_l3_list[i];

      array_list.push([
        l1_entry.sr_no,
        l1_entry.phoneNumber,
        l1_entry.name,
        l1_entry.final_percentage_week1,
        l1_entry.final_percentage_week2,
        l1_entry.final_percentage_week3,
        l1_entry.final_percentage_week4,
        l2_entry.final_percentage_week1,
        l2_entry.final_percentage_week2,
        l2_entry.final_percentage_week3,
        l2_entry.final_percentage_week4,
        l3_entry.final_percentage_week1,
        l3_entry.final_percentage_week2,
        l3_entry.final_percentage_week3,
        l3_entry.final_percentage_week4,
      ])
    }
  }
  array_list = array_list.map(obj => Object.values(obj).map(value => value));
  array_list = capitalizeNames(array_list);

  let columnIndex = await getColumnIndexWithPercentageValues(array_list, 1);
  await generateStarTeachersImage(arrayLevels_List, columnIndex);

  return array_list;
};

const getColumnIndexWithPercentageValues = async (arrayLevels_List, minValues) => {
  if (!arrayLevels_List || arrayLevels_List.length === 0) {
    throw new Error("arrayLevels_List is empty or undefined");
  }

  // Predefined list of column indexes to check
  const columnIndexes = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

  // Iterate through the column indexes in reverse order
  for (let i = columnIndexes.length - 1; i >= 0; i--) {
    const col = columnIndexes[i];
    let count = 0;

    // Count percentage values in the current column
    for (let row = 0; row < arrayLevels_List.length; row++) {
      if (
        arrayLevels_List[row][col] &&
        typeof arrayLevels_List[row][col] === "string" &&
        arrayLevels_List[row][col].includes("%")
      ) {
        count++;
      }
    }

    // If the column has at least minValues percentage values, determine return value
    if (count >= minValues) {
      return col;
    } else {
      if (columnIndexes.includes(col - 1)) {
        return col - 1;
      }
      else {
        return col;
      }
    }
  }
};

const capitalizeNames = (arrayLevels_List) => {
  return arrayLevels_List.map(row => {
    // Ensure the row has at least 3 columns and the third column is a string
    if (row.length > 2 && typeof row[3] === 'string') {
      // Split the name into words, capitalize each word, and join them back
      const capitalized = row[3]
        .split(' ') // Split by spaces
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize first letter
        .join(' '); // Join back with spaces
      row[3] = capitalized; // Update the name in the row
    }
    return row;
  });
};

const generateStarTeachersImage = async (arrayLevels_List, columnIndex) => {
  try {
    const templatePath = path.join(__dirname, '../google_sheet_utils/leaderboard.png');

    // Check if input image exists
    if (!fs.existsSync(templatePath)) {
      console.error(`Template image not found at path: ${templatePath}`);
      return null;
    }

    // Get top three performers
    const topPerformers = getTopPerformersWithNames(arrayLevels_List, columnIndex);

    if (topPerformers.length === 0) {
      return null;
    }

    // Load template image
    const image = await loadImage(templatePath);

    // Create canvas with same dimensions as template
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // Draw template on canvas
    ctx.drawImage(image, 0, 0, image.width, image.height);

    // White box dimensions
    const boxWidth = 120;
    const boxHeight = 140;

    // Position parameters
    const positions = [
      { scoreX: 345, scoreY: 367, nameX: 345, nameY: 485, boxWidth: boxWidth, boxHeight: boxHeight }, // Gold (1st)
      { scoreX: 493, scoreY: 367, nameX: 493, nameY: 485, boxWidth: boxWidth, boxHeight: boxHeight }, // Silver (2nd)
      { scoreX: 196, scoreY: 367, nameX: 196, nameY: 485, boxWidth: boxWidth, boxHeight: boxHeight }  // Bronze (3rd)
    ];

    // Draw scores and names
    for (let i = 0; i < Math.min(topPerformers.length, 3); i++) {
      // Draw score
      ctx.fillStyle = '#003399';
      ctx.font = '900 26px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const scoreText = `${topPerformers[i].score}%`;
      ctx.fillText(scoreText, positions[i].scoreX, positions[i].scoreY);

      // Draw names
      const names = topPerformers[i].names;

      // Set fixed font size to 16px
      const fontSize = 14;
      ctx.font = `900 ${fontSize}px Arial, sans-serif`;
      ctx.fillStyle = '#003399';
      ctx.textAlign = 'center';

      const lineHeight = fontSize * 1.3;
      const boxPosition = positions[i];

      // Calculate total height needed for all names
      let totalHeight = 0;
      for (const name of names) {
        const words = name.split(' ');
        if (words.length <= 2) {
          totalHeight += lineHeight;
        } else {
          totalHeight += Math.ceil(words.length / 2) * lineHeight;
        }
      }

      // Add spacing between different names
      if (names.length > 1) {
        totalHeight += (names.length - 1) * (fontSize * 0.2);
      }

      // Calculate starting Y position to center all text vertically
      let startY = boxPosition.nameY - (totalHeight / 2) + fontSize / 2;

      // Draw each name
      let currentY = startY;
      for (let j = 0; j < names.length; j++) {
        const name = names[j];
        const words = name.split(' ');

        if (words.length <= 2) {
          // 1 or 2 words - single line
          ctx.fillText(`• ${name}`, boxPosition.nameX, currentY);
          currentY += lineHeight;
        } else {
          // 3+ words - split into multiple lines
          let currentLine = [];
          let lineCount = 0;

          for (let k = 0; k < words.length; k++) {
            currentLine.push(words[k]);

            // After adding 2 words or on the last word, print the line
            if (currentLine.length === 2 || k === words.length - 1) {
              const lineText = currentLine.join(' ');
              const prefix = lineCount === 0 ? '• ' : '  '; // Bullet only on first line

              ctx.fillText(`${prefix}${lineText}`, boxPosition.nameX, currentY);
              currentY += lineHeight;

              currentLine = [];
              lineCount++;
            }
          }
        }
        // Add small gap between different names
        if (j < names.length - 1) {
          currentY += fontSize * 0.2;
        }
      }
    }
    // Save image
    const buffer = canvas.toBuffer('image/png');
    return buffer;
  } catch (error) {
    console.error("Error generating star teachers image:", error);
    console.error(error.stack);
    return null;
  }
};

// Updated helper function to get top performers with their names
const getTopPerformersWithNames = (data, columnIndex) => {
  // Create a map to store score -> names mapping
  const scoreToNames = new Map();

  // Process each row to extract score and name
  data.forEach(row => {
    if (row[columnIndex] && row[columnIndex] !== 'null') {
      const percentStr = String(row[columnIndex]);
      // Extract the number part and convert to integer
      const percentValue = parseInt(percentStr.replace('%', ''), 10);
      const name = row[3]; // Assuming name is in the 3rd column (index 2)

      if (!isNaN(percentValue) && name) {
        if (!scoreToNames.has(percentValue)) {
          scoreToNames.set(percentValue, []);
        }
        scoreToNames.get(percentValue).push(name);
      }
    }
  });

  // Convert map to array and sort by score (descending)
  const sortedScores = [...scoreToNames.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, 3)
    .map(([score, names]) => ({
      score: score.toString(), // No need for toFixed since it's already an integer
      names: names
    }));

  return sortedScores;
};

const getcohortListService = async (botType,rollout,level,targetGroup) => {

    let cohort_list = await etlRepository.getcohortList(botType,rollout,level,targetGroup);
    cohort_list = cohort_list.map(obj => Object.values(obj).map(value => value));

    return cohort_list;
};

export default {
  getAllUserProgressService,
  getUserProgressLeaderboardService,
  getcohortListService,
};
