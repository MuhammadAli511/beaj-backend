import etlRepository from "../repositories/etlRepository.js";
import loadDataToGoogleSheets from "../google_sheet_utils/googleSheetUtil.js";
import new_loadDataToGoogleSheets from "../google_sheet_utils/LevelGoogleSheet.js";
import lesson_loadDataToGoogleSheets from "../google_sheet_utils/LessonGoogleSheet.js";
import getPhoneNumberColumn from "../google_sheet_utils/getPhoneNumberColumn.js";
import googleSheetStats from "../google_sheet_utils/googleSheetStats.js";
import T1Repository from "../repositories/etl_T1Repository.js";
import getWeeklyActivityCompleted1 from "../repositories/etl_weeklyScoreRepository.js";
import DashboardUtils_load from "../google_sheet_utils/DashboardUtils.js";
import CumulativeUtils_load from "../google_sheet_utils/cumulativeUtils.js";
import { generateCertificatesForEligibleStudents } from '../google_sheet_utils/certificate-utils.js';

const runCumulativeSheets = async () => {

  let cum_lesson_student = await etlRepository.getCumulativeLessonCompletions();
  let cum_activity_student = await etlRepository.getCumulativeActivityCompletions();
  let cum_activity_assessment = await etlRepository.getActivityAssessmentCumulative();

  cum_lesson_student = cum_lesson_student.map(obj => Object.values(obj).map(value => value));
  cum_activity_student = cum_activity_student.map(obj => Object.values(obj).map(value => value));
  cum_activity_assessment = cum_activity_assessment.map(obj => Object.values(obj).map(value => value));


  let cum_activity_teacher = await etlRepository.getTeacherActivityCumulative();
  let cum_lesson_teacher = await etlRepository.getTeacherLessonCumulative();
  let cum_pre_assessment_teacher = await etlRepository.getTeacherAssessmentCumulative(148);
  let cum_post_assessment_teacher = await etlRepository.getTeacherAssessmentCumulative(149);

  cum_activity_teacher = cum_activity_teacher.map(obj => Object.values(obj).map(value => value));
  cum_lesson_teacher = cum_lesson_teacher.map(obj => Object.values(obj).map(value => value));
  cum_pre_assessment_teacher = cum_pre_assessment_teacher.map(obj => Object.values(obj).map(value => value));
  cum_post_assessment_teacher = cum_post_assessment_teacher.map(obj => Object.values(obj).map(value => value));

  await CumulativeUtils_load(
    cum_lesson_student,
    cum_activity_student,
    cum_activity_assessment,
    cum_activity_teacher,
    cum_lesson_teacher,
    cum_pre_assessment_teacher,
    cum_post_assessment_teacher
  );
}

const runETL = async () => {
  try {
    const t1_l1_courseId = 98;
    const t2_l1_courseId = 99;
    const t1_l2_courseId = 104;
    const t2_l2_courseId = 103;

    const data = await etlRepository.getDataFromPostgres();
    const new_data_list = await getPhoneNumberColumn(data);
    const funnel_count = await T1Repository.getDashboardStats();
    const funnel = await googleSheetStats(funnel_count);

    let activityCnt1 = [], total_actvity1 = [];
    let activityCnt2 = [], total_actvity2 = [];


    const totalActivity_list1 = await etlRepository.getActivityTotalCount(t1_l1_courseId, t1_l2_courseId);
    const totalActivity_list2 = await etlRepository.getActivityTotalCount(t2_l1_courseId, t2_l2_courseId);

    let counts = totalActivity_list1.map(item => parseInt(item.count, 10));
    let activities = totalActivity_list1.map(item => item.activity);

    total_actvity1.push(counts, activities);

    counts = totalActivity_list2.map(item => parseInt(item.count, 10));
    activities = totalActivity_list2.map(item => item.activity);

    total_actvity2.push(counts, activities);


    const t1_activity_name_list1 = totalActivity_list1.map(item => item.activity);
    const t1_activity_name_list2 = totalActivity_list2.map(item => item.activity);

    const activityCompleted_list1 = await etlRepository.getCompletedActivity(t1_l1_courseId, t1_l2_courseId, 'T1', t1_activity_name_list1, 'Pilot');
    const activityCompleted_list2 = await etlRepository.getCompletedActivity(t2_l1_courseId, t2_l2_courseId, 'T2', t1_activity_name_list2, 'Pilot');


    const successRate1 = await etlRepository.getSuccessRate(t1_l1_courseId, 'T1', 'Pilot');
    const successRate2 = await etlRepository.getSuccessRate(t2_l1_courseId, 'T2', 'Pilot');
    const successRate3 = await etlRepository.getSuccessRate(t1_l2_courseId, 'T1', 'Pilot');
    const successRate4 = await etlRepository.getSuccessRate(t2_l2_courseId, 'T2', 'Pilot');

    const pilot_lastActivityCompleted_t1_l1 = await etlRepository.getLastActivityCompleted(t1_l1_courseId, 'T1', 'Pilot');
    const pilot_lastActivityCompleted_t1_l1_Map = pilot_lastActivityCompleted_t1_l1.map(obj => Object.values(obj).map(value => parseInt(value, 10)));
    const pilot_lastActivityCompleted_t1_l2 = await etlRepository.getLastActivityCompleted(t1_l2_courseId, 'T1', 'Pilot');
    const pilot_lastActivityCompleted_t1_l2_Map = pilot_lastActivityCompleted_t1_l2.map(obj => Object.values(obj).map(value => parseInt(value, 10)));

    const pilot_lastActivityCompleted_t2_l1 = await etlRepository.getLastActivityCompleted(t2_l1_courseId, 'T2', 'Pilot');
    const pilot_lastActivityCompleted_t2_l1_Map = pilot_lastActivityCompleted_t2_l1.map(obj => Object.values(obj).map(value => parseInt(value, 10)));
    const pilot_lastActivityCompleted_t2_l2 = await etlRepository.getLastActivityCompleted(t2_l2_courseId, 'T2', 'Pilot');
    const pilot_lastActivityCompleted_t2_l2_Map = pilot_lastActivityCompleted_t2_l2.map(obj => Object.values(obj).map(value => parseInt(value, 10)));

    const activityCompletedMap1 = activityCompleted_list1.map(obj => Object.values(obj).map(value => parseInt(value, 10)));
    const activityCompletedMap2 = activityCompleted_list2.map(obj => Object.values(obj).map(value => parseInt(value, 10)));

    const success_list1 = Object.values(successRate1[0]).map((value) => {
      return Number(value) || null;
    });
    const success_list2 = Object.values(successRate2[0]).map((value) => {
      return Number(value) || null;
    });
    const success_list3 = Object.values(successRate3[0]).map((value) => {
      return Number(value) || null;
    });
    const success_list4 = Object.values(successRate4[0]).map((value) => {
      return Number(value) || null;
    });


    let arrayOfT1Activity_Pilot = [], arrayOfT1Activity_level_Pilot = [];
    const activity_weekly_list1 = await getWeeklyActivityCompleted1.getWeeklyActivityCompleted("T1", t1_l1_courseId, 'Pilot');
    const activity_weekly_list2 = await getWeeklyActivityCompleted1.getWeeklyActivityCompleted("T2", t2_l1_courseId, 'Pilot');
    const activity_weekly_list3 = await getWeeklyActivityCompleted1.getWeeklyActivityCompleted("T1", t1_l2_courseId, 'Pilot');
    const activity_weekly_list4 = await getWeeklyActivityCompleted1.getWeeklyActivityCompleted("T2", t2_l2_courseId, 'Pilot');


    let activityMap1 = [], activityMap2 = [];

    for (const entry of activity_weekly_list1) {
      activityMap1.push([
        entry.week1_activities,
        entry.week2_activities,
        entry.week3_activities,
        entry.week4_activities,
      ])
    }
    arrayOfT1Activity_level_Pilot.push(activityMap1);
    activityMap1 = []
    for (const entry of activity_weekly_list3) {
      activityMap1.push([
        entry.week1_activities,
        entry.week2_activities,
        entry.week3_activities,
        entry.week4_activities,
      ])
    }
    arrayOfT1Activity_level_Pilot.push(activityMap1);
    arrayOfT1Activity_level_Pilot.push([]);
    arrayOfT1Activity_Pilot.push(arrayOfT1Activity_level_Pilot);


    arrayOfT1Activity_level_Pilot = [];

    for (const entry of activity_weekly_list2) {
      activityMap2.push([
        entry.week1_activities,
        entry.week2_activities,
        entry.week3_activities,
        entry.week4_activities,
      ])
    }
    arrayOfT1Activity_level_Pilot.push(activityMap2);
    activityMap2 = []
    for (const entry of activity_weekly_list4) {
      activityMap2.push([
        entry.week1_activities,
        entry.week2_activities,
        entry.week3_activities,
        entry.week4_activities,
      ])
    }
    arrayOfT1Activity_level_Pilot.push(activityMap2);
    arrayOfT1Activity_level_Pilot.push([]);
    arrayOfT1Activity_Pilot.push(arrayOfT1Activity_level_Pilot);



    let arrayOfT1Lesson_Pilot = [], arrayOfT1Lesson_level_Pilot = [];
    const lesson_completed_list1 = await etlRepository.getLessonCompletion(t1_l1_courseId, "T1", 'Pilot');
    const lesson_completed_list2 = await etlRepository.getLessonCompletion(t2_l1_courseId, "T2", 'Pilot');
    const lesson_completed_list3 = await etlRepository.getLessonCompletion(t1_l2_courseId, "T1", 'Pilot');
    const lesson_completed_list4 = await etlRepository.getLessonCompletion(t2_l2_courseId, "T2", 'Pilot');
    let lessonMap1 = [], lessonMap2 = [];

    for (const entry of lesson_completed_list1) {
      lessonMap1.push([
        entry.week1,
        entry.week2,
        entry.week3,
        entry.week4,
      ])
    }
    arrayOfT1Lesson_level_Pilot.push(lessonMap1);
    lessonMap1 = [];
    for (const entry of lesson_completed_list3) {
      lessonMap1.push([
        entry.week1,
        entry.week2,
        entry.week3,
        entry.week4,
      ])
    }
    arrayOfT1Lesson_level_Pilot.push(lessonMap1);
    arrayOfT1Lesson_level_Pilot.push([]);
    arrayOfT1Lesson_Pilot.push(arrayOfT1Lesson_level_Pilot);

    arrayOfT1Lesson_level_Pilot = [];

    for (const entry of lesson_completed_list2) {
      lessonMap2.push([
        entry.week1,
        entry.week2,
        entry.week3,
        entry.week4,
      ])
    }
    arrayOfT1Lesson_level_Pilot.push(lessonMap2);
    lessonMap2 = [];
    for (const entry of lesson_completed_list4) {
      lessonMap2.push([
        entry.week1,
        entry.week2,
        entry.week3,
        entry.week4,
      ])
    }
    arrayOfT1Lesson_level_Pilot.push(lessonMap2);
    arrayOfT1Lesson_level_Pilot.push([]);
    arrayOfT1Lesson_Pilot.push(arrayOfT1Lesson_level_Pilot);

    let pilot_t1_w1_weekly_Score = await etlRepository.getWeeklyScore(t1_l1_courseId, "T1", 'Pilot');
    let pilot_t2_w1_weekly_Score = await etlRepository.getWeeklyScore(t2_l1_courseId, "T2", 'Pilot');
    let pilot_t1_w1_weekly_Score1 = await etlRepository.getWeeklyScore(t1_l2_courseId, "T1", 'Pilot');
    let pilot_t2_w1_weekly_Score1 = await etlRepository.getWeeklyScore(t2_l2_courseId, "T2", 'Pilot');

    pilot_t1_w1_weekly_Score1 = pilot_t1_w1_weekly_Score1.map((entry) => [
      entry.final_percentage_week1,
      entry.final_percentage_week2,
      entry.final_percentage_week3,
      entry.final_percentage_week4,
    ]);
    pilot_t2_w1_weekly_Score1 = pilot_t2_w1_weekly_Score1.map((entry) => [
      entry.final_percentage_week1,
      entry.final_percentage_week2,
      entry.final_percentage_week3,
      entry.final_percentage_week4,
    ]);

    pilot_t1_w1_weekly_Score = pilot_t1_w1_weekly_Score.map((entry) => [
      entry.final_percentage_week1,
      entry.final_percentage_week2,
      entry.final_percentage_week3,
      entry.final_percentage_week4,
    ]);
    pilot_t2_w1_weekly_Score = pilot_t2_w1_weekly_Score.map((entry) => [
      entry.final_percentage_week1,
      entry.final_percentage_week2,
      entry.final_percentage_week3,
      entry.final_percentage_week4,
    ]);

    const new_weeklyCntT1 = [];
    const new_weeklyCntT2 = [];

    const weeklyCntT1 = [];
    const weeklyCntT2 = [];

    await lesson_loadDataToGoogleSheets(
      arrayOfT1Lesson_Pilot,
      pilot_t1_w1_weekly_Score,
      pilot_t2_w1_weekly_Score,
      pilot_t1_w1_weekly_Score1,
      pilot_t2_w1_weekly_Score1,
    );

    await new_loadDataToGoogleSheets(
      arrayOfT1Activity_Pilot,
      activityMap2,
      total_actvity1,
      total_actvity2,
      activityCompletedMap1,
      activityCompletedMap2,
      pilot_lastActivityCompleted_t1_l1_Map,
      pilot_lastActivityCompleted_t2_l1_Map,
      pilot_lastActivityCompleted_t1_l2_Map,
      pilot_lastActivityCompleted_t2_l2_Map
    );


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
      success_list1,
      success_list2,
      success_list3,
      success_list4,

    );

  } catch (error) {
    error.fileName = "etlService.js";
    throw error;
  }
};

const runETL_Dashboard = async () => {
  try {
    let userMetadata_Pilot = await getWeeklyActivityCompleted1.getUserMetadataAll('Pilot');
    let userMetadata_Control = await getWeeklyActivityCompleted1.getUserMetadataAll('Control');
    let userMetadata_Rollout = await getWeeklyActivityCompleted1.getUserMetadataAll('Rollout');
    let userMetadata_overTime = await getWeeklyActivityCompleted1.getUserMetadataTime();

    const funnel_count = await T1Repository.getDashboardStats();
    const funnel = await googleSheetStats(funnel_count);

    userMetadata_Pilot = userMetadata_Pilot.map(obj => Object.values(obj).map(value => value));
    userMetadata_Control = userMetadata_Control.map(obj => Object.values(obj).map(value => value));
    userMetadata_Rollout = userMetadata_Rollout.map(obj => Object.values(obj).map(value => value));
    userMetadata_overTime = userMetadata_overTime.map(obj => Object.values(obj).map(value => value));

    let successRate1 = await etlRepository.getSuccessRate(98, 'T1', 'Pilot');
    let successRate2 = await etlRepository.getSuccessRate(99, 'T2', 'Pilot');
    let successRate3 = await etlRepository.getSuccessRate(104, 'T1', 'Pilot');
    let successRate4 = await etlRepository.getSuccessRate(103, 'T2', 'Pilot');
    let successRate5 = await etlRepository.getSuccessRate(109, 'T1', 'Pilot');
    let successRate6 = await etlRepository.getSuccessRate(108, 'T2', 'Pilot');

    let successRate01 = await etlRepository.getSuccessRate(106, 'T1', '');
    let successRate02 = await etlRepository.getSuccessRate(105, 'T2', '');

    let successRate03 = await etlRepository.getSuccessRate(111, 'T1', '');
    let successRate04 = await etlRepository.getSuccessRate(110, 'T2', '');

    successRate1 = Object.values(successRate1[0]).map((value) => {
      return Number(value) || null;
    });
    successRate2 = Object.values(successRate2[0]).map((value) => {
      return Number(value) || null;
    });
    successRate3 = Object.values(successRate3[0]).map((value) => {
      return Number(value) || null;
    });
    successRate4 = Object.values(successRate4[0]).map((value) => {
      return Number(value) || null;
    });
    successRate5 = Object.values(successRate5[0]).map((value) => {
      return Number(value) || null;
    });
    successRate6 = Object.values(successRate6[0]).map((value) => {
      return Number(value) || null;
    });

    successRate01 = Object.values(successRate01[0]).map((value) => {
      return Number(value) || null;
    });
    successRate02 = Object.values(successRate02[0]).map((value) => {
      return Number(value) || null;
    });

    successRate03 = Object.values(successRate03[0]).map((value) => {
      return Number(value) || null;
    });
    successRate04 = Object.values(successRate04[0]).map((value) => {
      return Number(value) || null;
    });

    let dailyAvgAct_t1 = await getWeeklyActivityCompleted1.getDaily_AvgActivity_Rollout(118, 'T1');
    dailyAvgAct_t1 = dailyAvgAct_t1.map(obj => Object.values(obj).map(value => Number(value)));
    let dailyAvgAct_t2 = await getWeeklyActivityCompleted1.getDaily_AvgActivity_Rollout(112, 'T2');
    dailyAvgAct_t2 = dailyAvgAct_t2.map(obj => Object.values(obj).map(value => Number(value)));

    let last_activity_t1_l1 = await etlRepository.getLastActivityCompleted(106, 'T1', 'Rollout');
    last_activity_t1_l1 = last_activity_t1_l1.map(obj => Object.values(obj).map(value => value));
    let last_activity_t2_l1 = await etlRepository.getLastActivityCompleted(105, 'T2', 'Rollout');
    last_activity_t2_l1 = last_activity_t2_l1.map(obj => Object.values(obj).map(value => value));

    let cumulativeAvgAct_t1 = await getWeeklyActivityCompleted1.getCumulative_AvgActivity_Rollout(106, 'T1', '');
    cumulativeAvgAct_t1 = cumulativeAvgAct_t1.map(obj => Object.values(obj).map(value => Number(value)));
    let cumulativeAvgAct_t2 = await getWeeklyActivityCompleted1.getCumulative_AvgActivity_Rollout(105, 'T2', '');
    cumulativeAvgAct_t2 = cumulativeAvgAct_t2.map(obj => Object.values(obj).map(value => Number(value)));

    let NotStartedCohort_T1 = await getWeeklyActivityCompleted1.getNotStartCohortCount_Rollout(106, 'T1');
    NotStartedCohort_T1 = NotStartedCohort_T1.map(obj => [String(obj.cohort), Number(obj.count)]);

    let NotStartedCohort_T2 = await getWeeklyActivityCompleted1.getNotStartCohortCount_Rollout(105, 'T2');
    NotStartedCohort_T2 = NotStartedCohort_T2.map(obj => [String(obj.cohort), Number(obj.count)]);

    let LastLessonCompleted_T1 = await getWeeklyActivityCompleted1.getLastLessonCompleted_Rollout(106, 'T1', 'Rollout');
    LastLessonCompleted_T1 = LastLessonCompleted_T1.map(obj => Object.values(obj).map(value => value));

    let LastLessonCompleted_T2 = await getWeeklyActivityCompleted1.getLastLessonCompleted_Rollout(105, 'T2', 'Rollout');
    LastLessonCompleted_T2 = LastLessonCompleted_T2.map(obj => Object.values(obj).map(value => value));

    let CohortWiseUpdateLag_T1 = await getWeeklyActivityCompleted1.getCount_UpdateLagCohortWise(106, 'T1');
    CohortWiseUpdateLag_T1 = CohortWiseUpdateLag_T1.map(obj => Object.values(obj).map(value => value));

    let CohortWiseUpdateLag_T2 = await getWeeklyActivityCompleted1.getCount_UpdateLagCohortWise(105, 'T2');
    CohortWiseUpdateLag_T2 = CohortWiseUpdateLag_T2.map(obj => Object.values(obj).map(value => value));



    let last_activity_t1_l2 = await etlRepository.getLastActivityCompleted(111, 'T1', 'Rollout');
    last_activity_t1_l2 = last_activity_t1_l2.map(obj => Object.values(obj).map(value => value));
    let last_activity_t2_l2 = await etlRepository.getLastActivityCompleted(110, 'T2', 'Rollout');
    last_activity_t2_l2 = last_activity_t2_l2.map(obj => Object.values(obj).map(value => value));

    let cumulativeAvgAct_t1_l2 = await getWeeklyActivityCompleted1.getCumulative_AvgActivity_Rollout(111, 'T1', '');
    cumulativeAvgAct_t1_l2 = cumulativeAvgAct_t1_l2.map(obj => Object.values(obj).map(value => Number(value)));
    let cumulativeAvgAct_t2_l2 = await getWeeklyActivityCompleted1.getCumulative_AvgActivity_Rollout(110, 'T2', '');
    cumulativeAvgAct_t2_l2 = cumulativeAvgAct_t2_l2.map(obj => Object.values(obj).map(value => Number(value)));

    let NotStartedCohort_T1_l2 = await getWeeklyActivityCompleted1.getNotStartCohortCount_Rollout(111, 'T1');
    NotStartedCohort_T1_l2 = NotStartedCohort_T1_l2.map(obj => [String(obj.cohort), Number(obj.count)]);

    let NotStartedCohort_T2_l2 = await getWeeklyActivityCompleted1.getNotStartCohortCount_Rollout(110, 'T2');
    NotStartedCohort_T2_l2 = NotStartedCohort_T2_l2.map(obj => [String(obj.cohort), Number(obj.count)]);

    let LastLessonCompleted_T1_l2 = await getWeeklyActivityCompleted1.getLastLessonCompleted_Rollout(111, 'T1', 'Rollout');
    LastLessonCompleted_T1_l2 = LastLessonCompleted_T1_l2.map(obj => Object.values(obj).map(value => value));

    let LastLessonCompleted_T2_l2 = await getWeeklyActivityCompleted1.getLastLessonCompleted_Rollout(110, 'T2', 'Rollout');
    LastLessonCompleted_T2_l2 = LastLessonCompleted_T2_l2.map(obj => Object.values(obj).map(value => value));

    let CohortWiseUpdateLag_T1_l2 = await getWeeklyActivityCompleted1.getCount_UpdateLagCohortWise(111, 'T1');
    CohortWiseUpdateLag_T1_l2 = CohortWiseUpdateLag_T1_l2.map(obj => Object.values(obj).map(value => value));

    let CohortWiseUpdateLag_T2_l2 = await getWeeklyActivityCompleted1.getCount_UpdateLagCohortWise(110, 'T2');
    CohortWiseUpdateLag_T2_l2 = CohortWiseUpdateLag_T2_l2.map(obj => Object.values(obj).map(value => value));

    await DashboardUtils_load(
      userMetadata_Pilot,
      userMetadata_Control,
      userMetadata_Rollout,
      userMetadata_overTime,
      successRate1,
      successRate2,
      successRate3,
      successRate4,
      successRate5,
      successRate6,
      successRate01,
      successRate02,
      successRate03,
      successRate04,
      last_activity_t1_l1,
      last_activity_t2_l1,
      cumulativeAvgAct_t1,
      cumulativeAvgAct_t2,
      last_activity_t1_l2,
      last_activity_t2_l2,
      cumulativeAvgAct_t1_l2,
      cumulativeAvgAct_t2_l2,
      dailyAvgAct_t1,
      dailyAvgAct_t2,
      funnel,
      NotStartedCohort_T1,
      NotStartedCohort_T2,
      LastLessonCompleted_T1,
      LastLessonCompleted_T2,
      CohortWiseUpdateLag_T1,
      CohortWiseUpdateLag_T2,
      NotStartedCohort_T1_l2,
      NotStartedCohort_T2_l2,
      LastLessonCompleted_T1_l2,
      LastLessonCompleted_T2_l2,
      CohortWiseUpdateLag_T1_l2,
      CohortWiseUpdateLag_T2_l2
    );

    await runCumulativeSheets();

  } catch (error) {
    error.fileName = "etlService.js";
    throw error;
  }
};

export default { runETL, runETL_Dashboard, runCumulativeSheets };
