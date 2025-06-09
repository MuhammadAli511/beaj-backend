import { google } from "googleapis";
import { readFile } from 'fs/promises';

const creds = JSON.parse(
  await readFile(new URL('../my_cred.json', import.meta.url), 'utf-8')
);

const sheets = google.sheets("v4");

const loadDataToGoogleSheets = async (
  data,
  funnel,
  t1,
  t2,
  week_sore_list1,
  week_sore_list2,
  activityMap1,
  activityMap2,
  new_weeklyCntT1,
  new_weeklyCntT2,
  successRate1,
  successRate2,
  successRate3,
  successRate4,
) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const authClient = await auth.getClient();
    const spreadsheetId = "19NhKFhYYi30SfIQbfK0jITZTBKn08JwDDckLwv_0_D8";

    await sheets.spreadsheets.values.clear({
      auth: authClient,
      spreadsheetId,
      range: "Users-metadata!A2:J",
    });

    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "Dashboard-stats!B2:F3",
      valueInputOption: "RAW",
      resource: {
        values: funnel,
      },
    });

    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "Dashboard-stats!V2:AB2",
      valueInputOption: "RAW",
      resource: {
        values: [successRate1],
      },
    });
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "Dashboard-stats!V3:AB3",
      valueInputOption: "RAW",
      resource: {
        values: [successRate2],
      },
    });
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "Dashboard-stats!V4:AB4",
      valueInputOption: "RAW",
      resource: {
        values: [successRate3],
      },
    });
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "Dashboard-stats!V5:AB5",
      valueInputOption: "RAW",
      resource: {
        values: [successRate4],
      },
    });

    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "New T1-Level activity!D6:G",
      valueInputOption: "RAW",
      resource: {
        values: activityMap1,
      },
    });

    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "New T2-Level activity!D6:G",
      valueInputOption: "RAW",
      resource: {
        values: activityMap2,
      },
    });
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "New T1 Weekly Score!D6:G",
      valueInputOption: "RAW",
      resource: {
        values: new_weeklyCntT1,
      },
    });
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "New T2 Weekly Score!D6:G",
      valueInputOption: "RAW",
      resource: {
        values: new_weeklyCntT2,
      },
    });

    if (data) {

      await sheets.spreadsheets.values.append({
        auth: authClient,
        spreadsheetId,
        range: "Users-metadata!A2:J",
        valueInputOption: "RAW",
        resource: {
          values: data,
        },
      });
    }

    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "T1 Weekly-score!B9:AJ",
      valueInputOption: "RAW",
      resource: {
        values: week_sore_list1,
      },
    });
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "T2 Weekly-score!B9:AJ",
      valueInputOption: "RAW",
      resource: {
        values: week_sore_list2,
      },
    });
  } catch (error) {
    console.error("Error in loadDataToGoogleSheets:", error);
    error.fileName = "googleSheetUtils.js";
  }
};

export default loadDataToGoogleSheets;
