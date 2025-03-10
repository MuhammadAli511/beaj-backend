import service from '../services/chatBotService.js';
import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';

const webhookController = async (req, res, next) => {
    try {
        if (process.env.ENVIRONMENT == 'DEV') {
            console.log("ENVIRONMENT", process.env.ENVIRONMENT);
            if (
                req.body.entry &&
                req.body.entry[0].changes &&
                req.body.entry[0].changes[0].value.messages &&
                req.body.entry[0].changes[0].value.statuses == undefined
            ) {
                const message = req.body.entry[0].changes[0].value.messages[0];
                const phone_number = "+" + message.from;
                console.log("phone_number", phone_number);

                const salmanEndpoint = "https://smiling-pro-sheep.ngrok-free.app";
                const aliEndpoint = "https://sensibly-solid-aardvark.ngrok-free.app";
                if (phone_number == "+923012232148") {
                    try {
                        console.log("salmanEndpoint", salmanEndpoint);
                        const response = await axios.post(salmanEndpoint, req.body, {
                            headers: req.headers,
                        });

                        return res.json(response.data);
                    } catch (error) {
                        console.error("Request failed:", error.message);
                        return;
                    }
                }
                else if (phone_number == "+923225036358") {
                    try {
                        console.log("aliEndpoint", aliEndpoint);
                        const response = await axios.post(aliEndpoint, req.body, {
                            headers: req.headers,
                        });

                        return res.json(response.data);
                    } catch (error) {
                        console.error("Request failed:", error.message);
                        return;
                    }
                }
                else {
                    console.log("Number not found");
                    await service.webhookService(req.body, res);
                }
            }
        }
        else {
            console.log("PROD");
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

const uploadUserDataController = async (req, res, next) => {
    try {
        const { users } = req.body;
       

        const count = await service.uploadUserDataService(users);
        res.status(200).send({ message: `Successfully uploaded ${count} users.` });
    } catch (error) {
        error.fileName = 'chatBotController.js';
        next(error);
    }
};

export default {
    webhookController,
    verifyWebhookController,
    uploadUserDataController
};