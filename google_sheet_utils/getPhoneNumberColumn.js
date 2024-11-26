import { google } from "googleapis";
import creds from "../my_cred.json" assert { type: "json" };

const sheets = google.sheets("v4");

const getPhoneNumberColumn = async (data) => {
  try {
    // const auth = new google.auth.GoogleAuth({
    //   credentials: creds,
    //   scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    // });

    // const authClient = await auth.getClient();
    // const spreadsheetId = "19NhKFhYYi30SfIQbfK0jITZTBKn08JwDDckLwv_0_D8";

    // const readResponse = await sheets.spreadsheets.values.get({
    //   auth: authClient,
    //   spreadsheetId,
    //   range: "Users-metadata!A2:A",
    // });

    // const existingPhoneNumbers = (readResponse.data.values || []).flat();

    // const newEntries = data.filter(
    //   (row) => !existingPhoneNumbers.includes(row.phoneNumber)
    // );

    //if (newEntries.length > 0) {
    const formattedData = data.map((row) => [
      row.phoneNumber,
      row.name,
      row.city,
      row.timingPreference,
      row.targetGroup,
      row.scholarshipvalue,
      row.freeDemoStarted
        ? new Date(
          new Date(row.freeDemoStarted).getTime() + 5 * 60 * 60 * 1000
        ).toLocaleString()
        : null,
      row.freeDemoEnded
        ? new Date(
          new Date(row.freeDemoEnded).getTime() + 5 * 60 * 60 * 1000
        ).toLocaleString()
        : null,
      row.userClickedLink
        ? new Date(
          new Date(row.userClickedLink).getTime() + 5 * 60 * 60 * 1000
        ).toLocaleString()
        : null,
      row.userRegistrationComplete
        ? new Date(
          new Date(row.userRegistrationComplete).getTime() +
          5 * 60 * 60 * 1000
        ).toLocaleString()
        : null,
    ]);
    // console.log(formattedData);
    return formattedData;
    // }
  } catch (error) {
    error.fileName = "getPhoneNumberColumn.js";
  }
};

export default getPhoneNumberColumn;
