import { OpenRouter } from '@openrouter/sdk';

import type { Provider, StreamOptions, StopReason, Usage, Message, ContentBlock } from "../types";
import type { ChatRequest, Openrouter } from '@openrouter/sdk/models';

type OpenRouterMessageParam = NonNullable<ChatRequest['messages']>[number];

const toOpenRouter = (messages: Message[]): OpenRouterMessageParam[] => {
    return messages.map((m): OpenRouterMessageParam => {
        if(m.role === 'user') {
            return { role: 'user', content: m.content };
        }
        else if(m.role === 'assistant') {
            const text = m.content.filter((b) => b.type === "text").map((b) => b.text).join("");
            const calls = m.content.filter((b) => b.type === "toolCall");
            
            return {
                role: 'assistant',
                content: text || null,
                toolCalls: calls.length > 0 ? (
                    calls.map((c) => {
                        return {
                            id: c.id,
                            type: "function",
                            function: {
                                name: c.name,
                                arguments: JSON.stringify(c.args) as string
                            }
                        }
                    })
                ) : undefined
            }
        }
        // assuming it's a tool call
        return {
            role: "tool",
            toolCallId: m.toolCallId,
            content: m.content
        }
    });
}

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
        stream: async function* ({ messages, model, system, tools = [] }) {
            const chats = toOpenRouter(messages);

            const stream = await client.chat.send({
                chatRequest: {
                    model: model,
                    messages: system ? [{role: "system", content: system}, ...chats] : chats,
                    stream: true,
                    // maxTokens: 4096,
                    tools: tools.length > 0 ? (
                        tools.map((tool) => ({
                            type: "function" as const,
                            function: {
                                name: tool.name,
                                description: tool.description,
                                parameters: tool.parameters,
                            },
                        }))
                    ) : undefined
                }
            });

            let text = '';
            let usage: Usage = { input: 0, output: 0 };
            let stopReason: StopReason = "stop";
            const calls: { id: string; name: string; args: string }[] = [];
            
            if (!(stream instanceof ReadableStream)) {
                const response = stream as any;
                const choice = response?.choices?.[0];
                const message = choice?.message;
                
                text = message?.content ?? '';

                if (choice?.finish_reason) {
                    // stopReason = choice.finish_reason as StopReason;
                    if(choice.finish_reason === "stop") {
                        stopReason = "stop";
                    }
                    if(choice.finish_reason === "length") {
                        stopReason = "length";
                    }
                    if(choice.finish_reason === "tool_calls") {
                        stopReason = "toolUse";
                    }
                }

                if (response?.usage) {
                    usage = {
                        input: response.usage.prompt_tokens ?? 0,
                        output: response.usage.completion_tokens ?? 0
                    };
                }

                if(message?.tool_calls) {
                    for (const toolCall of message.tool_calls) {
                        calls.push({
                            id: toolCall.id,
                            name: toolCall.function.name,
                            args: toolCall.function.arguments,
                        });
                    }
                }

                const content: ContentBlock[] = text ? [{type: "text", text: text}] : [];
                
                for(const c of calls) {
                    if(c) {
                        content.push({type: "toolCall", id: c.id, name: c.name, args: c.args ? JSON.parse(c.args) : {}});
                    }
                }

                if(content.some(b => b.type === "toolCall")) stopReason = "toolUse";

                yield({ type: "done", message: { role: "assistant", content: content, usage, stopReason } });
            }
            else {
                for await (const chunk of stream) {
                    
                    const choice = chunk?.choices?.[0];
                    if(choice?.delta?.content) {
                        const content = choice.delta.content;
                        yield({type: "text_delta", delta: content})
                        text += content;
                    }

                    for(const tc of choice?.delta?.toolCalls ?? []) {
                        const index = tc.index;
                        if(!calls[index]) {
                            calls[index] = {
                                id: tc.id ?? "",
                                name: tc?.function?.name ?? "",
                                args: "",
                            };
                        }

                        if(tc?.id) {
                            calls[index].id = tc.id;
                        }

                        if(tc?.function?.name) {
                            calls[index].name = tc.function.name;
                        }

                        if(tc?.function?.arguments) {
                            calls[index].args += tc.function.arguments;
                        }
                    }

                    if(choice?.finishReason) {  // null in mid stream
                        if(choice.finishReason === "stop") {
                            stopReason = "stop";
                        }
                        if(choice.finishReason === "length") {
                            stopReason = "length";
                        }
                        if(choice.finishReason === "tool_calls") {
                            stopReason = "toolUse";
                        }
                    }
                    
                    if (chunk?.usage) {
                        usage = {
                            input: chunk.usage.promptTokens ?? 0,
                            output: chunk.usage.completionTokens ?? 0,
                        };
                    }
                }

                const content: ContentBlock[] = text ? [{type: "text", text: text}] : [];
                
                for(const c of calls) {
                    if(c) {
                        content.push({type: "toolCall", id: c.id, name: c.name, args: c.args ? JSON.parse(c.args) : {}});
                    }
                }

                if(content.some(b => b.type === "toolCall")) stopReason = "toolUse";

                yield({
                    type: "done",
                    message: { role: "assistant", content: content, usage, stopReason }
                });
            }

        }
    }
}