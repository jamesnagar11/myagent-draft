import { createOpenrouter } from "../providers/openrouter";
import type { Provider } from "../types";
import path from "node:path";

// Load .env from the package root (next to package.json),
// NOT from the user's current working directory.
// import.meta.dir gives the absolute directory of THIS file (src/lib/),
// so we go two levels up to reach the project root where .env lives.
const envPath = path.resolve(import.meta.dir, "../../.env");

// Bun's built-in dotenv loader — loads without polluting process.env if key already set
try {
    const file = Bun.file(envPath);
    if (await file.exists()) {
        const text = await file.text();
        for (const line of text.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx === -1) continue;
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            // Strip surrounding quotes
            if (
                (val.startsWith('"') && val.endsWith('"')) ||
                (val.startsWith("'") && val.endsWith("'"))
            ) {
                val = val.slice(1, -1);
            }
            // Don't override values already set in the real environment
            if (!process.env[key]) {
                process.env[key] = val;
            }
        }
    }
} catch {
    // .env is optional — silently continue
}

export const providerMap: Record<string, () => Provider> = {
    "openrouter": () => createOpenrouter("openrouter", "https://openrouter.ai/api/v1", process.env.OPENROUTER_API_KEY!, "openrouter/free")
    // add more providers here!
};
