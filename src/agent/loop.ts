import type { AssistantMessage, Message, Provider, Tool, ToolCallBlock } from "../types";

export type AgentEvent = 
    | { type: "text", delta: string }
    | { type: "tool_start", call: ToolCallBlock }
    | { type: "tool_end", call: ToolCallBlock, result: string, isError: boolean }
    | { type: "turn_end", message: AssistantMessage }
    | { type: "message", message: Message };

export type AgentOptions = {
    provider: Provider;
    model: string;
    system?: string;
    tools: Tool[];
    messages: Message[];
    maxTurns?: number;
    onEvent: (event: AgentEvent) => void;
};

export async function runAgent(opts: AgentOptions): Promise<void> {
    const { provider, model, system, tools, messages, onEvent } = opts;
    const maxTurns = opts?.maxTurns ?? 20;

    const push = (message: Message) => {
        messages.push(message);
        onEvent({ type: "message", message });
    }
    
    for(let turn=1; turn<=maxTurns; turn++) {

        let assistant: AssistantMessage | undefined;

        for await (const event of provider.stream({ messages, model, tools, system })) {
            if(event.type === "text_delta") {
                onEvent({ type: "text", delta: event.delta });
            }
            else if(event.type === "done") {
                assistant = event.message;
            }
        }

        if(!assistant) throw new Error("Unhandled Message from LLM, expected an Assistant Message");
        push(assistant);

        onEvent({ type: "turn_end", message: assistant});

        if(assistant.stopReason !== "toolUse") {
            return;
        }

        for(const call of assistant.content) {
            if(call.type !== "toolCall") continue;

            onEvent({ type: "tool_start", call });

            let result: string;
            let isError: boolean = false;

            try {
                const tool = tools.find(t => t.name === call.name);
                if(!tool) throw new Error(`Tool not found, unknown tool name ${call.name}`);

                result = await tool.execute(call.args);

            } catch (error) {
                result = `Error ${error instanceof Error ? error.message:String(error)}`;
                isError = true;
            }

            onEvent({ type: "tool_end", call, result, isError });
            push({ role: "toolResult", content: result, isError, toolCallId: call.id, toolName: call.name });
        }

    }

    throw new Error(`Stopped after ${maxTurns} turns`);
}