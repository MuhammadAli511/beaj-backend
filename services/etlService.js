import etlRepository from "../repositories/etlRepository.js";
import loadDataToGoogleSheets from "../google_sheet_utils/googleSheetUtil.js";
import dashboardFunnel from "./statsService.js";
import getPhoneNumberColumn from "../google_sheet_utils/getPhoneNumberColumn.js";
import googleSheetStats from "../google_sheet_utils/googleSheetStats.js";
import T1Repository from "../repositories/etl_T1Repository.js";
import getDatefromGSheet from "../google_sheet_utils/getDatefromGSheet.js";
import getWeeklyDate from "../google_sheet_utils/weekscore_getdate.js";
import courseId_gSheet from "../google_sheet_utils/courseId_gSheet.js";
import getWeeklyActivityCompleted1 from "../repositories/etl_weeklyScoreRepository.js";
import newWeekActivityScore from "../google_sheet_utils/newWeekActivityScore.js";

const runETL = async () => {
  try {
    const data = await etlRepository.getDataFromPostgres();
    const new_data_list = await getPhoneNumberColumn(data);
    const funnel_count = await dashboardFunnel.dashboardCardsFunnelService();
    const funnel = await googleSheetStats(funnel_count);

    var activityCnt1 = [];
    var activityCnt2 = [];

    const date_T1 = await getDatefromGSheet("T1-Level 1 activity");
    const date_T2 = await getDatefromGSheet("T2-Level 1 activity");

    const courseid1 = await courseId_gSheet("T1-Level 1 activity");
    const courseid2 = await courseId_gSheet("T2-Level 1 activity");

    const activity_weekly_list1 = await getWeeklyActivityCompleted1.getWeeklyActivityCompleted("T1",courseid1);
    const activity_weekly_list2 = await getWeeklyActivityCompleted1.getWeeklyActivityCompleted("T2",courseid2);

    let activityMap1 = [], activityMap2 = [];

    for(const entry of activity_weekly_list1){
      activityMap1.push([
        entry.week1_activities,
        entry.week2_activities,
        entry.week3_activities,
        entry.week4_activities,
      ])
    }
    for(const entry of activity_weekly_list2){
      activityMap2.push([
        entry.week1_activities,
        entry.week2_activities,
        entry.week3_activities,
        entry.week4_activities,
      ])
    }

    if (date_T1 && date_T2) {
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
      for (const date of date_T2) {
        const data1 = await T1Repository.getDataFromPostgres(
          date,
          "T2",
          courseid2
        );

        if (data1.length !== 0) {
          activityCnt2.push(data1);
        }
      }
    }
    const courseid3 = await courseId_gSheet("T1 Weekly-score");
    const courseid4 = await courseId_gSheet("T2 Weekly-score");

    const new_weeklyCntT1 = await newWeekActivityScore(activity_weekly_list1, "T1", courseid3);
    const new_weeklyCntT2 = await newWeekActivityScore(activity_weekly_list2, "T2", courseid4);

    const weeklyCntT1 = await getWeeklyDate("T1", courseid3);
    const weeklyCntT2 = await getWeeklyDate("T2", courseid4);

    await loadDataToGoogleSheets(
      new_data_list,
      funnel,
      activityCnt1,
      activityCnt2,
      weeklyCntT1,
      weeklyCntT2,
      activityMap1,
      activityMap2,
      new_weeklyCntT1,
      new_weeklyCntT2,
    );

  } catch (error) {
    error.fileName = "etlService.js";
    throw error;
  }
};

export default { runETL };
