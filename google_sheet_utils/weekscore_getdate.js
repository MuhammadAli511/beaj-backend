import getDataFromPostgres1 from "../repositories/etl_weeklyScoreRepository.js";
import getDataActivityComplete1 from "../repositories/etl_weeklyScoreRepository.js";
import { weekEndScoreCalculation } from "../utils/chatbotUtils.js";
const getWeeklyDate = async (grp, courseid) => {
  try {
    const phone_list = await getDataFromPostgres1.getDataFromPostgres(grp);
    const phoneNumbers = phone_list.map((item) => item.phoneNumber);
    const currentDate1 = new Date();
    const currentDate = currentDate1.toISOString().split("T")[0];
    var scoreCount = [],
      totalcount = [];
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
      
      scoreCount = [];
      for (const phoneNumber of phoneNumbers) {
        const completion_match = activityMap.get(phoneNumber) || 0;
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
          const calculatedScore = await weekEndScoreCalculation(
            phoneNumber,
            4,
            courseid
          );
          score_pert = isNaN(calculatedScore) ? "0%" : `${calculatedScore}%`;
        }
        scoreCount.push(score_pert);
      }
      totalcount.push(scoreCount);
    }

    return totalcount;
  } catch (error) {
    error.fileName = "getWeeklyDate.js";
  }
};

export default getWeeklyDate;
