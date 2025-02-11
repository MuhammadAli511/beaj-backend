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
      successRate01,
      successRate02,
      last_activity_t1_l1,
      last_activity_t2_l1,
      cumulativeAvgAct_t1,
      cumulativeAvgAct_t2,
      dailyAvgAct_t1,
      dailyAvgAct_t2,
      funnel,
      NotStartedCohort_T1,
      NotStartedCohort_T2,
      LastLessonCompleted_T1,
      LastLessonCompleted_T2,
      CohortWiseUpdateLag_T1,
      CohortWiseUpdateLag_T2,
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
            `Dashboard-stats!V2:AB7`, 
            `Dashboard Rollout!AA2:AG3`, 
            `Dashboard Rollout!AI2:AL90`, 
            `Dashboard Rollout!AA37:AD60`, 
            `Dashboard Rollout!AA63:AD90`, 
            `Dashboard Rollout!AA101:AC123`,
            `Dashboard Rollout!AD101:AF123`,
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
            range: `Dashboard Rollout!AA2:AG2`, 
            values: [successRate01],
          },
          {
            range: `Dashboard Rollout!AA3:AG3`, 
            values: [successRate02],
          },

          {
            range: `Dashboard Rollout!AB27:AC27`, 
            values: dailyAvgAct_t1,
          },
          {
            range: `Dashboard Rollout!AB28:AC28`, 
            values: dailyAvgAct_t2,
          },

          {
            range: `Dashboard Rollout!AB32:AC32`, 
            values: cumulativeAvgAct_t1,
          },
          {
            range: `Dashboard Rollout!AB33:AC33`, 
            values: cumulativeAvgAct_t2,
          },


          {
            range: `Dashboard Rollout!AI2:AJ`, 
            values: last_activity_t1_l1,
          },
          
          {
            range: `Dashboard Rollout!AK2:AL`, 
            values: last_activity_t2_l1,
          },

          {
            range: `Dashboard-stats!B2:F3`, 
            values: funnel,
          },

          {
            range: `Dashboard Rollout!AA37:AB60`, 
            values: NotStartedCohort_T1,
          },
          
          {
            range: `Dashboard Rollout!AC37:AD60`, 
            values: NotStartedCohort_T2,
          },

          {
            range: `Dashboard Rollout!AA63:AB90`, 
            values: LastLessonCompleted_T1,
          },
          
          {
            range: `Dashboard Rollout!AC63:AD90`, 
            values: LastLessonCompleted_T2,
          },


          {
            range: `Dashboard Rollout!AA101:AC123`, 
            values: CohortWiseUpdateLag_T1,
          },
          
          {
            range: `Dashboard Rollout!AD101:AF123`, 
            values: CohortWiseUpdateLag_T2,
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
