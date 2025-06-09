import { google } from "googleapis";
import { readFile } from 'fs/promises';

const creds = JSON.parse(
  await readFile(new URL('../my_cred.json', import.meta.url), 'utf-8')
);

const sheets = google.sheets("v4");

const lesson_loadDataToGoogleSheets = async (
  pilot_t1_lesson,
  pilot_t1_w1_weekly_Score,
  pilot_t2_w1_weekly_Score,
  pilot_t1_w1_weekly_Score1,
  pilot_t2_w1_weekly_Score1,
) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const authClient = await auth.getClient();
    const spreadsheetId = "1Nat0B3coOFoIeF_aO-vY-KHuqQxtjLYKx5lNPFBJndg";

    for (let i = 1; i <= 2; i++) {
      let sheet_name = `Pilot T${i}-Lesson!`;
      let pilot_lesson;
      if (i == 1) {
        pilot_lesson = pilot_t1_lesson[i - 1];
      }
      else {
        pilot_lesson = pilot_t1_lesson[i - 1];
      }
      for (let j = 1; j <= 3; j++) {
        let sheet_range = ``;
        let level_lesson = pilot_lesson[j - 1];
        if (j == 1) {
          sheet_range = `D3:G`;
          level_lesson = pilot_lesson[j - 1];
        }
        if (j == 2) {
          sheet_range = `I3:L`;
          level_lesson = pilot_lesson[j - 1];
        }
        if (j == 3) {
          sheet_range = `N3:Q`;
          level_lesson = pilot_lesson[j - 1];
        }
        await sheets.spreadsheets.values.update({
          auth: authClient,
          spreadsheetId,
          range: sheet_name + sheet_range,
          valueInputOption: "RAW",
          resource: {
            values: level_lesson,
          },
        });
      }
    }
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: 'Pilot T1-Weekly Score!D3',
      valueInputOption: "RAW",
      resource: {
        values: pilot_t1_w1_weekly_Score,
      },
    });
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: 'Pilot T2-Weekly Score!D3',
      valueInputOption: "RAW",
      resource: {
        values: pilot_t2_w1_weekly_Score,
      },
    });

    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: 'Pilot T1-Weekly Score!I3',
      valueInputOption: "RAW",
      resource: {
        values: pilot_t1_w1_weekly_Score1,
      },
    });
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: 'Pilot T2-Weekly Score!I3',
      valueInputOption: "RAW",
      resource: {
        values: pilot_t2_w1_weekly_Score1,
      },
    });
  } catch (error) {
    console.error("Error in loadDataToGoogleSheets:", error);
    error.fileName = "googleSheetUtils.js";
  }
};

export default lesson_loadDataToGoogleSheets;
