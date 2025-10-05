import waUserProgressRepository from "../repositories/waUserProgressRepository.js";


const skipButtonFlow = async (userMobileNumber, startingLesson, nextQuestion = null) => {
    if (startingLesson.dataValues.skipOnFirstQuestion == true && nextQuestion?.dataValues?.questionNumber == 1) {
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio", "skip"]);
    } else if (startingLesson.dataValues.skipOnEveryQuestion == true){
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio", "skip"]);
    } else {
        await waUserProgressRepository.updateAcceptableMessagesList(profileId, userMobileNumber, ["audio"]);
    }
}

export default skipButtonFlow;