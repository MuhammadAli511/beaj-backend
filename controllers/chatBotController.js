import service from '../services/chatBotService.js';
import https from 'https';
import axios from 'axios';
import { salman_number, ali_number, salman_endpoint, ali_endpoint } from '../constants/constants.js';

const webhookController = async (req, res, next) => {
    try {
        console.log("Webhook Controller Start");
        if (
            req.body.entry?.[0]?.changes?.[0]?.value?.messages &&
            req.body.entry?.[0]?.changes?.[0]?.value?.statuses == undefined
        ) {
            const message = req.body.entry[0].changes[0].value.messages[0];
            const phone_number = "+" + message.from;

            let incomingLink = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

            // Check if this is a direct request to the ngrok endpoints
            if (incomingLink.includes("ngrok-free.app/api/chatbot/webhook")) {
                await service.webhookService(req.body, res);
                return;
            }

            // Define the ngrok endpoints for forwarding
            if (phone_number == salman_number) {
                try {
                    const response = await axios.post(salman_endpoint, req.body, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        httpsAgent: new https.Agent({
                            rejectUnauthorized: false
                        }),
                        timeout: 10000 // 10 second timeout
                    });

                    return res.json(response.data);
                } catch (error) {
                    console.error("Request failed:", error.message);
                    return;
                }
            }
            else if (phone_number == ali_number) {
                try {
                    const response = await axios.post(ali_endpoint, req.body, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        httpsAgent: new https.Agent({
                            rejectUnauthorized: false
                        }),
                        timeout: 10000 // 10 second timeout
                    });

                    return res.json(response.data);
                } catch (error) {
                    console.error("Request failed:", error.message);
                    return;
                }
            }
            else {
                await service.webhookService(req.body, res);
            }
        }
        else {
            await service.webhookService(req.body, res);
        }
    } catch (error) {
        error.fileName = 'chatBotController.js';
        next(error);
    }
};

const verifyWebhookController = async (req, res, next) => {
    try {
        await service.verifyWebhookService(req, res);
    } catch (error) {
        error.fileName = 'chatBotController.js';
        next(error);
    }
};

const getCombinedUserDataController = async (req, res, next) => {
    try {
        const result = await service.getCombinedUserDataService();
        res.status(200).send(result);
    } catch (error) {
        error.fileName = 'chatBotController.js';
        next(error);
    }
};

export default {
    webhookController,
    verifyWebhookController,
    getCombinedUserDataController
};