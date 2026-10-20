#!/usr/bin/env node

import { parseArgs } from "node:util";
import { getProvider } from "./providers";
import type { AssistantMessage, Message } from "./types";
import { readTool } from "./tool/read";

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

const tools = [readTool];

async function callModel(): Promise<AssistantMessage> {
    for await (const event of provider.stream({ messages, model, tools })) {
        if(event.type === "text_delta") {
            process.stdout.write(event.delta);
        }
        else if(event.type === "done"){
            const { usage, stopReason } = event.message;
            process.stdout.write("\n");
            process.stdout.write(`Stop Reason: ${stopReason}\n`);
            process.stdout.write(`Input Tokens: ${usage.input}\nOutput Tokens: ${usage.output}`);
            return event.message;
        }
        else {
            console.log(`Unhandled event: ${JSON.stringify(event)}`);
        }
    }
    throw new Error("Stream ended without done event");
}

const first = await callModel();
messages.push(first);

if(first.stopReason === 'toolUse') {
    for(const block of first.content) {
        if(block.type !== "toolCall") continue;
        console.log(`\nTool name: ${block.name}\narguments: ${JSON.stringify(block.args)}`);

        try {
            const result = await readTool.execute(block.args);
            messages.push({role: "toolResult", content: result, toolName: block.name, toolCallId: block.id, isError: false});
        }
        catch (e) {
            console.log(`\nTool error: ${e}`);
            messages.push({role: "toolResult", content: JSON.stringify(e), toolName: block.name, toolCallId: block.id, isError: true});
        }
    }
    const second = await callModel();
    messages.push(second);
}

// for await (const event of provider.stream({messages, model})) {
//     if(event.type === "text_delta") {
//         process.stdout.write(event.delta);
//     }
//     else if(event.type === "done") {
//         process.stdout.write("\n");
//         process.stdout.write(`Stop Reason: ${event.message.stopReason}\n`);
//         process.stdout.write(`Input Tokens: ${event.message.usage.input}\nOutput Tokens: ${event.message.usage.output}`);
//         process.exit(0);
//     }
// }
