import MultipleChoiceQuestion from '../models/multipleChoiceQuestion.js';

const create = async (file, image, questionType, questionText, questionNumber, lessonId, optionsType) => {
    const multipleChoiceQuestion = new MultipleChoiceQuestion({
        QuestionAudioUrl: file,
        QuestionImageUrl: image,
        QuestionType: questionType,
        QuestionText: questionText,
        QuestionNumber: questionNumber,
        LessonId: lessonId,
        OptionsType: optionsType
    });
    await multipleChoiceQuestion.save();
    return multipleChoiceQuestion;
};

const getAll = async () => {
    const multipleChoiceQuestions = await MultipleChoiceQuestion.find();
    return multipleChoiceQuestions;
};

const getById = async (id) => {
    const multipleChoiceQuestion = await MultipleChoiceQuestion.getById(id);
    return multipleChoiceQuestion;
};

const update = async (id, file, image, questionType, questionText, questionNumber, lessonId, optionsType) => {
    const multipleChoiceQuestion = await MultipleChoiceQuestion.findByIdAndUpdate(id, {
        QuestionAudioUrl: file,
        QuestionImageUrl: image,
        QuestionType: questionType,
        QuestionText: questionText,
        QuestionNumber: questionNumber,
        LessonId: lessonId,
        OptionsType: optionsType
    }, { new: true });
    return multipleChoiceQuestion;
};

const deleteMultipleChoiceQuestion = async (id) => {
    await MultipleChoiceQuestion.findByIdAndDelete(id);
};

export default {
    create,
    getAll,
    getById,
    update,
    deleteMultipleChoiceQuestion
};