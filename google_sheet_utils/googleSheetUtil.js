import { google, tasks_v1 } from "googleapis";
import creds from "../cred/my_cred.json" assert { type: "json" };
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

    // const header = [
    //   [
    //     "Phone Number",
    //     "Name",
    //     "City",
    //     "Time Preference",
    //     "Target Group",
    //     "Scholarship",
    //     "Free Demo Started",
    //     "Free Demo Ended",
    //     "User Clicked Link",
    //     "User Registeration Complete",
    //   ],
    // ];

    // await sheets.spreadsheets.values.append({
    //   auth: authClient,
    //   spreadsheetId,
    //   range: "Sheet1!A1:J1",
    //   valueInputOption: "RAW",
    //   resource: {
    //     values: header,
    //   },
    // });

    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId,
      range: "Dashboard-stats!B2:G3",
      valueInputOption: "RAW",
      resource: {
        values: funnel,
      },
    });
    // await sheets.spreadsheets.values.append({
    //   auth: authClient,
    //   spreadsheetId,
    //   range: "Sheet2!A3:F",
    //   valueInputOption: "RAW",
    //   resource: {
    //     values: dashboardCount[1],
    //   },
    // });

    // await sheets.spreadsheets.batchUpdate({
    //   auth: authClient,
    //   spreadsheetId,
    //   requestBody: {
    //     requests: [
    //       {
    //         repeatCell: {
    //           range: {
    //             sheetId: 0,
    //             startRowIndex: 0,
    //             endRowIndex: 1,
    //             startColumnIndex: 0,
    //             endColumnIndex: 10,
    //           },
    //           cell: {
    //             userEnteredFormat: {
    //               textFormat: {
    //                 bold: true,
    //               },
    //             },
    //           },
    //           fields: "userEnteredFormat.textFormat.bold",
    //         },
    //       },
    //     ],
    //   },
    // });

    // if (!data || !Array.isArray(data)) {
    //   throw new Error("Invalid data: must be a non-empty array");
    // }
    // console.log(data);

    // const formattedData1 = t1.map((row) => {
    //   if (!Array.isArray(row)) {
    //     throw new Error("Each row must be an array");
    //   }
    //   return row.map((entry) => {
    //     if (typeof entry !== "object" || !entry.hasOwnProperty("phoneNumber")) {
    //       throw new Error(
    //         "Each entry must be an object with a 'phoneNumber' property"
    //       );
    //     }
    //     return entry.phoneNumber;
    //   });
    // });

    // const formattedData = [formattedData1[0]];

    // await sheets.spreadsheets.values.update({
    //   auth: authClient,
    //   spreadsheetId,
    //   range: "T1!E6:AH6",
    //   valueInputOption: "RAW",
    //   resource: {
    //     values: formattedData,
    //   },
    // });

    // const phoneno1 = t1.slice(0, 1).map((row) => {
    //   if (!Array.isArray(row)) {
    //     throw new Error("Each row must be an array");
    //   }
    //   return row.map((entry) => {
    //     if (typeof entry !== "object" || !entry.hasOwnProperty("phoneNumber")) {
    //       throw new Error(
    //         "Each entry must be an object with a 'phoneNumber' property"
    //       );
    //     }
    //     return entry.phoneNumber;
    //   });
    // });
    // const phoneno2 = t2.slice(0, 1).map((row) => {
    //   if (!Array.isArray(row)) {
    //     throw new Error("Each row must be an array");
    //   }
    //   return row.map((entry) => {
    //     if (typeof entry !== "object" || !entry.hasOwnProperty("phoneNumber")) {
    //       throw new Error(
    //         "Each entry must be an object with a 'phoneNumber' property"
    //       );
    //     }
    //     return entry.phoneNumber;
    //   });
    // });

    // await sheets.spreadsheets.values.update({
    //   auth: authClient,
    //   spreadsheetId,
    //   range: "T1 Weekly-score!B5:AJ5",
    //   valueInputOption: "RAW",
    //   resource: {
    //     values: phoneno1,
    //   },
    // });

    // await sheets.spreadsheets.values.update({
    //   auth: authClient,
    //   spreadsheetId,
    //   range: "T2 Weekly-score!B5:AJ5",
    //   valueInputOption: "RAW",
    //   resource: {
    //     values: phoneno2,
    //   },
    // });
    // const name1 = t1.slice(0, 1).map((row) => {
    //   if (!Array.isArray(row)) {
    //     throw new Error("Each row must be an array");
    //   }
    //   return row.map((entry) => {
    //     if (typeof entry !== "object" || !entry.hasOwnProperty("phoneNumber")) {
    //       throw new Error(
    //         "Each entry must be an object with a 'phoneNumber' property"
    //       );
    //     }
    //     return entry.name;
    //   });
    // });
    // const name2 = t2.slice(0, 1).map((row) => {
    //   if (!Array.isArray(row)) {
    //     throw new Error("Each row must be an array");
    //   }
    //   return row.map((entry) => {
    //     if (typeof entry !== "object" || !entry.hasOwnProperty("phoneNumber")) {
    //       throw new Error(
    //         "Each entry must be an object with a 'phoneNumber' property"
    //       );
    //     }
    //     return entry.name;
    //   });
    // });
    // await sheets.spreadsheets.values.update({
    //   auth: authClient,
    //   spreadsheetId,
    //   range: "T1 Weekly-score!B4:AJ4",
    //   valueInputOption: "RAW",
    //   resource: {
    //     values: name1,
    //   },
    // });
    // await sheets.spreadsheets.values.update({
    //   auth: authClient,
    //   spreadsheetId,
    //   range: "T2 Weekly-score!B4:AJ4",
    //   valueInputOption: "RAW",
    //   resource: {
    //     values: name2,
    //   },
    // });

    // await sheets.spreadsheets.values.update({
    //   auth: authClient,
    //   spreadsheetId,
    //   range: "T1-Level 1 activity!E10:AN",
    //   valueInputOption: "RAW",
    //   resource: {
    //     values: formattedData,
    //   },
    // });

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
    // console.log(formattedData);
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
    // const weekscore = week_sore_list1.map((row) => {
    //   if (!Array.isArray(row)) {
    //     throw new Error("Each row must be an array");
    //   }
    //   return row.map((entry) => {
    //     return entry.correct_answers;
    //   });
    // });

    // console.log(formattedData);

    // const formattedData0 = week_sore_list[0].map((row) => {
    //   return [row.phoneNumber];
    // });

    // const phoneNumbers = week_sore_list[0].map((item) => item.phoneNumber);
    // await sheets.spreadsheets.values.update({
    //   auth: authClient,
    //   spreadsheetId,
    //   range: "T1 Weekly-score!B4:BJ4",
    //   valueInputOption: "RAW",
    //   resource: {
    //     values: [phoneNumbers],
    //   },
    // });

    // const correctans1 = week_sore_list1.map((item) => item.correct_answers);
    // const correctans2 = week_sore_list2.map((item) => item.correct_answers);

    // await sheets.spreadsheets.values.update({
    //   auth: authClient,
    //   spreadsheetId,
    //   range: "T1 Weekly-score!B9:BJ9",
    //   valueInputOption: "RAW",
    //   resource: {
    //     values: [correctans1],
    //   },
    // });

    if (data) {
      // const existingData = await sheets.spreadsheets.values.get({
      //   auth: authClient,
      //   spreadsheetId,
      //   range: "Sheet1!A26:A",
      // });

      // const startRow = existingData.data.values
      //   ? existingData.data.values.length + 2
      //   : 2;

      // const range = `Sheet1!A${startRow}`;

      // console.log(dashboardCount[0]);

      // const formattedData = data.map((row) => {
      //   return [
      //     row.phoneNumber,
      //     row.name,
      //     row.city,
      //     row.timingPreference,
      //     row.targetGroup,
      //     row.scholarshipvalue,
      //     row.freeDemoStarted,
      //     row.freeDemoEnded,
      //     row.userClickedLink,
      //     row.userRegistrationComplete,
      //   ];
      // });
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
    // const week1_ = week_sore_list1.flat();
    // const week2_ = week_sore_list2.flat();

    // console.log(week_sore_list1.flat());
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
