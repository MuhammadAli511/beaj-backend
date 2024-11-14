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
    var scoreCount = [],
      totalcount = [];
    if (currentDate >= "2024-11-11" && currentDate <= "2024-11-17") {
      for (const phoneNumber of phoneNumbers) {
        const score_pert = await weekEndScoreCalculation(
          phoneNumber,
          1,
          courseid
        );
        const scoreToAdd = isNaN(score_pert) ? "0%" : `${score_pert}%`;
        scoreCount.push(scoreToAdd);
      }
      // console.log(scoreCount);
      totalcount.push(scoreCount);
    }
    if (currentDate >= "2024-11-18" && currentDate <= "2024-11-24") {
      for (const phoneNumber of phoneNumbers) {
        const score_pert = await weekEndScoreCalculation(
          phoneNumber,
          2,
          courseid
        );
        const scoreToAdd = isNaN(score_pert) ? "0%" : `${score_pert}%`;
        scoreCount.push(scoreToAdd);
      }
      totalcount.push(scoreCount);
    }

    if (currentDate >= "2024-11-25" && currentDate <= "2024-12-01") {
      for (const phoneNumber of phoneNumbers) {
        const score_pert = await weekEndScoreCalculation(
          phoneNumber,
          3,
          courseid
        );
        const scoreToAdd = isNaN(score_pert) ? "0%" : `${score_pert}%`;
        scoreCount.push(scoreToAdd);
      }
      totalcount.push(scoreCount);
    }

    if (currentDate >= "2024-12-02" && currentDate <= "2024-12-08") {
      for (const phoneNumber of phoneNumbers) {
        const score_pert = await weekEndScoreCalculation(
          phoneNumber,
          4,
          courseid
        );
        const scoreToAdd = isNaN(score_pert) ? "0%" : `${score_pert}%`;
        scoreCount.push(scoreToAdd);
      }
      totalcount.push(scoreCount);
    }

    // console.log(totalcount);
    return totalcount;
  } catch (error) {
    error.fileName = "getWeeklyDate.js";
  }
};

export default getWeeklyDate;
