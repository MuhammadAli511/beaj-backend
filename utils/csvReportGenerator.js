import fs from "fs";
import path from "path";
import csvParser from "csv-parser";
import { studentReportCardCalculation } from './chatbotUtils.js';

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