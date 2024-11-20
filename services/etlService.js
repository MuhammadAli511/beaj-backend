import etlRepository from "../repositories/etlRepository.js";
import loadDataToGoogleSheets from "../google_sheet_utils/googleSheetUtil.js";
import dashboardFunnel from "./statsService.js";
import getPhoneNumberColumn from "../google_sheet_utils/getPhoneNumberColumn.js";
import googleSheetStats from "../google_sheet_utils/googleSheetStats.js";
import T1Repository from "../repositories/etl_T1Repository.js";
import getDatefromGSheet from "../google_sheet_utils/getDatefromGSheet.js";
import getWeeklyDate from "../google_sheet_utils/weekscore_getdate.js";
import courseId_gSheet from "../google_sheet_utils/courseId_gSheet.js";

const runETL = async () => {
  try {
    // var weekno = 1;
    // const currentDate1 = new Date();
    // const currentDate = currentDate1.toISOString().split("T")[0];
    // if (currentDate >= "2024-11-11") {
    //   weekno = 1;
    // }
    // if (currentDate >= "2024-11-18") {
    //   weekno = 2;
    // }
    // if (currentDate >= "2024-11-25") {
    //   weekno = 3;
    // }
    // if (currentDate >= "2024-12-02") {
    //   weekno = 4;
    // }
    // Dashboard
    const data = await etlRepository.getDataFromPostgres();
    const new_data_list = await getPhoneNumberColumn(data);
    const funnel_count = await dashboardFunnel.dashboardCardsFunnelService();
    const funnel = await googleSheetStats(funnel_count);

    // Get Dates from T1 & T2

    var activityCnt1 = [];
    var activityCnt2 = [];

    const date_T1 = await getDatefromGSheet("T1-Level 1 activity");
    const date_T2 = await getDatefromGSheet("T2-Level 1 activity");

    const courseid1 = await courseId_gSheet("T1-Level 1 activity");
    const courseid2 = await courseId_gSheet("T2-Level 1 activity");

    if (date_T1 && date_T2) {
      // const date_T2 = await getDatefromGSheet("T2");
      for (const date of date_T1) {
        const data1 = await T1Repository.getDataFromPostgres(
          date,
          "T1",
          courseid1
        );
        if (data1.length !== 0) {
          activityCnt1.push(data1);
        }
      }

      // console.log("data1   " + activityCnt1 + courseid1);
      for (const date of date_T2) {
        const data1 = await T1Repository.getDataFromPostgres(
          date,
          "T2",
          courseid2
        );

        if (data1.length !== 0) {
          activityCnt2.push(data1);
        }
        // console.log(data1);
      }
      // console.log(activityCnt2);
    }
    const courseid3 = await courseId_gSheet("T1 Weekly-score");
    const courseid4 = await courseId_gSheet("T2 Weekly-score");
    // const weeklyCntT1 = [];
    const weeklyCntT1 = await getWeeklyDate("T1", courseid3);
    const weeklyCntT2 = await getWeeklyDate("T2", courseid4);

    console.log(weeklyCntT1);
    console.log(weeklyCntT2);

    // activityCnt1.push(data1);
    // console.log(activityCnt1);

    await loadDataToGoogleSheets(
      new_data_list,
      funnel,
      activityCnt1,
      activityCnt2,
      weeklyCntT1,
      weeklyCntT2
    );
    // console.log(weeklyCntT1);
    // console.log(weeklyCntT2);
    // cons;44
  } catch (error) {
    error.fileName = "etlService.js";
    throw error;
  }
};

export default { runETL };
