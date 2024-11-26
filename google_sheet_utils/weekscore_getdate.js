// import weeklyscore_repo from "../repositories/etl_weeklyScoreRepository.js";
// const getWeeklyDate = async (grp, courseid) => {
//   try {
//     const currentDate1 = new Date();
//     const currentDate = currentDate1.toISOString().split("T")[0];
//     var weeklyCnt = [];
//     // Level

//     // const dateRanges = [
//     //   { start: "2024-10-26", end: "2024-11-17" },
//     //   { start: "2024-11-18", end: "2024-11-24" },
//     //   { start: "2024-11-25", end: "2024-12-01" },
//     //   { start: "2024-12-02", end: "2024-12-08" },
//     // ];
//     const dateRanges = [
//       { start: "2024-10-26", end: "2024-10-31" },
//       { start: "2024-11-01", end: "2024-11-06" },
//       { start: "2024-11-25", end: "2024-12-01" },
//       { start: "2024-12-02", end: "2024-12-08" },
//     ];

//     let matchedStartDate = null;
//     let matchedEndDate = null;

//     for (const range of dateRanges) {
//       const startDate = range.start;
//       const endDate = range.end;

//       //   if (currentDate >= startDate && currentDate <= endDate) {

//       if (currentDate >= endDate) {
//         matchedStartDate = range.start;
//         matchedEndDate = range.end;

//         const week_sore_list = await weeklyscore_repo.getDataFromPostgres(
//           courseid,
//           matchedStartDate,
//           matchedEndDate,
//           grp
//         );

//         weeklyCnt.push(week_sore_list);
//       }
//     }

//     return weeklyCnt;
//   } catch (error) {
//     error.fileName = "getWeeklyDate.js";
//   }
// };

// export default getWeeklyDate;

import getDataFromPostgres1 from "../repositories/etl_weeklyScoreRepository.js";
import getDataActivityComplete1 from "../repositories/etl_weeklyScoreRepository.js";
import { weekEndScoreCalculation } from "../utils/chatbotUtils.js";
const getWeeklyDate = async (grp, courseid) => {
  try {
    // console.log("ggg1");
    const phone_list = await getDataFromPostgres1.getDataFromPostgres(grp);
    // console.log(phone_list);
    // console.log("ggg2");
    const phoneNumbers = phone_list.map((item) => item.phoneNumber);
    const currentDate1 = new Date();
    const currentDate = currentDate1.toISOString().split("T")[0];
    // console.log(currentDate);
    // const currentDate = "2024-12-02";
    var scoreCount = [],
      totalcount = [];
    // const dateRanges = [
    //   { endDate: "2024-11-17", weekNum: 1 },
    //   { endDate: "2024-11-24", weekNum: 2 },
    //   { endDate: "2024-12-01", weekNum: 3 },
    //   { endDate: "2024-12-08", weekNum: 4 },
    // ];

    if (currentDate >= "2024-11-11") {
      const activity_total =
        await getDataActivityComplete1.getDataActivityComplete(
          "2024-11-17",
          grp,
          courseid,
          1
        );
      const activityMap = new Map(
        activity_total.map((entry) => [
          entry.phoneNumber,
          entry.completion_match,
        ])
      );
      // console.log(activity_total);
      scoreCount = [];
      for (const phoneNumber of phoneNumbers) {
        const completion_match = activityMap.get(phoneNumber) || 0;
        // console.log(phoneNumber);
        let score_pert;
        if (completion_match === 0) {
          score_pert = "0%";
        } else {
          const calculatedScore = await weekEndScoreCalculation(
            phoneNumber,
            1,
            courseid
          );
          score_pert = isNaN(calculatedScore) ? "0%" : `${calculatedScore}%`;
        }
        scoreCount.push(score_pert);
      }
      // console.log(scoreCount);

      totalcount.push(scoreCount);
    }
    if (currentDate >= "2024-11-18") {
      const activity_total =
        await getDataActivityComplete1.getDataActivityComplete(
          "2024-11-24",
          grp,
          courseid,
          2
        );
      const activityMap = new Map(
        activity_total.map((entry) => [
          entry.phoneNumber,
          entry.completion_match,
        ])
      );
      scoreCount = [];
      for (const phoneNumber of phoneNumbers) {
        const completion_match = activityMap.get(phoneNumber) || 0;
        let score_pert;
        if (completion_match === 0) {
          score_pert = "0%";
        } else {
          score_pert = await weekEndScoreCalculation(phoneNumber, 2, courseid);
          score_pert = isNaN(score_pert) ? "0%" : `${score_pert}%`;
        }
        scoreCount.push(score_pert);
      }
      // console.log(scoreCount);
      totalcount.push(scoreCount);
    }

    if (currentDate >= "2024-11-25") {
      const activity_total =
        await getDataActivityComplete1.getDataActivityComplete(
          "2024-12-01",
          grp,
          courseid,
          3
        );
      const activityMap = new Map(
        activity_total.map((entry) => [
          entry.phoneNumber,
          entry.completion_match,
        ])
      );
      scoreCount = [];
      for (const phoneNumber of phoneNumbers) {
        const completion_match = activityMap.get(phoneNumber) || 0;
        let score_pert;
        if (completion_match === 0) {
          score_pert = "0%";
        } else {
          score_pert = await weekEndScoreCalculation(phoneNumber, 3, courseid);
          score_pert = isNaN(score_pert) ? "0%" : `${score_pert}%`;
        }
        scoreCount.push(score_pert);
      }
      // console.log(scoreCount);
      totalcount.push(scoreCount);
    }

    if (currentDate >= "2024-12-02") {
      const activity_total =
        await getDataActivityComplete1.getDataActivityComplete(
          "2024-12-08",
          grp,
          courseid,
          4
        );
      console.log("Activity total for week 4:", activity_total);

      const activityMap = new Map(
        activity_total.map((entry) => [
          entry.phoneNumber,
          entry.completion_match,
        ])
      );
      console.log("Activity Map for week 4:", activityMap);

      scoreCount = [];
      for (const phoneNumber of phoneNumbers) {
        const completion_match = activityMap.get(phoneNumber) || 0;
        console.log(`Phone: ${phoneNumber}, Match: ${completion_match}`);

        let score_pert;
        if (completion_match === 0) {
          score_pert = "0%";
        } else {
          const calculatedScore = await weekEndScoreCalculation(
            phoneNumber,
            4,
            courseid
          );
          console.log(
            `Calculated score for phone ${phoneNumber}:`,
            calculatedScore
          );
          score_pert = isNaN(calculatedScore) ? "0%" : `${calculatedScore}%`;
        }
        scoreCount.push(score_pert);
      }
      console.log("Score Count for week 4:", scoreCount);
      totalcount.push(scoreCount);
    }

    console.log(totalcount);
    return totalcount;
  } catch (error) {
    error.fileName = "getWeeklyDate.js";
  }
};

export default getWeeklyDate;
