#!/usr/bin/env node

import { parseArgs } from "node:util";
import { GoogleGenAI } from "@google/genai";

const { values} = parseArgs({
    options: {
        prompt: {
            type: 'string',
            short: 'p'
        },
        model: {
            type: 'string',
            short: 'm',
            default: 'gemini-3.5-flash-lite'
        }
    }
});

if(!values.prompt) {
    console.error("Please provide a prompt");
    process.exit(1);
}

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY!});

const interaction = await ai.interactions.create({
    model: values.model,
    input: values.prompt
});

console.log(interaction.output_text);