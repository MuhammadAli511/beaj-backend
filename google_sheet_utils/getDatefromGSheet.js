import { google } from "googleapis";
import creds from "../credentials/beaj-etl-pipeline-439508-f4f6048a542a.json" assert { type: "json" };

const sheets = google.sheets("v4");

const getDatefromGSheet = async (grp) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const authClient = await auth.getClient();
    const spreadsheetId = "19NhKFhYYi30SfIQbfK0jITZTBKn08JwDDckLwv_0_D8";

    const existingData = await sheets.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId,
      range: `${grp}!C10:C`,
    });

    const today = new Date();
    const todayFormatted = `${
      today.getMonth() + 1
    }/${today.getDate()}/${today.getFullYear()}`;

    const validDates = [];
    const rows = existingData.data.values || [];

    rows.forEach((row) => {
      const date = row[0];
      if (date && new Date(date) <= new Date(todayFormatted)) {
        validDates.push(date);
      }
    });
    // console.log(validDates);
    return validDates;
  } catch (error) {
    error.fileName = "getDatefromGSheet.js";
  }
};

export default getDatefromGSheet;