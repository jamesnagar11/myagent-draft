#!/usr/bin/env node

import { parseArgs } from "node:util";
import { getProvider } from "./providers";
import type { Message } from "./types";

const { values} = parseArgs({
    options: {
        prompt: {
            type: 'string',
            short: 'p'
        },
        model: {
            type: 'string',
            short: 'm',
            default: 'openrouter/free'
        },
        provider: {
            type: 'string',
            default: 'openrouter'
        }
    }
});

if(!values.prompt) {
    console.error("Please provide a prompt");
    process.exit(1);
}

const provider = getProvider(values.provider);
const model = values.model;

const messages: Message[] = [{role: "user", content: values.prompt}];

for await (const event of provider.stream({messages, model})) {
    if(event.type === "text_delta") {
        process.stdout.write(event.delta);
    }
    else if(event.type === "done") {
        process.stdout.write("\n");
        process.stdout.write(`Stop Reason: ${event.message.stopReason}\n`);
        process.stdout.write(`Input Tokens: ${event.message.usage.input}\nOutput Tokens: ${event.message.usage.output}`);
        process.exit(0);
    }
}

