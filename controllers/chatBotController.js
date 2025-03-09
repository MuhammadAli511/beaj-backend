import service from '../services/chatBotService.js';

const webhookController = async (req, res, next) => {
    try {
        const { body } = req;
        await service.webhookService(body, res);
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
        // let phone_number = req.body.phone_number;
        // const salmanEndpoint = "https://smiling-pro-sheep.ngrok-free.app";
        // const aliEndpoint = "";
        // if (phone_number === "+923012232148") {
            
            
        //     try {
        //         const response = await axios.post(salmanEndpoint, req.body, {
        //             headers: req.headers, 
        //         });
    
        //         return res.json(response.data); 
        //     } catch (error) {
        //         console.error("Request failed:", error.message);
        //         return; 
        //     }
        // }
        // else if (phone_number === "+923225036358") {
        //     try {
        //         const response = await axios.post(aliEndpoint, req.body, {
        //             headers: req.headers, 
        //         });
    
        //         return res.json(response.data); 
        //     } catch (error) {
        //         console.error("Request failed:", error.message);
        //         return; 
        //     }
        // }
        // res.status(400).json({ message: "Phone number does not match" });

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