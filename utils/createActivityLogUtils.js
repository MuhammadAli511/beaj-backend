import waUserProgressRepository from "../repositories/waUserProgressRepository.js";
import waUserActivityLogsRepository from "../repositories/waUserActivityLogsRepository.js";
import azureBlobStorage from "./azureBlobStorage.js";
import { retrieveMediaURL } from "./whatsappUtils.js";
import { getProfileIdForRequest, getBotPhoneNumberIdForRequest } from "./requestContext.js";

const createActivityLog = async (
    phoneNumber,
    actionType,
    messageDirection,
    messageContent,
    metadata,
    caption = null
) => {
    const profileId = getProfileIdForRequest();
    const botPhoneNumberId = getBotPhoneNumberIdForRequest();
    const userCurrentProgress = await waUserProgressRepository.getByProfileId(
        profileId
    );
    let courseId = null,
        lessonId = null,
        weekNumber = null,
        dayNumber = null,
        questionId = null,
        activityType = null,
        retryCount = null;

    if (userCurrentProgress) {
        courseId = userCurrentProgress.currentCourseId || null;
        lessonId = userCurrentProgress.currentLessonId || null;
        weekNumber = userCurrentProgress.currentWeek || null;
        dayNumber = userCurrentProgress.currentDay || null;
        questionId = userCurrentProgress.questionNumber || null;
        activityType = userCurrentProgress.activityType || null;
        retryCount = userCurrentProgress.retryCounter || null;
    }

    let finalMessageContent = messageContent;

    // Inbound
    if (actionType === "image" && messageDirection == 'inbound') {
        const mediaId = messageContent.image.id;
        const mediaResponse = await retrieveMediaURL(mediaId);
        const azureUrl = await azureBlobStorage.uploadToBlobStorage(
            mediaResponse.data,
            mediaId
        );
        finalMessageContent = azureUrl;
    } else if (actionType === "audio" && messageDirection == 'inbound') {
        const mediaId = messageContent.audio.id;
        const mediaResponse = await retrieveMediaURL(mediaId);
        const azureUrl = await azureBlobStorage.uploadToBlobStorage(
            mediaResponse.data,
            mediaId
        );
        finalMessageContent = azureUrl;
    } else if (actionType === "video" && messageDirection == 'inbound') {
        const mediaId = messageContent.video.id;
        const mediaResponse = await retrieveMediaURL(mediaId);
        const azureUrl = await azureBlobStorage.uploadToBlobStorage(
            mediaResponse.data,
            mediaId
        );
        finalMessageContent = azureUrl;
    } else if (actionType === "text" && messageDirection == 'inbound') {
        finalMessageContent = messageContent;
    } else if (actionType === "interactive" && messageDirection == 'inbound') {
        finalMessageContent = messageContent;
    }


    // Outbound
    if (messageDirection == 'outbound') {
        finalMessageContent = messageContent;
    }


    await waUserActivityLogsRepository.create({
        botPhoneNumber: botPhoneNumberId,
        profile_id: profileId,
        phoneNumber: phoneNumber,
        actionType: actionType,
        messageDirection: messageDirection,
        messageContent: [finalMessageContent, caption],
        metadata: metadata,
        courseId: courseId,
        lessonId: lessonId,
        weekNumber: weekNumber,
        dayNumber: dayNumber,
        questionId: questionId,
        activityType: activityType,
        retryCount: retryCount,
    });
};

export { createActivityLog };