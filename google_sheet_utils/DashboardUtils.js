import { google } from "googleapis";
import { readFile } from 'fs/promises';

const creds = JSON.parse(
  await readFile(new URL('../my_cred.json', import.meta.url), 'utf-8')
);

const sheets = google.sheets("v4");

const DashboardUtils_load = async (
    userMetadata_Pilot,
    userMetadata_Control,
    userMetadata_Rollout,
    userMetadata_overTime,
    successRate1,
    successRate2,
    successRate3,
    successRate4,
    successRate5,
    successRate6,
    funnel
) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const authClient = await auth.getClient();
    const spreadsheetId = "14nBbny1vGSVvXjnJNNgIH-1L0ku_-o2yKmF4xsXsVwM";


      const resource_clear = {
        ranges: [
            `Users-metadata Pilot!A2:N`, 
            `Users-metadata Control!A2:N`, 
            `Users-metadata Rollout!A2:N`, 
            `Users-metadata!I2:J`, 
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
          range: `Users-metadata Pilot!A2:N`, 
          values: userMetadata_Pilot,
        },
        {
          range: `Users-metadata Control!A2:N`, 
          values: userMetadata_Control,
        },
        {
          range: `Users-metadata Rollout!A2:N`, 
          values: userMetadata_Rollout,
        },
        {
            range: `Users-metadata!I2:J`, 
            values: userMetadata_overTime,
          },
          {
            range: `Dashboard-stats!V2:AB2`, 
            values: [successRate1],
          },
          {
            range: `Dashboard-stats!V3:AB3`, 
            values: [successRate2],
          },
          {
            range: `Dashboard-stats!V4:AB4`, 
            values: [successRate3],
          },
          {
            range: `Dashboard-stats!V5:AB5`, 
            values: [successRate4],
          },
          {
            range: `Dashboard-stats!V6:AB6`, 
            values: [successRate5],
          },
          {
            range: `Dashboard-stats!V7:AB7`, 
            values: [successRate6],
          },
          {
            range: `Dashboard-stats!B2:F3`, 
            values: funnel,
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
    error.fileName = "DashboardUtils.js";
  }
};

export default DashboardUtils_load;
