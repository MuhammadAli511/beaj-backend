import etlRepository from "../repositories/etlRepository.js";
import T1Repository from "../repositories/etl_T1Repository.js";
import getWeeklyActivityCompleted1 from "../repositories/etl_weeklyScoreRepository.js";
import CumulativeUtils_load from "../google_sheet_utils/cumulativeUtils.js";
// import masterSheetUtils from "../google_sheet_utils/masterSheetUtils.js";
// import { generateStudentReportCSV } from "../utils/csvReportGenerator.js";

const runCumulativeSheets = async () => {
//  await generateStudentReportCSV();
//   return;
  // let a = await masterSheetUtils(100);
  // console.log(a);
  // return;

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

export default { runCumulativeSheets };
