# Coding Agent Draft like PI Terminal Agent
Hi, it's a terminal based coding agent made with minimal setup.
The codebase is in typescript so that a large community can understand it without requiring extensive knowledge of languages like python.
It's very minimal and workable coding agent that you can setup for yourself for free

### Steps to setup locally
- Git Clone
- cd in working directory
- Copy .env.example to .env in root directory
- Put your free openrouter api key in the .env
- Install bun (package manager) globally with `npm install -g bun`
- `bun install`

### Option 1 (Recommended)
```bash
bun link
```
#### Some Commands to try it out (free tier)
- `myagent -p "how many 'r's in strawberry ?"`  (recommended, as it's free)
#### Some commands to try it out (paid tier)
- `myagent -p "how many 'r's in strawberry ?" --model "anthropic/claude-sonnet-4"`
- `myagent -p "how many 'r's in strawberry ?" -m "claude-opus-5-5" --provider "anthopic"` (not supported, I don't have claude code to implement and test it out, but I guess you get the point)
- `myagent -p "how many 'r's in strawberry ?" -m "gemini-flash-3.5" --provider "gemini"`

### Option 2 (If you don't want to link myagent)
#### Some Commands to try it out (free tier)
- `bun run ./src/index.ts -p "how many 'r's in strawberry ?"`  (recommended, as it's free)
#### Some commands to try it out (paid tier)
- `bun run ./src/index.ts -p "how many 'r's in strawberry ?" --model "anthropic/claude-sonnet-4"`
- `bun run ./src/index.ts -p "how many 'r's in strawberry ?" -m "claude-opus-5-5" --provider "anthopic"` (not supported, I don't have claude code to implement and test it out, but I guess you get the point)
- `bun run ./src/index.ts -p "how many 'r's in strawberry ?" -m "gemini-flash-3.5" --provider "gemini"`
