import axios from "axios";


const whatsappToken = process.env.WHATSAPP_TOKEN;
const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

const sendMessage = async (to, body, retryAttempt = 0) => {
    const MAX_RETRIES = 17;

    try {
        await axios.post(
            `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
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
        let logger = `Outbound Message: User: ${to}, Message Type: text, Message Content: ${body}`;
        console.log(logger);
    } catch (error) {
        const errData = error.response ? error.response.data : null;
        console.log(`Error sending message. Attempt ${retryAttempt + 1} of ${MAX_RETRIES}`);

        if (retryAttempt < MAX_RETRIES) {
            const waitTimeSeconds = retryAttempt === 0 ? 1 : Math.min(retryAttempt * 4, 60);
            console.log(`Retrying after ${waitTimeSeconds} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, waitTimeSeconds * 1000));
            return sendMessage(to, body, retryAttempt + 1);
        } else {
            console.log(`Max retries reached. Giving up on message to ${to}.`);
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
        console.log(`Error sending message. Attempt ${retryAttempt + 1} of ${MAX_RETRIES}`);
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
    const MAX_RETRIES = 17;
    try {
        if (mediaType == 'video') {
            await axios.post(
                `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'video',
                    video: { link: mediaUrl, caption: captionText },
                },
                {
                    headers: {
                        Authorization: `Bearer ${whatsappToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        } else if (mediaType == 'audio') {
            await axios.post(
                `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'audio',
                    audio: { link: mediaUrl },
                },
                {
                    headers: {
                        Authorization: `Bearer ${whatsappToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        } else if (mediaType == 'image') {
            await axios.post(
                `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'image',
                    image: { link: mediaUrl, caption: captionText },
                },
                {
                    headers: {
                        Authorization: `Bearer ${whatsappToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        } else if (mediaType == 'sticker') {
            await axios.post(
                `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'sticker',
                    sticker: { link: mediaUrl },
                },
                {
                    headers: {
                        Authorization: `Bearer ${whatsappToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        }
        else {
            console.log('Invalid media type:', mediaType);
        }
        let logger = `Outbound Message: User: ${to}, Message Type: ${mediaType}, Message Content: ${mediaUrl}`;
        console.log(logger);
    } catch (error) {
        const errData = error.response ? error.response.data : null;
        if (retryAttempt < MAX_RETRIES) {
            const waitTimeSeconds = retryAttempt === 0 ? 1 : Math.min(retryAttempt * 4, 60);
            console.log(`Retrying after ${waitTimeSeconds} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, waitTimeSeconds * 1000));
            return sendMediaMessage(to, mediaUrl, mediaType, captionText, retryAttempt + 1);
        } else {
            console.log(`Max retries reached. Giving up on media message to ${to}.`);
            console.log("Final error:", errData ? errData : error.message);
        }
    }
};

const sendButtonMessage = async (to, bodyText, buttonOptions, retryAttempt = 0, imageUrl = null, videoUrl = null) => {
    const MAX_RETRIES = 17;

    try {
        if (imageUrl) {
            const response = await axios.post(
                `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: 'interactive',
                    interactive: {
                        type: 'button',
                        header: {
                            type: 'image',
                            image: {
                                link: imageUrl
                            }
                        },
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
                    }
                },
                {
                    headers: {
                        Authorization: `Bearer ${whatsappToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        } else if (videoUrl) {
            const response = await axios.post(
                `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: 'interactive',
                    interactive: {
                        type: 'button',
                        header: {
                            type: 'video',
                            video: {
                                link: videoUrl
                            }
                        },
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
                    }
                },
                {
                    headers: {
                        Authorization: `Bearer ${whatsappToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        }
        else {
            const response = await axios.post(
                `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: 'interactive',
                    interactive: {
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
                    }
                },
                {
                    headers: {
                        Authorization: `Bearer ${whatsappToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        }
        let logger = `Outbound Message: User: ${to}, Message Type: button, Message Content: ${bodyText}`;
        console.log(logger);
    } catch (error) {
        const errData = error.response ? error.response.data : null;
        console.log(`Error sending button message. Attempt ${retryAttempt + 1} of ${MAX_RETRIES}`);
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
            console.log(`Max retries reached. Giving up on button message to ${to}.`);
            console.log("Final error:", errData ? errData : error.message);
        }
    }
};


export { sendMessage, sendMediaMessage, sendButtonMessage, retrieveMediaURL };