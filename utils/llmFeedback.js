import _ from "lodash";
import { AzureOpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { marketing_bot_prompt } from "./prompts.js";
import dotenv from 'dotenv';
dotenv.config();




const azureOpenaiFeedback = async (previousMessages) => {
    try {
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT_2;
        const apiKey = process.env.AZURE_OPENAI_API_KEY_2;
        const apiVersion = "2025-01-01-preview";
        const deployment = "gpt-4.1-nano";

        const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });
        const result = await client.chat.completions.create({
            messages: previousMessages,
            model: "",
        });

        return result.choices[0].message.content;
    } catch {
        return await geminiFeedback(previousMessages);
    }
};

const geminiFeedback = async (previousMessages) => {
    let userTranscript = previousMessages[previousMessages.length - 1].content;
    previousMessages.pop();

    let messagesArray = [];
    previousMessages.forEach(message => {
        messagesArray.push({
            role: message.role == 'assistant' ? 'model' : message.role,
            parts: [{ text: message.content }]
        });
    });

    let systemInstruction = "";

    if (messagesArray[0].role === 'system') {
        systemInstruction = messagesArray[0].content;
        messagesArray.shift();
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: systemInstruction
    });
    const chat = model.startChat({
        history: messagesArray
    });

    let result = await chat.sendMessage(userTranscript);
    return result.response.text();
};

const geminiCustomFeedback = async (userTranscript, modelPrompt) => {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: modelPrompt
    });
    const result = await model.generateContent(userTranscript);
    return result.response.text();
};

const azureOpenaiCustomFeedback = async (userTranscript, modelPrompt) => {
    try {
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT_2;
        const apiKey = process.env.AZURE_OPENAI_API_KEY_2;
        const apiVersion = "2025-01-01-preview";
        const deployment = "gpt-4.1-nano";

        const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });
        const result = await client.chat.completions.create({
            messages: [
                { role: "system", content: modelPrompt },
                { role: "user", content: userTranscript },
            ],
            model: "",
        });

        return result.choices[0].message.content;
    } catch {
        return await geminiCustomFeedback(userTranscript, modelPrompt);
    }
};

const marketingBotResponse = async (previousMessages) => {
    const marketingBotPrompt = await marketing_bot_prompt();
    previousMessages.unshift({
        role: "system",
        content: marketingBotPrompt
    });
    try {
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
        const apiKey = process.env.AZURE_OPENAI_API_KEY;
        const apiVersion = "2025-01-01-preview";
        const deployment = "gpt-4.1-mini";

        const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });
        const result = await client.chat.completions.create({
            messages: previousMessages,
            model: "",
        });

        return result.choices[0].message.content;
    } catch {
        return "Sorry, I am not able to respond to your question.";
    }
};

export default {
    azureOpenaiFeedback,
    geminiFeedback,
    geminiCustomFeedback,
    azureOpenaiCustomFeedback,
    marketingBotResponse
};