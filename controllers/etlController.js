import etlService_auto from "../services/etlService_Auto.js";
import etlService from "../services/etlService.js";

const runETL = async () => {
    try {
        await etlService.runETL_Dashboard();
    } catch (error) {
        error.fileName = "etlController.js";
        console.error("Error during ETL process:", error);
    }
};

const runETL1 = async (req,res) => {
    try {
        const selectedValue = req.body.selectedValue;
        console.log("Received value from Google Sheets: ", selectedValue);

        let parts = selectedValue.split(" ");

        let facilitator = parts[0];     
        let module = parts[1];          
        let tgrp = parts[2].split("-")[0]; 
        let cohort = "", co_no = 0;

        if(parts[2].split("-")[1] == "Pilot"){
            cohort = parts[2].split("-")[1];
        }
        else{
            cohort = parts[2].split("-")[1] + " " + parts[3];
            co_no = parts[3];
        }
        
        console.log("Part 1: ", facilitator);
        console.log("Part 2: ", tgrp);
        console.log("Part 3: ", module);
        console.log("Part 4: ", cohort);

        if (tgrp && module && facilitator && cohort && co_no !== undefined) {
            await etlService_auto.runETL(tgrp,module,cohort,co_no,facilitator);
        }
        res.status(200).send("Beaj Employees Route Status : Working");
    } catch (error) {
        error.fileName = "etlController.js";
        console.error("Error during ETL process:", error);
    }
};

export default { runETL,runETL1 };