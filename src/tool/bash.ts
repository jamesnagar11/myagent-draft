import { delimiter, join } from "node:path";
import type { Tool } from "../types";
import { existsSync } from "node:fs";

function findBash(): string {
    if(process.platform !== "win32") return "bash";
    const candidates = [
        `${process.env.ProgramFiles}\\Git\\bin\\bash.exe`,
        `${process.env["ProgramFiles(x86)"]}\\Git\\bin\\bash.exe`,
        `${process.env.LOCALAPPDATA}\\Programs\\Git\\bin\\bash.exe`,
    ];
    const known = candidates.find((p) => existsSync(p));
    if (known) return known;

    for(const dir of (process.env.PATH ?? "").split(delimiter)) {
        if (!dir || /\\system32$/i.test(dir.replace(/\\+$/, ""))) continue;

        const candidate = join(dir, "bash.exe");
        if(existsSync(candidate)) return candidate;
    }

    return "bash";
}

async function runBash(command: string, timeoutMs: number): Promise<string> {
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn([findBash(), "-c", command], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
      windowsHide: true,
    });
  } catch (e) {
    return `failed to start bash: ${(e as Error).message}`;
  }

  let out = "";
  let finished = false;
  const decoder = new TextDecoder();
  const pump = async (stream: ReadableStream<Uint8Array>) => {
    for await (const chunk of stream) {
      if (finished) break; // ignore anything that arrives after we've returned
      out += decoder.decode(chunk, { stream: true });
    }
  };

  const completed = Promise.all([
    pump(proc.stdout as ReadableStream<Uint8Array>),
    pump(proc.stderr as ReadableStream<Uint8Array>),
    proc.exited,
  ]).then(() => "done" as const);

  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });

  const result = await Promise.race([completed, timeout]);
  clearTimeout(timer!);
  finished = true;

  if (result === "timeout") {
    if (process.platform === "win32") {
      Bun.spawn(["taskkill", "/F", "/T", "/PID", String(proc.pid)], {
        stdout: "ignore",
        stderr: "ignore",
      });
    } else {
      proc.kill("SIGKILL");
    }
    return `${out}\n[timed out after ${timeoutMs / 1000}s]`;
  }

  return `${out}\n[exit code: ${proc.exitCode}]`;
}

const MAX_LINES = 2000;
const MAX_BYTES = 50 * 1024;

// keep the END of the output (errors and results are usually at the bottom) and say what was cut
export function truncateTail(text: string, maxLines = MAX_LINES, maxBytes = MAX_BYTES): string {
  const lines = text.split("\n");
  let kept = lines.slice(-maxLines);
  while (kept.length > 1 && Buffer.byteLength(kept.join("\n")) > maxBytes) kept.shift();
  let out = kept.join("\n");
  if (Buffer.byteLength(out) > maxBytes) out = out.slice(-maxBytes); // one giant line
  if (kept.length === lines.length && out.length === text.length) return text;
  return `[truncated: showing the last ${kept.length} of ${lines.length} lines]\n${out}`;
}

export const bashTool: Tool = {
    name: "bash",
    description: `Execute a bash command in the current working directory (${process.cwd()}).

Use this tool to interact with the terminal: inspect files and directories, search code, run tests, execute scripts, install dependencies, and use Git or other CLI tools.

The command runs in Bash, so shell features like pipes (|), redirects (>), command chaining (&&), and variables are supported.

Returns command output (stdout and stderr) and the exit code. Output may be truncated if it is too large. Commands exceeding the timeout are terminated.

Use the read tool when you only need to read a file's contents.`,
    parameters: {
        type: "object",
        properties: {
            command: {
                type: "string",
                description: "The Bash command to execute. Run it from the current working directory: ${process.cwd()}. Use normal Bash syntax, including pipes, redirects, and command chaining when needed."
            },
            timeout: {
                type: "number",
                description: "Maximum execution time in seconds. Defaults to 30 seconds if omitted. Use a longer timeout for slow operations such as installing dependencies, building projects, or running tests."
            },
        },
        required: ["command"],
    },
    execute: async(args) => {
        const seconds = typeof args.timeout === "number" ? args.timeout : 60;

        return truncateTail(await runBash(String(args.command), seconds * 1000));
    },
};