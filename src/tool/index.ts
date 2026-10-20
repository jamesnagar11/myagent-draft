import type { Tool } from "../types";
import { bashTool } from "./bash";
import { readTool } from "./read";

export const tools: Tool[] = [readTool, bashTool];