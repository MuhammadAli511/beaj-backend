import waUserActivityLogsRepository from "../repositories/waUserActivityLogsRepository.js";
import { sendMessage, sendMediaMessage, sendContactCardMessage } from "../utils/whatsappUtils.js";
import { createActivityLog } from "../utils/createActivityLogUtils.js";
import { sleep } from "../utils/utils.js";
import { studentBotContactData, teacherBotContactData } from "../constants/contacts.js";
import { talkToBeajRep } from "../utils/chatbotUtils.js";
import AIServices from "../services/AIServices.js";
import waConstantsRepository from "../repositories/waConstantsRepository.js";

const marketingBotFlow = async (profileId, messageContent, messageType, userMobileNumber) => {
    if (messageContent.toLowerCase() == "yes" || messageContent.toLowerCase() == "no") {
        const marketingPreviousMessages = await waUserActivityLogsRepository.getLastMarketingBotMessage(userMobileNumber);
        const lastMessage = marketingPreviousMessages.dataValues.messageContent;
        if (lastMessage == "type1_consent" || lastMessage == "type2_consent" || lastMessage == "type3_consent") {
            await sendMessage(userMobileNumber, "Response recorded");
            await createActivityLog(userMobileNumber, "text", "outbound", "Response recorded", null);
            return;
        }
    }

    if (!["text", "button", "interactive"].includes(messageType)) {
        await sendMessage(userMobileNumber, "Sorry, I am not able to respond to your question. I only accept text messages.");
        await createActivityLog(userMobileNumber, "text", "outbound", "Sorry, I am not able to respond to your question. I only accept text messages.", null);
        return;
    }
    const previousMessages = await waUserActivityLogsRepository.getMarketingBotChatHistory(userMobileNumber);
    if (previousMessages == null) {
        await sendMessage(userMobileNumber, "Sorry, I have received too many messages from you in the past hour. Please try again later.");
        await createActivityLog(userMobileNumber, "text", "outbound", "Sorry, I have received too many messages from you in the past hour. Please try again later.", null);
        return;
    }
    let response = await AIServices.marketingBotResponse(previousMessages);
    const imageResponse = response.match(/<IMAGE>(.*?)<\/IMAGE>/)?.[1];
    const contactResponse = response.match(/<CONTACT>(.*?)<\/CONTACT>/)?.[1];
    response = response.replace(/<IMAGE>(.*?)<\/IMAGE>/g, "").replace(/<CONTACT>(.*?)<\/CONTACT>/g, "");
    if (response) {
        await sendMessage(userMobileNumber, response);
    }
    if (imageResponse) {
        if (imageResponse.toLowerCase() == "flyer image") {
            const flyer = await waConstantsRepository.getByKey("COMBINED_FLYER");
            if (flyer && flyer.dataValues) {
                await sendMediaMessage(userMobileNumber, flyer.dataValues.constantValue, "image", null, 0, "WA_Constants", flyer.dataValues.id, flyer.dataValues.constantMediaId, "constantMediaId");
                await sleep(2000);
            }
        }
    }
    if (contactResponse) {
        if (contactResponse.toLowerCase() == "student trial bot") {
            await sendContactCardMessage(userMobileNumber, studentBotContactData);
            let contactCardMessage = `👆Click on the Message button to get your student trial started.`;
            await sendMessage(userMobileNumber, contactCardMessage);
            await createActivityLog(userMobileNumber, "text", "outbound", contactCardMessage, null);
        } else if (contactResponse.toLowerCase() == "teacher trial bot") {
            await sendContactCardMessage(userMobileNumber, teacherBotContactData);
            let contactCardMessage = `👆Click on the Message button to get your teacher trial started.`;
            await sendMessage(userMobileNumber, contactCardMessage);
            await createActivityLog(userMobileNumber, "text", "outbound", contactCardMessage, null);
        } else if (contactResponse.toLowerCase() == "team member") {
            await talkToBeajRep(profileId, userMobileNumber);
        }
    }
    await createActivityLog(userMobileNumber, "text", "outbound", response, null);
    return;
};

export { marketingBotFlow };