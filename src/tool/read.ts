import type { Tool } from "../types";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const readTool: Tool = {
    name: "read",
    description: `Read a text file and returns its contents. The current working directory is: ${process.cwd()}`,
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: `Absolute path, or a path relative to the current working directory (${process.cwd()})`,
            },
        },
        required: ["path"],
    },
    execute: async(args) => {
        return readFile(resolve(process.cwd(), String(args.path)), "utf8");
    },
};