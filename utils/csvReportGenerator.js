// import fs from 'fs';
// import path from 'path';
// import { studentReportCardCalculation } from './chatbotUtils.js';

// const generateStudentReportCSV = async () => {
//     try {
//         console.log('Starting CSV report generation...');

//         // Read users.csv file
//         const usersFilePath = path.join(process.cwd(), 'users.csv');
//         const usersData = fs.readFileSync(usersFilePath, 'utf8');

//         // Parse CSV data
//         const lines = usersData.trim().split('\n');
//         const users = lines.map(line => {
//             const [phoneNumber, profileId, name, grade] = line.split(',');
//             return {
//                 phoneNumber: phoneNumber.trim(),
//                 profileId: parseInt(profileId.trim()),
//                 name: name.trim(),
//                 grade: grade ? grade.trim() : undefined
//             };
//         });

//         console.log(`Found ${users.length} users to process`);

//         // Process all users and collect their report data
//         const reportDataPromises = users.map(async (user) => {
//             try {
//                 console.log(`Processing user: ${user.name} (${user.profileId})`);
//                 const reportData = await studentReportCardCalculation(user.profileId, user.phoneNumber);

//                 if (!reportData || !reportData.reportCard) {
//                     console.log(`No report data found for user: ${user.name}`);
//                     return {
//                         phoneNumber: user.phoneNumber,
//                         profileId: user.profileId,
//                         name: user.name,
//                         grade: user.grade || '',
//                         comprehension: '',
//                         vocabulary: '',
//                         reading: '',
//                         speaking: '',
//                         totalEnglish: '',
//                         placeValue: '',
//                         addition: '',
//                         subtraction: '',
//                         patterns: '',
//                         totalMath: ''
//                     };
//                 }

//                 // Extract English scores
//                 const englishData = reportData.reportCard.English || {};
//                 const comprehension = englishData.Comprehension || '';
//                 const vocabulary = englishData.Vocabulary || '';
//                 const reading = englishData.Reading || '';
//                 const speaking = englishData.Speaking || '';
//                 const totalEnglish = englishData.Total || '';

//                 // Extract Maths scores
//                 const mathsData = reportData.reportCard.Maths || {};
//                 const placeValue = mathsData["Place Value"] || '';
//                 const addition = mathsData.Addition || '';
//                 const subtraction = mathsData.Subtraction || '';
//                 const patterns = mathsData.Patterns || '';
//                 const totalMath = mathsData.Total || '';

//                 return {
//                     phoneNumber: user.phoneNumber,
//                     profileId: user.profileId,
//                     name: user.name,
//                     grade: user.grade || '',
//                     comprehension,
//                     vocabulary,
//                     reading,
//                     speaking,
//                     totalEnglish,
//                     placeValue,
//                     addition,
//                     subtraction,
//                     patterns,
//                     totalMath
//                 };

//             } catch (error) {
//                 console.error(`Error processing user ${user.name}:`, error);
//                 return {
//                     phoneNumber: user.phoneNumber,
//                     profileId: user.profileId,
//                     name: user.name,
//                     grade: user.grade || '',
//                     comprehension: '',
//                     vocabulary: '',
//                     reading: '',
//                     speaking: '',
//                     totalEnglish: '',
//                     placeValue: '',
//                     addition: '',
//                     subtraction: '',
//                     patterns: '',
//                     totalMath: ''
//                 };
//             }
//         });

//         // Wait for all promises to resolve
//         const reportData = await Promise.all(reportDataPromises);

//         // Create CSV content
//         const csvHeaders = 'Phone Number,Profile ID,Name,Grade,Comprehension,Vocabulary,Reading,Speaking,Total English,Place Value,Addition,Subtraction,Patterns,Total Math';
//         const csvRows = reportData.map(row => {
//             return [
//                 row.phoneNumber,
//                 row.profileId,
//                 `"${row.name}"`, // Quote names to handle commas
//                 row.grade,
//                 row.comprehension,
//                 row.vocabulary,
//                 row.reading,
//                 row.speaking,
//                 row.totalEnglish,
//                 row.placeValue,
//                 row.addition,
//                 row.subtraction,
//                 row.patterns,
//                 row.totalMath
//             ].join(',');
//         });

//         const csvContent = [csvHeaders, ...csvRows].join('\n');

//         // Write to report.csv
//         const reportFilePath = path.join(process.cwd(), 'report.csv');
//         fs.writeFileSync(reportFilePath, csvContent, 'utf8');

//         console.log(`CSV report generated successfully. Processed ${users.length} users.`);

//     } catch (error) {
//         console.error('Error generating CSV report:', error);
//         throw error;
//     }
// };


import fs from "fs";
import path from "path";
import csvParser from "csv-parser";
import { studentReportCardCalculation } from './chatbotUtils.js'; // adjust path

// Input and output file paths
const inputFile = path.join(process.cwd(), "users.csv");
const outputFile = path.join(process.cwd(), "report.csv");

// CSV headers
const headers = [
  "PhoneNumber",
  "ProfileId",
  "Name",
  "Grade",
  "Comprehension",
  "Vocabulary",
  "Reading",
  "Speaking",
  "English_Total",
  "Place Value",
  "Addition",
  "Subtraction",
  "Multiplication",
  "Patterns",
  "Fractions",
  "Maths_Total",
];

// Helper → format report into row
function formatReport(user, report) {
  const english = report?.English || {};
  const maths = report?.Maths || {};

  return [
    user.PhoneNumber || "",
    user.profile_id || "",
    `"${user.name || ""}"`, // wrap in quotes in case name has commas
    user.grade || "",

    english.Comprehension || "",
    english.Vocabulary || "",
    english.Reading || "",
    english.Speaking || "",
    english.Total || "",

    maths["Place Value"] || "",
    maths.Addition || "",
    maths.Subtraction || "",
    maths.Multiplication || "",
    maths.Patterns || "",
    maths.Fractions || "",
    maths.Total || "",
  ].join(",");
}

async function processCSV() {
  const students = [];

//   const report = await studentReportCardCalculation(
//            30660,
//             "+923405510687",
//           );
//           return;

  // Step 1: Read input CSV
  fs.createReadStream(inputFile)
    .pipe(csvParser())
    .on("data", (row) => students.push(row))
    .on("end", async () => {
      console.log(`📥 Read ${students.length} students from ${inputFile}`);

      const rows = [headers.join(",")]; // first row = headers

      // Step 2: Process each student sequentially
      // Step 2: Process each student sequentially
for (const student of students) {
  try {
    const phone = student.phoneNumber 
      ? student.phoneNumber.trim() 
      : "";

    const profileId = parseInt(student.profile_id);

    console.log(`Processing student: ${student.name} (${profileId}) with phone ${phone}`);

    const report = await studentReportCardCalculation(
      profileId,
      phone
    );

    rows.push(formatReport({
      PhoneNumber: phone,
      profile_id: profileId,
      name: student.name,
      grade: student.classLevel,   // map correctly
    }, report));
  } catch (err) {
    console.error(`❌ Error processing ${student.name}:`, err);
    rows.push(formatReport(student, null));
  }
}


      // Step 3: Write CSV file
      fs.writeFileSync(outputFile, rows.join("\n"), "utf8");
      console.log(`✅ Report written to ${outputFile}`);
    });
}

export { processCSV as generateStudentReportCSV };


// export { generateStudentReportCSV };
