import { google } from "googleapis";
import creds from "../credentials/beaj-etl-pipeline-439508-f4f6048a542a.json" assert { type: "json" };

const sheets = google.sheets("v4");

const courseId_gSheet = async (grp) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const authClient = await auth.getClient();
    const spreadsheetId = "19NhKFhYYi30SfIQbfK0jITZTBKn08JwDDckLwv_0_D8";

    const course_id = await sheets.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId,
      range: `${grp}!B2`,
    });
    const value = course_id.data.values ? course_id.data.values[0][0] : null;
    // console.log(value);
    return value;
  } catch (error) {
    error.fileName = "courseId_gSheet.js";
  }
};

export default courseId_gSheet;
