import { providerMap } from "../lib/store";
import type { Provider } from "../types";

export function getProvider(name: string): Provider {
    const create = providerMap[name];

    if(!create) {
        throw new Error("Provider not supported yet, or you may have mis-spelled it.");
    }

    return create();
}