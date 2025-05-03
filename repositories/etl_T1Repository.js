import sequelize from "../config/sequelize.js";
import waPurchasedCoursesRepository from '../repositories/waPurchasedCoursesRepository.js';
import waUsersMetadataRepository from '../repositories/waUsersMetadataRepository.js';


const getDataFromPostgres = async (date, grp, course_id) => {
  try {
    const qry =
      `select m."phoneNumber", m."name",count(case when (Date(l."startTime") <= ` +
      `'${date}'` +
      ` and l."completionStatus" = 'Completed') Then 1 else null end) ` +
      `as "activity_completd" from "wa_users_metadata" m left join "wa_lessons_completed" l on m."phoneNumber" = l."phoneNumber" and l."courseId" = ${course_id} ` +
      `where m."targetGroup" = ` +
      `'${grp}' ` +
      ` group by m."name", m."phoneNumber" order by m."name" asc;`;

    const res = await sequelize.query(qry);

    return res[0];
  } catch (error) {
    error.fileName = "etlRepository.js";
    throw error;
  }
};

const getDashboardStats = async () => {
  try {
    const linkClickedCount = await waUsersMetadataRepository.getTotalUsersCount();
    const freeDemoStartedCount = await waUsersMetadataRepository.getFreeDemoStartedUsersCount();
    const freeDemoEndedCount = await waUsersMetadataRepository.getFreeDemoEndedUsersCount();
    const registeredUsersCount = await waUsersMetadataRepository.getRegisteredUsersCount();
    const selectedUsersCount = await waUsersMetadataRepository.getSelectedUsersCount();

    const linkClickedPercentage = 0;
    const freeDemoStartedPercentage = ((freeDemoStartedCount / linkClickedCount) * 100).toFixed(2);
    const freeDemoEndedPercentage = ((freeDemoEndedCount / freeDemoStartedCount) * 100).toFixed(2);
    const registeredUsersPercentage = ((registeredUsersCount / linkClickedCount) * 100).toFixed(2);
    const selectedUsersPercentage = ((selectedUsersCount / registeredUsersCount) * 100).toFixed(2);

    return {
      "linkClicked": {
        "count": linkClickedCount,
        "percentage": linkClickedPercentage
      },
      "freeDemoStarted": {
        "count": freeDemoStartedCount,
        "percentage": freeDemoStartedPercentage,
      },
      "freeDemoEnded": {
        "count": freeDemoEndedCount,
        "percentage": freeDemoEndedPercentage
      },
      "registeredUsers": {
        "count": registeredUsersCount,
        "percentage": registeredUsersPercentage
      },
      "selectedUsers": {
        "count": selectedUsersCount,
        "percentage": selectedUsersPercentage
      },
    };
  } catch (error) {
    error.fileName = "etlRepository.js";
    throw error;
  }
};

export default { getDataFromPostgres, getDashboardStats };
