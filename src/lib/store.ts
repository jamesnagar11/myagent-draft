import { createOpenrouter } from "../providers/openrouter";
import type { Provider } from "../types";

export const providerMap: Record<string, () => Provider> = {
    "openrouter": () => createOpenrouter("openrouter", "https://openrouter.ai/api/v1", process.env.OPENROUTER_API_KEY!, "openrouter/free")
    // add more here!
};
