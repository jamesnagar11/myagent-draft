#!/usr/bin/env node

import { parseArgs } from "node:util";
import { getProvider } from "./providers";
import type { Message } from "./types";
import { tools } from "./tool";
import { runAgent } from "./agent/loop";

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

await runAgent({
    provider,
    model,
    messages,
    tools,
    onEvent: (event) => {
        if(event.type === "text") {
            process.stdout.write(event.delta);
        }
        else if(event.type === "tool_start") {
            console.log(`\nTool Called: ${event.call.name}\nArguments: ${JSON.stringify(event.call.args)}\n`);
        }
        else if(event.type === "tool_end") {
            console.log(`${event.isError ? "Tool Call Failed" : "Tool Call Success"}\n`);
            console.log(`${event.result}\n`);
        }
        else if(event.type === "turn_end") {
            const { usage, stopReason } = event.message;
            console.log(`\n--------------`);
            console.log(`Stop Reason: ${stopReason}\n`);
            console.log(`Input Tokens: ${usage.input}\n`);
            console.log(`Output Tokens: ${usage.output}\n`);
            console.log("--------------\n");
        }
    }
})