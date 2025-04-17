import axios from "axios";
import { getPhoneNumberIdForRequest } from './requestContext.js';

const whatsappToken = process.env.WHATSAPP_TOKEN;
// Removing the hardcoded phone number IDs as they will be obtained from context
// const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
// const secondWhatsappPhoneNumberId = process.env.SECOND_WHATSAPP_PHONE_NUMBER_ID;

const sendMessage = async (to, body, retryAttempt = 0) => {
    const phoneNumberId = getPhoneNumberIdForRequest(); // Get ID from context
    const MAX_RETRIES = 17;

    try {
        await axios.post(
            `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
            {
                messaging_product: "whatsapp",
                to: to,
                text: { body: body },
            },
            {
                headers: {
                    Authorization: `Bearer ${whatsappToken}`,
                    "Content-Type": "application/json",
                },
            }
        );
        let logger = `Outbound Message: User: ${to}, From ID: ${phoneNumberId}, Message Type: text, Message Content: ${body}`;
        console.log(logger);
    } catch (error) {
        const errData = error.response ? error.response.data : null;
        console.log(`Error sending message (from ${phoneNumberId}). Attempt ${retryAttempt + 1} of ${MAX_RETRIES}`);

        if (retryAttempt < MAX_RETRIES) {
            const waitTimeSeconds = retryAttempt === 0 ? 1 : Math.min(retryAttempt * 4, 60);
            console.log(`Retrying after ${waitTimeSeconds} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, waitTimeSeconds * 1000));
            return sendMessage(to, body, retryAttempt + 1);
        } else {
            console.log(`Max retries reached. Giving up on message to ${to} from ${phoneNumberId}.`);
            console.log("Final error:", errData ? errData : error.message);
        }
    }
};


const retrieveMediaURL = async (mediaId, retryAttempt = 0) => {
    const MAX_RETRIES = 17;

    try {
        const mediaResponse = await axios.get(
            `https://graph.facebook.com/v20.0/${mediaId}`,
            {
                headers: {
                    Authorization: `Bearer ${whatsappToken}`,
                },
            }
        );

        const audioUrl = mediaResponse.data.url;

        const audioResponse = await axios.get(audioUrl, {
            responseType: "arraybuffer",
            headers: {
                Authorization: `Bearer ${whatsappToken}`,
            },
        });

        return audioResponse;

    } catch (error) {
        const errData = error.response ? error.response.data : null;
        console.log(`Error retrieving media. Attempt ${retryAttempt + 1} of ${MAX_RETRIES}`);
        if (retryAttempt < MAX_RETRIES) {
            const waitTimeSeconds = retryAttempt === 0 ? 1 : Math.min(retryAttempt * 4, 60);
            console.log(`Retrying after ${waitTimeSeconds} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, waitTimeSeconds * 1000));
            return retrieveMediaURL(mediaId, retryAttempt + 1);
        } else {
            console.log(`Max retries reached. Giving up on media retrieval for ${mediaId}.`);
            console.log("Final error:", errData ? errData : error.message);
        }

    }
};


const sendMediaMessage = async (to, mediaUrl, mediaType, captionText = null, retryAttempt = 0) => {
    const phoneNumberId = getPhoneNumberIdForRequest(); // Get ID from context
    const MAX_RETRIES = 17;
    try {
        let requestBody;
        if (mediaType == 'video') {
            requestBody = {
                messaging_product: 'whatsapp',
                to: to,
                type: 'video',
                video: { link: mediaUrl, caption: captionText },
            };
        } else if (mediaType == 'audio') {
            requestBody = {
                messaging_product: 'whatsapp',
                to: to,
                type: 'audio',
                audio: { link: mediaUrl },
            };
        } else if (mediaType == 'image') {
            requestBody = {
                messaging_product: 'whatsapp',
                to: to,
                type: 'image',
                image: { link: mediaUrl, caption: captionText },
            };
        } else if (mediaType == 'sticker') {
            requestBody = {
                messaging_product: 'whatsapp',
                to: to,
                type: 'sticker',
                sticker: { link: mediaUrl },
            };
        } else {
            console.log('Invalid media type:', mediaType);
            return; // Avoid sending request if type is invalid
        }

        await axios.post(
            `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
            requestBody,
            {
                headers: {
                    Authorization: `Bearer ${whatsappToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        let logger = `Outbound Message: User: ${to}, From ID: ${phoneNumberId}, Message Type: ${mediaType}, Message Content: ${mediaUrl}`;
        console.log(logger);
    } catch (error) {
        const errData = error.response ? error.response.data : null;
        console.log(`Error sending media message (from ${phoneNumberId}). Attempt ${retryAttempt + 1} of ${MAX_RETRIES}`);
        if (retryAttempt < MAX_RETRIES) {
            const waitTimeSeconds = retryAttempt === 0 ? 1 : Math.min(retryAttempt * 4, 60);
            console.log(`Retrying after ${waitTimeSeconds} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, waitTimeSeconds * 1000));
            return sendMediaMessage(to, mediaUrl, mediaType, captionText, retryAttempt + 1);
        } else {
            console.log(`Max retries reached. Giving up on media message to ${to} from ${phoneNumberId}.`);
            console.log("Final error:", errData ? errData : error.message);
        }
    }
};

const sendButtonMessage = async (to, bodyText, buttonOptions, retryAttempt = 0, imageUrl = null, videoUrl = null) => {
    const phoneNumberId = getPhoneNumberIdForRequest(); // Get ID from context
    const MAX_RETRIES = 17;

    try {
        let interactivePayload = {
            type: 'button',
            body: {
                text: bodyText
            },
            action: {
                buttons: buttonOptions.map(option => ({
                    type: 'reply',
                    reply: {
                        id: option.id,
                        title: option.title
                    }
                }))
            }
        };

        if (imageUrl) {
            interactivePayload.header = { type: 'image', image: { link: imageUrl } };
        } else if (videoUrl) {
            interactivePayload.header = { type: 'video', video: { link: videoUrl } };
        }

        await axios.post(
            `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'interactive',
                interactive: interactivePayload
            },
            {
                headers: {
                    Authorization: `Bearer ${whatsappToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        let logger = `Outbound Message: User: ${to}, From ID: ${phoneNumberId}, Message Type: button, Message Content: ${bodyText}`;
        console.log(logger);
    } catch (error) {
        const errData = error.response ? error.response.data : null;
        console.log(`Error sending button message (from ${phoneNumberId}). Attempt ${retryAttempt + 1} of ${MAX_RETRIES}`);
        if (retryAttempt < MAX_RETRIES) {
            const waitTimeSeconds = retryAttempt === 0 ? 1 : Math.min(retryAttempt * 4, 60);
            console.log(`Retrying after ${waitTimeSeconds} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, waitTimeSeconds * 1000));
            if (imageUrl) {
                return sendButtonMessage(to, bodyText, buttonOptions, retryAttempt + 1, imageUrl);
            } else if (videoUrl) {
                return sendButtonMessage(to, bodyText, buttonOptions, retryAttempt + 1, null, videoUrl);
            } else {
                return sendButtonMessage(to, bodyText, buttonOptions, retryAttempt + 1);
            }
        } else {
            console.log(`Max retries reached. Giving up on button message to ${to} from ${phoneNumberId}.`);
            console.log("Final error:", errData ? errData : error.message);
        }
    }
};


export { sendMessage, sendMediaMessage, sendButtonMessage, retrieveMediaURL };