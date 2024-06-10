import service from '../services/statsService.js'


const totalContentStatsController = async (req, res) => {
    try {
        const totalContentStats = await service.totalContentStatsService();
        res.status(200).send(totalContentStats);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
}

export default {
    totalContentStatsController
}