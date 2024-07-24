import WA_User from '../models/WA_User.js';

const create = async (phone_number, persona, engagement_type) => {
    const waUser = new WA_User({
        phone_number: phone_number,
        persona: persona,
        engagement_type: engagement_type
    });
    return await waUser.save();
};

const getAll = async () => {
    return await WA_User.findAll({
        attributes: ['phone_number', 'level', 'week', 'day', 'activity_type', 'lesson_id', 'question_number', 'last_updated']
    });
};

const getByPhoneNumber = async (phone_number) => {
    return await WA_User.findByPk(phone_number);
};

const updateMessageSid = async (phone_number, message_sid) => {
    return await WA_User.update({
        message_sid: message_sid,
        last_updated: new Date()
    }, {
        where: {
            phone_number: phone_number
        }
    });
};

const update = async (phone_number, persona, engagement_type, level, week, day, lesson_sequence, activity_type, lesson_id, question_number) => {
    return await WA_User.update({
        persona: persona,
        engagement_type: engagement_type,
        level: level,
        week: week,
        day: day,
        lesson_sequence: lesson_sequence,
        activity_type: activity_type,
        question_number: question_number,
        lesson_id: lesson_id,
        last_updated: new Date()
    }, {
        where: {
            phone_number: phone_number
        }
    });
};

const update_question = async (phone_number, question_number) => {
    return await WA_User.update({
        question_number: question_number,
        last_updated: new Date()
    }, {
        where: {
            phone_number: phone_number
        }
    });
};

const update_activity_question_lessonid = async (phone_number, activity_type, question_number, lesson_id) => {
    return await WA_User.update({
        activity_type: activity_type,
        question_number: question_number,
        lesson_id: lesson_id,
        last_updated: new Date()
    }, {
        where: {
            phone_number: phone_number
        }
    });
};

const deleteByPhoneNumber = async (phone_number) => {
    return await WA_User.destroy({
        where: {
            phone_number: phone_number
        }
    });
};

export default {
    create,
    getAll,
    getByPhoneNumber,
    update,
    update_question,
    update_activity_question_lessonid,
    updateMessageSid,
    deleteByPhoneNumber
};
