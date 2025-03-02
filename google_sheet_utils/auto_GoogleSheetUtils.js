import { google, tasks_v1 } from "googleapis";
import { readFile } from 'fs/promises';

const creds = JSON.parse(
  await readFile(new URL('../my_cred.json', import.meta.url), 'utf-8')
);

const sheets = google.sheets("v4");

const new_loadDataToGoogleSheets = async (
  arrayLevels_List,
  facilitator,
  module,
  edit_flag,
  ActivityCompletedCount,
  last_activityCompleted_l1,
  last_activityCompleted_l2,
  last_activityCompleted_l3
) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const authClient = await auth.getClient();
    const spreadsheetId = "1wAzQ21EL9ELMK-Isb9_jGnpM7RcneYvqt0UD0GAhS1U";

    if(edit_flag == 1){

      await sheets.spreadsheets.values.update({
        auth: authClient,
        spreadsheetId,
        range: `Facilitator ${facilitator}!A1`,
        valueInputOption: "RAW",
        resource: {
          values: [["Fetching..."]],
        },
      });

      const resource_clear = {
        ranges: [
            `Facilitator ${facilitator}!A3:AC55`, 
            `Facilitator ${facilitator}!T1:AC2`, 
            `Facilitator ${facilitator}!AV15:BA100`, 
        ],
    };

     await sheets.spreadsheets.values.batchClear({
      auth: authClient,
      spreadsheetId,
      resource: resource_clear,
     });

    }
    
    if(edit_flag == 2){

    const resource_level_list = {
      valueInputOption: "RAW",
      data: [
        {
          range: `Facilitator ${facilitator}!A3:S`,
          values: arrayLevels_List,
        },
        {
          range: `Facilitator ${facilitator}!T1`,
          values: ActivityCompletedCount,
        },
        {
          range: `Facilitator ${facilitator}!A1`,
          values: [[module]],
        },
        {
          range: `Facilitator ${facilitator}!AV15:AW`,
          values: last_activityCompleted_l1,
        },
        {
          range: `Facilitator ${facilitator}!AX15:AY`,
          values: last_activityCompleted_l2,
        },
        {
          range: `Facilitator ${facilitator}!AZ15:BA`,
          values: last_activityCompleted_l3,
        },
      ],
    };
    
    await sheets.spreadsheets.values.batchUpdate({
      auth: authClient,
      spreadsheetId,
      resource: resource_level_list, 
    });
  
}
       
  } catch (error) {
    console.error("Error in loadDataToGoogleSheets:", error);
    error.fileName = "googleSheetUtils.js";
  }
};

export default {new_loadDataToGoogleSheets};
