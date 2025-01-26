import { google } from "googleapis";
import { readFile } from 'fs/promises';

const creds = JSON.parse(
  await readFile(new URL('../my_cred.json', import.meta.url), 'utf-8')
);

const sheets = google.sheets("v4");

const CumulativeUtils_load = async (
  array_Lesson_List,
        array_activity_List,
        arrayT1_List2
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
            `Rollout Lesson!A3:U`, 
            `Rollout Activity!A3:U`, 
            `Rollout Week!A3:T`
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
          range: `Rollout Lesson!A3:U`, 
          values: array_Lesson_List
        },
        {
          range: `Rollout Activity!A3:U`, 
          values: array_activity_List
        },
        {
          range: `Rollout Week!A3:T`, 
          values: arrayT1_List2,
        }
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
