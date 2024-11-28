import { google, tasks_v1 } from "googleapis";
import creds from "../my_cred.json" assert { type: "json" };
import getWeeklyDate from "../google_sheet_utils/weekscore_getdate.js";
import courseId_gSheet from "../google_sheet_utils/courseId_gSheet.js";
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
      range: "Dashboard-stats!B2:G3",
      valueInputOption: "RAW",
      resource: {
        values: funnel,
      },
    });

    const formattedData = t1.map((row) => {
      if (!Array.isArray(row)) {
        throw new Error("Each row must be an array");
      }
      return row.map((entry) => {
        if (
          typeof entry !== "object" ||
          !entry.hasOwnProperty("activity_completd")
        ) {
          throw new Error(
            "Each entry must be an object with an 'activity_completd' property"
          );
        }
        return entry.activity_completd;
      });
    });
    const formattedData1 = t2.map((row) => {
      if (!Array.isArray(row)) {
        throw new Error("Each row must be an array");
      }
      return row.map((entry) => {
        if (
          typeof entry !== "object" ||
          !entry.hasOwnProperty("activity_completd")
        ) {
          throw new Error(
            "Each entry must be an object with an 'activity_completd' property"
          );
        }
        return entry.activity_completd;
      });
    });
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "T1-Level 1 activity!E10:AM",
      valueInputOption: "RAW",
      resource: {
        values: formattedData,
      },
    });
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "T2-Level 1 activity!E10:AM",
      valueInputOption: "RAW",
      resource: {
        values: formattedData1,
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
