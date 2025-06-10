import { google } from "googleapis";
import { readFile } from 'fs/promises';

const creds = JSON.parse(
  await readFile(new URL('../my_cred.json', import.meta.url), 'utf-8')
);

const sheets = google.sheets("v4");

const new_loadDataToGoogleSheets = async (
  pilot_t1_activity,
  pilot_t2_activity,
  pilot_total_actvity1,
  pilot_total_actvity2,
  activityCompletedMap1,
  activityCompletedMap2,
  pilot_lastActivityCompleted_t1_l1_Map,
  pilot_lastActivityCompleted_t2_l1_Map,
  pilot_lastActivityCompleted_t1_l2_Map,
  pilot_lastActivityCompleted_t2_l2_Map

) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const authClient = await auth.getClient();
    const spreadsheetId = "14nBbny1vGSVvXjnJNNgIH-1L0ku_-o2yKmF4xsXsVwM";

    for (let i = 1; i <= 2; i++) {
      let sheet_name = `Pilot T${i}-Activity!`;
      let pilot_activity;
      if (i == 1) {
        pilot_activity = pilot_t1_activity[i - 1];
      }
      else {
        pilot_activity = pilot_t1_activity[i - 1];
      }
      for (let j = 1; j <= 3; j++) {
        let sheet_range = ``;
        let level_activity = pilot_activity[j - 1];
        if (j == 1) {
          sheet_range = `D3:G`;
          level_activity = pilot_activity[j - 1];
        }
        if (j == 2) {
          sheet_range = `I3:L`;
          level_activity = pilot_activity[j - 1];
        }
        if (j == 3) {
          sheet_range = `N3:Q`;
          level_activity = pilot_activity[j - 1];
        }
        await sheets.spreadsheets.values.update({
          auth: authClient,
          spreadsheetId,
          range: sheet_name + sheet_range,
          valueInputOption: "RAW",
          resource: {
            values: level_activity,
          },
        });
      }
    }

    // Pilot T1-Activity Completed
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "Pilot T1-Activity!T3",
      valueInputOption: "RAW",
      resource: {
        values: activityCompletedMap1,
      },
    });
    // Pilot T2-Activity Completed
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "Pilot T2-Activity!T3",
      valueInputOption: "RAW",
      resource: {
        values: activityCompletedMap2,
      },
    });

    // Pilot T1-Activity Total
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "Pilot T1-Activity!T1",
      valueInputOption: "RAW",
      resource: {
        values: pilot_total_actvity1,
      },
    });
    // Pilot T2-Activity Total
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "Pilot T2-Activity!T1",
      valueInputOption: "RAW",
      resource: {
        values: pilot_total_actvity2,
      },
    });


    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "Pilot T1-Activity!AE70:AF122",
      valueInputOption: "RAW",
      resource: {
        values: pilot_lastActivityCompleted_t1_l1_Map,
      },
    });
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "Pilot T2-Activity!AE70:AF130",
      valueInputOption: "RAW",
      resource: {
        values: pilot_lastActivityCompleted_t2_l1_Map,
      },
    });
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "Pilot T1-Activity!AE125:AF",
      valueInputOption: "RAW",
      resource: {
        values: pilot_lastActivityCompleted_t1_l2_Map,
      },
    });
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "Pilot T2-Activity!AE188:AF",
      valueInputOption: "RAW",
      resource: {
        values: pilot_lastActivityCompleted_t2_l2_Map,
      },
    });

  } catch (error) {
    console.error("Error in loadDataToGoogleSheets:", error);
    error.fileName = "googleSheetUtils.js";
  }
};

export default new_loadDataToGoogleSheets;
