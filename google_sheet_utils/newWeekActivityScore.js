import getDataFromPostgres1 from "../repositories/etl_weeklyScoreRepository.js";
import { weekEndScoreCalculation } from "../utils/chatbotUtils.js";

const newWeekActivityScore = async (data_list, grp, courseid) => {
  try {
    const phone_list = await getDataFromPostgres1.getDataFromPostgres(grp);
    const phoneNumbers = phone_list.map((item) => item.phoneNumber);
<<<<<<< HEAD
=======
    // const currentDate1 = new Date();
    // const currentDate = currentDate1.toISOString().split("T")[0];

>>>>>>> 7d817916db3ad77d00d2d8498955706dca5f682b
    let totalcount = [];

    const activityMap = new Map(
      data_list.map((entry) => [
        entry.phoneNumber,
        {
          completion_match1: entry.completion_match1 || 0,
          completion_match2: entry.completion_match2 || 0,
          completion_match3: entry.completion_match3 || 0,
          completion_match4: entry.completion_match4 || 0,
        },
      ])
    );

    for (const phoneNumber of phoneNumbers) {
      const activities = activityMap.get(phoneNumber) || {
        completion_match1: 0,
        completion_match2: 0,
        completion_match3: 0,
        completion_match4: 0,
      };

      let scoreCount = [];
      for (let i = 1; i <= 4; i++) {
        let scorePart;
        const completion = activities[`completion_match${i}`];
        if (completion === 0) {
           scorePart = '';
        } else {
          const calculatedScore = await weekEndScoreCalculation(phoneNumber, i, courseid);
          scorePart = isNaN(calculatedScore) ? "0%" : `${calculatedScore}%`;
        }
        scoreCount.push(scorePart);
      }

      totalcount.push(scoreCount);
    }
    return totalcount;
  } catch (error) {
    console.error("Error in newWeekActivityScore:", error);
    error.fileName = "getWeeklyDate.js";
    throw error; 
  }
};

export default newWeekActivityScore;
