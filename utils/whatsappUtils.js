import axios from "axios";
import { getBotPhoneNumberIdForRequest } from './requestContext.js';
import DocumentFile from '../models/DocumentFile.js';
import SpeakActivityQuestion from '../models/SpeakActivityQuestion.js';
import MultipleChoiceQuestion from '../models/MultipleChoiceQuestion.js';
import MultipleChoiceQuestionAnswer from '../models/MultipleChoiceQuestionAnswer.js';

const modelToMediaIdField = {
    "DocumentFile": DocumentFile,
    "SpeakActivityQuestion": SpeakActivityQuestion,
    "MultipleChoiceQuestion": MultipleChoiceQuestion,
    "MultipleChoiceQuestionAnswer": MultipleChoiceQuestionAnswer
};

const whatsappToken = process.env.WHATSAPP_TOKEN;

const sendMessage = async (to, body, retryAttempt = 0) => {
    const phoneNumberId = getBotPhoneNumberIdForRequest();
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

// Function to save or update media ID in the database
const saveMediaIdToDatabase = async (modelName, recordId, mediaType, mediaId) => {
    try {
        const model = modelToMediaIdField[modelName];
        if (!model) {
            console.log(`Model ${modelName} not found in modelToMediaIdField`);
            return false;
        }
        const record = await model.findByPk(recordId);

        if (!record) {
            console.log(`Record with ID ${recordId} not found in ${model.tableName}`);
            return false;
        }

        // Create a field name based on the media type (e.g., imageMediaId, videoMediaId)
        const mediaIdField = `${mediaType}MediaId`;

        // Update the record with the new media ID
        await record.update({ [mediaIdField]: mediaId });
        console.log(`Updated ${mediaIdField} for ${model.tableName} record ${recordId}`);
        return true;
    } catch (error) {
        console.log(`Error updating media ID in database: ${error.message}`);
        return false;
    }
};

// Function to send media using ID directly
const sendMediaMessageWithId = async (to, mediaId, mediaType, captionText = null, retryAttempt = 0) => {
    const phoneNumberId = getBotPhoneNumberIdForRequest();
    const MAX_RETRIES = 17;

    try {
        let requestBody;
        if (mediaType === 'video') {
            requestBody = {
                messaging_product: 'whatsapp',
                to: to,
                type: 'video',
                video: { id: mediaId, caption: captionText },
            };
        } else if (mediaType === 'audio') {
            requestBody = {
                messaging_product: 'whatsapp',
                to: to,
                type: 'audio',
                audio: { id: mediaId },
            };
        } else if (mediaType === 'image') {
            requestBody = {
                messaging_product: 'whatsapp',
                to: to,
                type: 'image',
                image: { id: mediaId, caption: captionText },
            };
        } else if (mediaType === 'sticker') {
            requestBody = {
                messaging_product: 'whatsapp',
                to: to,
                type: 'sticker',
                sticker: { id: mediaId },
            };
        } else if (mediaType === 'pdf') {
            requestBody = {
                messaging_product: 'whatsapp',
                to: to,
                type: 'document',
                document: { id: mediaId, filename: captionText },
            };
        } else {
            console.log('Invalid media type:', mediaType);
            return { success: false, error: 'Invalid media type' };
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

        let logger = `Outbound Message: User: ${to}, From ID: ${phoneNumberId}, Message Type: ${mediaType}, Message Content: ${mediaId} (using ID)`;
        console.log(logger);
        return { success: true };
    } catch (error) {
        const errData = error.response ? error.response.data : null;
        console.log(`Error sending media message with ID (from ${phoneNumberId}). Attempt ${retryAttempt + 1} of ${MAX_RETRIES}`);

        // Check if the error indicates an expired or invalid media ID
        const errorCode = errData?.error?.code;
        const isExpiredMediaError = errorCode === 131053 || errorCode === 131026 || errorCode === 100;

        if (isExpiredMediaError) {
            console.log(`Media ID appears to be expired or invalid (Error code: ${errorCode})`);
            return { success: false, expired: true, error: errData };
        }

        if (retryAttempt < MAX_RETRIES) {
            const waitTimeSeconds = retryAttempt === 0 ? 1 : Math.min(retryAttempt * 4, 60);
            console.log(`Retrying after ${waitTimeSeconds} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, waitTimeSeconds * 1000));
            return sendMediaMessageWithId(to, mediaId, mediaType, captionText, retryAttempt + 1);
        } else {
            console.log(`Max retries reached. Giving up on media message to ${to} from ${phoneNumberId}.`);
            console.log("Final error:", errData ? errData : error.message);
            return { success: false, error: errData || error.message };
        }
    }
};

// Function to upload media to WhatsApp and get a media ID
const uploadMediaAndGetId = async (mediaUrl, mediaType) => {
    const phoneNumberId = getBotPhoneNumberIdForRequest();

    try {
        // First, download the media file
        const mediaResponse = await axios.get(mediaUrl, {
            responseType: 'arraybuffer'
        });

        // Get file extension from URL or default based on mediaType
        let fileExtension = '.jpg';
        if (mediaUrl.includes('.')) {
            const urlParts = mediaUrl.split('.');
            fileExtension = '.' + urlParts[urlParts.length - 1].split('?')[0];
        } else {
            if (mediaType === 'video') fileExtension = '.mp4';
            if (mediaType === 'audio') fileExtension = '.mp3';
            if (mediaType === 'pdf') fileExtension = '.pdf';
        }

        // Prepare form data for media upload
        const formData = new FormData();
        const blob = new Blob([mediaResponse.data]);
        formData.append('file', blob, `media${fileExtension}`);
        formData.append('messaging_product', 'whatsapp');
        formData.append('type', mediaType === 'pdf' ? 'document' : mediaType);

        // Upload the media to WhatsApp
        const uploadResponse = await axios.post(
            `https://graph.facebook.com/v20.0/${phoneNumberId}/media`,
            formData,
            {
                headers: {
                    Authorization: `Bearer ${whatsappToken}`,
                    'Content-Type': 'multipart/form-data',
                }
            }
        );

        console.log(`Successfully uploaded media and received ID: ${uploadResponse.data.id}`);
        return { success: true, mediaId: uploadResponse.data.id };
    } catch (error) {
        const errData = error.response ? error.response.data : null;
        console.log(`Error uploading media to get ID: ${errData ? JSON.stringify(errData) : error.message}`);
        return { success: false, error: errData || error.message };
    }
};

const sendMediaMessage = async (to, mediaUrl, mediaType, captionText = null, retryAttempt = 0, modelName = null, recordId = null, mediaId = null) => {
    const phoneNumberId = getBotPhoneNumberIdForRequest();
    const MAX_RETRIES = 17;

    // Case 3: If media ID exists and is not expired, try using it first
    if (mediaId) {
        const result = await sendMediaMessageWithId(to, mediaId, mediaType, captionText);
        if (result.success) {
            return true; // Successfully sent using media ID
        }

        // If the media ID is expired, continue to URL method
        if (!result.expired) {
            console.log(`Failed to send with media ID but not due to expiration. Using URL fallback.`);
        } else {
            console.log(`Media ID expired. Will upload and get a new ID.`);
        }
    }

    // Case 1 & 2: If mediaId is null or expired, use URL and then create/update ID
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
        } else if (mediaType == 'pdf') {
            requestBody = {
                messaging_product: 'whatsapp',
                to: to,
                type: 'document',
                document: { link: mediaUrl, filename: captionText },
            };
        } else {
            console.log('Invalid media type:', mediaType);
            return;
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

        // If model and recordId are provided, create/update the media ID
        if (modelName && recordId) {
            // Upload the media to get a new ID
            const uploadResult = await uploadMediaAndGetId(mediaUrl, mediaType);
            if (uploadResult.success) {
                // Save the new media ID to the database
                await saveMediaIdToDatabase(modelName, recordId, mediaType, uploadResult.mediaId);
            } else {
                console.log(`Failed to upload media and get ID: ${uploadResult.error}`);
            }
        }

        return true;
    } catch (error) {
        const errData = error.response ? error.response.data : null;
        console.log(`Error sending media message (from ${phoneNumberId}). Attempt ${retryAttempt + 1} of ${MAX_RETRIES}`);
        if (retryAttempt < MAX_RETRIES) {
            const waitTimeSeconds = retryAttempt === 0 ? 1 : Math.min(retryAttempt * 4, 60);
            console.log(`Retrying after ${waitTimeSeconds} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, waitTimeSeconds * 1000));
            return sendMediaMessage(to, mediaUrl, mediaType, captionText, retryAttempt + 1, modelName, recordId, mediaId);
        } else {
            console.log(`Max retries reached. Giving up on media message to ${to} from ${phoneNumberId}.`);
            console.log("Final error:", errData ? errData : error.message);
            return false;
        }
    }
};

const sendButtonMessage = async (to, bodyText, buttonOptions, retryAttempt = 0, imageUrl = null, videoUrl = null, modelName = null, recordId = null, imageMediaId = null, videoMediaId = null) => {
    const phoneNumberId = getBotPhoneNumberIdForRequest();
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

        // Try to use media IDs first if available
        if (imageMediaId) {
            try {
                interactivePayload.header = { type: 'image', image: { id: imageMediaId } };

                // Try sending with media ID
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

                let logger = `Outbound Message: User: ${to}, From ID: ${phoneNumberId}, Message Type: button with image ID`;
                console.log(logger);
                return true;
            } catch (mediaIdError) {
                const errData = mediaIdError.response ? mediaIdError.response.data : null;
                const errorCode = errData?.error?.code;
                const isExpiredMediaError = errorCode === 131053 || errorCode === 131026 || errorCode === 100;

                if (isExpiredMediaError) {
                    console.log(`Image Media ID appears to be expired or invalid (Error code: ${errorCode}), falling back to URL`);
                    // Will fall through to URL method below
                } else {
                    // If not an expired media error, throw it to be caught by outer catch
                    throw mediaIdError;
                }
            }
        } else if (videoMediaId) {
            try {
                interactivePayload.header = { type: 'video', video: { id: videoMediaId } };

                // Try sending with media ID
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

                let logger = `Outbound Message: User: ${to}, From ID: ${phoneNumberId}, Message Type: button with video ID`;
                console.log(logger);
                return true;
            } catch (mediaIdError) {
                const errData = mediaIdError.response ? mediaIdError.response.data : null;
                const errorCode = errData?.error?.code;
                const isExpiredMediaError = errorCode === 131053 || errorCode === 131026 || errorCode === 100;

                if (isExpiredMediaError) {
                    console.log(`Video Media ID appears to be expired or invalid (Error code: ${errorCode}), falling back to URL`);
                    // Will fall through to URL method below
                } else {
                    // If not an expired media error, throw it to be caught by outer catch
                    throw mediaIdError;
                }
            }
        }

        // If no media ID or media ID is expired, use URL
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

        // If model and recordId are provided and we sent with a URL, create/update the media ID
        if (modelName && recordId) {
            if (imageUrl) {
                // Upload the image to get a new ID
                const uploadResult = await uploadMediaAndGetId(imageUrl, 'image');
                if (uploadResult.success) {
                    // Save the new media ID to the database
                    await saveMediaIdToDatabase(modelName, recordId, 'image', uploadResult.mediaId);
                }
            } else if (videoUrl) {
                // Upload the video to get a new ID
                const uploadResult = await uploadMediaAndGetId(videoUrl, 'video');
                if (uploadResult.success) {
                    // Save the new media ID to the database
                    await saveMediaIdToDatabase(modelName, recordId, 'video', uploadResult.mediaId);
                }
            }
        }

        return true;
    } catch (error) {
        const errData = error.response ? error.response.data : null;
        console.log(`Error sending button message (from ${phoneNumberId}). Attempt ${retryAttempt + 1} of ${MAX_RETRIES}`);
        if (retryAttempt < MAX_RETRIES) {
            const waitTimeSeconds = retryAttempt === 0 ? 1 : Math.min(retryAttempt * 4, 60);
            console.log(`Retrying after ${waitTimeSeconds} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, waitTimeSeconds * 1000));
            if (imageUrl) {
                return sendButtonMessage(to, bodyText, buttonOptions, retryAttempt + 1, imageUrl, null, modelName, recordId, imageMediaId);
            } else if (videoUrl) {
                return sendButtonMessage(to, bodyText, buttonOptions, retryAttempt + 1, null, videoUrl, modelName, recordId, null, videoMediaId);
            } else {
                return sendButtonMessage(to, bodyText, buttonOptions, retryAttempt + 1);
            }
        } else {
            console.log(`Max retries reached. Giving up on button message to ${to} from ${phoneNumberId}.`);
            console.log("Final error:", errData ? errData : error.message);
            return false;
        }
    }
};

const sendContactCardMessage = async (to, contactData, retryAttempt = 0) => {
    const phoneNumberId = getBotPhoneNumberIdForRequest();
    const MAX_RETRIES = 17;

    try {
        await axios.post(
            `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
            {
                messaging_product: "whatsapp",
                to: to,
                type: "contacts",
                contacts: [contactData]
            },
            {
                headers: {
                    Authorization: `Bearer ${whatsappToken}`,
                    "Content-Type": "application/json",
                },
            }
        );
        let logger = `Outbound Message: User: ${to}, From ID: ${phoneNumberId}, Message Type: contacts, Message Content: ${contactData.name?.formatted_name || "Contact card"}`;
        console.log(logger);
    } catch (error) {
        const errData = error.response ? error.response.data : null;
        console.log(`Error sending contact card (from ${phoneNumberId}). Attempt ${retryAttempt + 1} of ${MAX_RETRIES}`);

        if (retryAttempt < MAX_RETRIES) {
            const waitTimeSeconds = retryAttempt === 0 ? 1 : Math.min(retryAttempt * 4, 60);
            console.log(`Retrying after ${waitTimeSeconds} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, waitTimeSeconds * 1000));
            return sendContactCardMessage(to, contactData, retryAttempt + 1);
        } else {
            console.log(`Max retries reached. Giving up on contact card to ${to} from ${phoneNumberId}.`);
            console.log("Final error:", errData ? errData : error.message);
        }
    }
};

export { sendMessage, sendMediaMessage, sendButtonMessage, retrieveMediaURL, sendContactCardMessage, uploadMediaAndGetId };