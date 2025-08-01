import { google } from "googleapis";
import { readFile } from 'fs/promises';

const creds = JSON.parse(
  await readFile(new URL('../my_cred.json', import.meta.url), 'utf-8')
);

const sheets = google.sheets("v4");

const CumulativeUtils_load = async (
    cum_lesson_student,
    cum_activity_student,
    cum_activity_assessment,
    cum_activity_teacher,
    cum_lesson_teacher,
    cum_pre_assessment_teacher,
    cum_post_assessment_teacher
) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const authClient = await auth.getClient();
    const spreadsheetId = "1Nat0B3coOFoIeF_aO-vY-KHuqQxtjLYKx5lNPFBJndg";


      const resource_clear = {
        ranges: [
            `Student Lesson!A3:AA`, 
            `Student Activity!A3:AA`, 
            `Student Assessment!A4:Z`,
            `Teacher Lesson!A4:AA`, 
            `Teacher Activity!A4:AA`, 
            `Teacher Pre-Assessment!A4:N`, 
             `Teacher Post-Assessment!A4:N`, 
        ],
    };

     await sheets.spreadsheets.values.batchClear({
      auth: authClient,
      spreadsheetId,
      resource: resource_clear,
     });

    const resource_level_list = {
      valueInputOption: "RAW",
      data: [
        {
          range: `Student Lesson!A3:AA`, 
          values: cum_lesson_student
        },
        {
          range: `Student Activity!A3:AA`, 
          values: cum_activity_student
        },
        {
          range: `Student Assessment!A4:Z`, 
          values: cum_activity_assessment
        },
        {
          range: `Teacher Lesson!A4:AA`, 
          values:  cum_lesson_teacher
        },
        {
          range: `Teacher Activity!A4:AA`, 
          values: cum_activity_teacher
        },
       {
          range: `Teacher Pre-Assessment!A4:N`, 
          values: cum_pre_assessment_teacher
        },
        {
          range: `Teacher Post-Assessment!A4:N`, 
          values: cum_post_assessment_teacher
        },
      ],
    };
    
    await sheets.spreadsheets.values.batchUpdate({
      auth: authClient,
      spreadsheetId,
      resource: resource_level_list, 
    });
  } catch (error) {
    console.error("Error in DashboardUtils_load:", error);
    error.fileName = "CumulativeUtils.js";
  }
};

export default CumulativeUtils_load;
