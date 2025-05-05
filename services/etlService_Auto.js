import etlRepository from "../repositories/etlRepository.js";
import { generateCertificatesForEligibleStudents } from '../google_sheet_utils/certificate-utils.js';
import new_loadDataToGoogleSheets from "../google_sheet_utils/auto_GoogleSheetUtils.js";

const runETL = async (targetGroup, module, cohort, co_no, facilitator) => {
  try {
    const comparisonDate = new Date('2025-04-07');
    const today = new Date();

    let courseId_l1 = null;
    let courseId_l2 = null;
    let courseId_l3 = null;
    let flag_valid = 0;

    if (co_no > 0 && co_no < 25 && targetGroup == "T1") {
      courseId_l1 = 106;
      courseId_l2 = 111;
      courseId_l3 = 118;
      flag_valid = 1;
    }
    else if (co_no > 24 && co_no < 49 && targetGroup == "T2") {
      courseId_l1 = 105;
      courseId_l2 = 110;
      courseId_l3 = 112;
      flag_valid = 1;
    }
    else if (cohort == "Pilot" && targetGroup == "T1") {
      courseId_l1 = 98;
      courseId_l2 = 104;
      courseId_l3 = 109;
      flag_valid = 1;
    }
    else if (cohort == "Pilot" && targetGroup == "T2") {
      courseId_l1 = 99;
      courseId_l2 = 103;
      courseId_l3 = 108;
      flag_valid = 1;
    }

    if ((facilitator == 9 || facilitator == 10) || today >= comparisonDate) {
      if (flag_valid == 1 && module && facilitator) {
        let arrayT1_List = [], ActivityCompletedCount = [];
        let last_activityCompleted_l1 = [], last_activityCompleted_l2 = [], last_activityCompleted_l3 = [];
        await new_loadDataToGoogleSheets(
          arrayT1_List,
          facilitator,
          `${module} ${targetGroup}-${cohort}`,
          flag_valid,
          ActivityCompletedCount,
          last_activityCompleted_l1,
          last_activityCompleted_l2,
          last_activityCompleted_l3
        );
        let module_week = module;
        flag_valid = 2;

        if (module == "Lesson") {
          arrayT1_List = await etlRepository.getLessonCompletions(courseId_l1, courseId_l2, courseId_l3, targetGroup, cohort);
          arrayT1_List = arrayT1_List.map(obj => Object.values(obj).map(value => value));
        }

        if (module == "Activity") {
          arrayT1_List = await etlRepository.getActivity_Completions(courseId_l1, courseId_l2, courseId_l3, targetGroup, cohort);
          arrayT1_List = arrayT1_List.map(obj => Object.values(obj).map(value => value));
          ActivityCompletedCount = await etlRepository.getActivityNameCount(courseId_l1, courseId_l2, courseId_l3, targetGroup, cohort);

          last_activityCompleted_l1 = await etlRepository.getLastActivityCompleted(courseId_l1, targetGroup, cohort);
          last_activityCompleted_l1 = last_activityCompleted_l1.map(obj => Object.values(obj).map(value => parseInt(value, 10)));
          last_activityCompleted_l2 = await etlRepository.getLastActivityCompleted(courseId_l2, targetGroup, cohort);
          last_activityCompleted_l2 = last_activityCompleted_l2.map(obj => Object.values(obj).map(value => parseInt(value, 10)));
          last_activityCompleted_l3 = await etlRepository.getLastActivityCompleted(courseId_l3, targetGroup, cohort);
          last_activityCompleted_l3 = last_activityCompleted_l3.map(obj => Object.values(obj).map(value => parseInt(value, 10)));
        }

        if (module == "Week") {
          let weekly_score_l1_list = await etlRepository.getWeeklyScore(courseId_l1, targetGroup, cohort);
          let weekly_score_l2_list = await etlRepository.getWeeklyScore(courseId_l2, targetGroup, cohort);
          let weekly_score_l3_list = await etlRepository.getWeeklyScore(courseId_l3, targetGroup, cohort);

          for (let i = 0; i < weekly_score_l1_list.length; i++) {

            const l1_entry = weekly_score_l1_list[i];
            const l2_entry = weekly_score_l2_list[i];
            const l3_entry = weekly_score_l3_list[i];

            arrayT1_List.push([
              l1_entry.sr_no,
              l1_entry.phoneNumber,
              l1_entry.name,
              l1_entry.final_percentage_week1,
              l1_entry.final_percentage_week2,
              l1_entry.final_percentage_week3,
              l1_entry.final_percentage_week4,
              null,
              l2_entry.final_percentage_week1,
              l2_entry.final_percentage_week2,
              l2_entry.final_percentage_week3,
              l2_entry.final_percentage_week4,
              null,
              l3_entry.final_percentage_week1,
              l3_entry.final_percentage_week2,
              l3_entry.final_percentage_week3,
              l3_entry.final_percentage_week4,
              null,
              null
            ])
          }

          arrayT1_List = arrayT1_List.map(obj => Object.values(obj).map(value => value));

        }

        await new_loadDataToGoogleSheets(
          arrayT1_List,
          facilitator,
          `${module} ${targetGroup}-${cohort}`,
          flag_valid,
          ActivityCompletedCount,
          last_activityCompleted_l1,
          last_activityCompleted_l2,
          last_activityCompleted_l3,
          module_week,
        );
        if (module == "Week") {
          if (arrayT1_List) {
            console.log(arrayT1_List);
            await generateCertificatesForEligibleStudents(arrayT1_List, 'weekly', targetGroup, cohort);
          }
        }
      }
    }
    // Check if the current date matches the target date
    else {
      if (flag_valid == 1 && module && facilitator) {
        let arrayT1_List = [], ActivityCompletedCount = [];
        let last_activityCompleted_l1 = [], last_activityCompleted_l2 = [], last_activityCompleted_l3 = [];
        await new_loadDataToGoogleSheets(
          arrayT1_List,
          facilitator,
          `${module} ${targetGroup}-${cohort}`,
          flag_valid,
          ActivityCompletedCount,
          last_activityCompleted_l1,
          last_activityCompleted_l2,
          last_activityCompleted_l3
        );
        let module_week = module;
        flag_valid = 2;

        let phone_list = await etlRepository.getPhoneNumber_userNudges(courseId_l2, targetGroup, cohort, '2025-03-24');
        const phoneSet = new Set(phone_list.map(item => item.phoneNumber));

        if (module == "Lesson") {
          arrayT1_List = await etlRepository.getLessonCompletions(courseId_l1, courseId_l2, courseId_l3, targetGroup, cohort);

          let temp_list = arrayT1_List.filter(user => phoneSet.has(user.phoneNumber));

          arrayT1_List = arrayT1_List.filter(record => record.course2_week4 !== '6' && record.course1_week1 !== null);

          arrayT1_List = [...arrayT1_List, ...temp_list];

          const uniqueList = [];
          const phoneNumbersSeen = new Set();

          arrayT1_List.forEach(record => {
            if (!phoneNumbersSeen.has(record.phoneNumber)) {
              uniqueList.push(record);
              phoneNumbersSeen.add(record.phoneNumber);
            }
          });
          arrayT1_List = uniqueList;

          console.log(arrayT1_List);

          arrayT1_List = arrayT1_List.map(obj => Object.values(obj));
          arrayT1_List.forEach((record, index) => { record[0] = index + 1; });
        }

        if (module == "Activity") {
          arrayT1_List = await etlRepository.getActivity_Completions(courseId_l1, courseId_l2, courseId_l3, targetGroup, cohort);

          let temp_list = arrayT1_List.filter(user => phoneSet.has(user.phoneNumber));

          if (targetGroup == "T1") {
            arrayT1_List = arrayT1_List.filter(record => record.course2_week4_activities !== '18');
          } else {
            arrayT1_List = arrayT1_List.filter(record => record.course2_week4_activities !== '20');
          }

          arrayT1_List = arrayT1_List.filter(record => record.course1_week1_activities !== null);
          arrayT1_List = [...arrayT1_List, ...temp_list];
          const uniqueList = [];
          const phoneNumbersSeen = new Set();

          arrayT1_List.forEach(record => {
            if (!phoneNumbersSeen.has(record.phoneNumber)) {
              uniqueList.push(record);
              phoneNumbersSeen.add(record.phoneNumber);
            }
          });
          arrayT1_List = uniqueList;

          arrayT1_List = arrayT1_List.map(obj => Object.values(obj));
          arrayT1_List.forEach((record, index) => { record[0] = index + 1; });

          ActivityCompletedCount = [];
          last_activityCompleted_l1 = await etlRepository.getLastActivityCompleted(courseId_l1, targetGroup, cohort);
          last_activityCompleted_l1 = last_activityCompleted_l1.map(obj => Object.values(obj).map(value => parseInt(value, 10)));

          last_activityCompleted_l2 = await etlRepository.getLastActivityCompleted(courseId_l2, targetGroup, cohort);
          last_activityCompleted_l2 = last_activityCompleted_l2.map(obj => Object.values(obj).map(value => parseInt(value, 10)));

          last_activityCompleted_l3 = await etlRepository.getLastActivityCompleted(courseId_l3, targetGroup, cohort);
          last_activityCompleted_l3 = last_activityCompleted_l3.map(obj => Object.values(obj).map(value => parseInt(value, 10)));
        }

        if (module == "Week") {
          let weekly_score_l1_list = await etlRepository.getWeeklyScore(courseId_l1, targetGroup, cohort);
          let weekly_score_l2_list = await etlRepository.getWeeklyScore(courseId_l2, targetGroup, cohort);
          let weekly_score_l3_list = await etlRepository.getWeeklyScore(courseId_l3, targetGroup, cohort);

          for (let i = 0; i < weekly_score_l1_list.length; i++) {
            const l1_entry = weekly_score_l1_list[i];
            const l2_entry = weekly_score_l2_list[i];
            const l3_entry = weekly_score_l3_list[i];

            arrayT1_List.push([
              l1_entry.sr_no,
              l1_entry.phoneNumber,
              l1_entry.name,
              l1_entry.final_percentage_week1,
              l1_entry.final_percentage_week2,
              l1_entry.final_percentage_week3,
              l1_entry.final_percentage_week4,
              null,
              l2_entry.final_percentage_week1,
              l2_entry.final_percentage_week2,
              l2_entry.final_percentage_week3,
              l2_entry.final_percentage_week4,
              null,
              l3_entry.final_percentage_week1,
              l3_entry.final_percentage_week2,
              l3_entry.final_percentage_week3,
              l3_entry.final_percentage_week4,
              null,
              null
            ]);
          }

          let temp_list = arrayT1_List.filter(user => phoneSet.has(user[1]));
          arrayT1_List = arrayT1_List.filter(record => record[11] === null && record[3] !== null);
          arrayT1_List = [...arrayT1_List, ...temp_list];


          arrayT1_List = arrayT1_List.map(obj => Object.values(obj));
          arrayT1_List.forEach((record, index) => { record[0] = index + 1; });
        }

        await new_loadDataToGoogleSheets(
          arrayT1_List,
          facilitator,
          `${module} ${targetGroup}-${cohort}`,
          flag_valid,
          ActivityCompletedCount,
          last_activityCompleted_l1,
          last_activityCompleted_l2,
          last_activityCompleted_l3,
          module_week,
        );
        console.log("Todat is the target date!");
      }
    }

  } catch (error) {
    error.fileName = "etlService_Auto.js";
    throw error;
  }
};

export default { runETL };
