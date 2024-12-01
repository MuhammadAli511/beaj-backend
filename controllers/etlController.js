import etlService from "../services/etlService.js";

const runETL = async () => {
    try {
        await etlService.runETL();
    } catch (error) {
        error.fileName = "etlController.js";
        console.error("Error during ETL process:", error);
    }
};

export default { runETL };