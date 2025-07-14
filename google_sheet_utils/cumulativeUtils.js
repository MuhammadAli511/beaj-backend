import { google } from "googleapis";
import { readFile } from 'fs/promises';

const creds = JSON.parse(
  await readFile(new URL('../my_cred.json', import.meta.url), 'utf-8')
);

const sheets = google.sheets("v4");

const CumulativeUtils_load = async (
  cum_lesson_student,
    cum_activity_student,
    cum_activity_assessment
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
            `Student Lesson!A3:N`, 
            `Student Activity!A3:N`, 
            `Student Assessment!A4:Z`,
            // Uncomment the following lines if you want to clear these ranges as well
            // `Rollout Week!A3:T`,
            // `Rollout-T1 Activity Count!A3:Z`,
            // `Rollout-T2 Activity Count!A3:Z`,
            // `Rollout-T1 Activity Score!A4:Z`,
            // `Rollout-T2 Activity Score!A4:Z`,
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
          range: `Student Lesson!A3:N`, 
          values: cum_lesson_student
        },
        {
          range: `Student Activity!A3:N`, 
          values: cum_activity_student
        },
        {
          range: `Student Assessment!A4:Z`, 
          values: cum_activity_assessment
        },
        // {
        //   range: `Rollout Week!A3:T`, 
        //   values: arrayT1_List2,
        // },
        // {
        //   range: `Rollout-T1 Activity Count!A1`, 
        //   values: ActivityCompletedCount1,
        // },
        // {
        //   range: `Rollout-T2 Activity Count!A1`, 
        //   values: ActivityCompletedCount2,
        // },
        // {
        //   range: `Rollout-T1 Activity Score!A4`, 
        //   values: arrayT1_List01,
        // },
        // {
        //   range: `Rollout-T2 Activity Score!A4`, 
        //   values: arrayT1_List02,
        // },
        // {
        //   range: `Rollout-T1 Activity Score!D2`, 
        //   values: individual_weekly_score_l1_list_total,
        // },
        // {
        //   range: `Rollout-T2 Activity Score!D2`, 
        //   values: individual_weekly_score_l2_list_total,
        // },
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
