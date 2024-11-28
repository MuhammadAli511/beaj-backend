import { google } from "googleapis";
import creds from "../cred/my_cred.json" assert { type: "json" };

const sheets = google.sheets("v4");

const getPhoneNumberColumn = async (data) => {
  try {
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
    return formattedData;
  } catch (error) {
    error.fileName = "getPhoneNumberColumn.js";
  }
};

export default getPhoneNumberColumn;
