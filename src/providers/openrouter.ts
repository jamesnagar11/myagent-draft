import { OpenRouter } from '@openrouter/sdk';

import type { Provider, StreamOptions, StopReason, Usage } from "../types";

export function createOpenrouter(
    name: string,
    baseURL: string,
    apiKey: string,
    defaultModel: string,
): Provider {
    const client = new OpenRouter({
        apiKey: apiKey,
    });

    return {
        name: name,
        defaultModel: defaultModel,
        stream: async function* ({ messages, model, system }) {
            const stream = await client.chat.send({
                chatRequest: {
                    model: model,
                    messages: messages,
                    stream: true,
                    maxTokens: 4096,
                }
            });
            let text = '';
            let usage: Usage = { input: 0, output: 0 };
            let stopReason: StopReason = "stop";
            
            if (!(stream instanceof ReadableStream)) {
                const response = stream as any;
                const choice = response?.choices?.[0];
                
                text = choice?.message?.content ?? '';

                if (choice?.finish_reason) {
                    stopReason = choice.finish_reason as StopReason;
                }

                if (response?.usage) {
                    usage = {
                        input: response.usage.prompt_tokens ?? 0,
                        output: response.usage.completion_tokens ?? 0
                    };
                }

                yield({ type: "done", message: { role: "assistant", content: text, usage, stopReason } });
            }
            else {
                for await (const chunk of stream) {
                    
                    const choice = chunk?.choices?.[0];
                    if(choice?.delta?.content) {
                        const content = choice.delta.content;
                        yield({type: "text_delta", delta: content})
                        text += content;
                    }
                    if(choice?.finishReason) {  // null in mid stream
                        if(choice.finishReason === "stop") {
                            stopReason = "stop";
                        }
                        if(choice.finishReason === "length") {
                            stopReason = "length";
                        }
                    }
                    
                    if (chunk?.usage) {
                        usage = {
                            input: chunk.usage.promptTokens ?? 0,
                            output: chunk.usage.completionTokens ?? 0,
                        };
                    }
                }

                yield({
                    type: "done",
                    message: { role: "assistant", content: text, usage, stopReason }
                });
            }

        }
    }
}