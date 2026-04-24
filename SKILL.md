---
name: loom
description: Extract transcripts from Loom video URLs. Use when the user provides a Loom share link and wants to read, analyze, or summarize the video content.
argument-hint: <loom-share-url>
allowed-tools: Bash(node ~/projects/loom-transcript/bin/loom-transcript.mjs *)
---

# Loom Transcript Extractor

Extract the transcript from a Loom video share URL using the `loom-transcript` CLI tool.

## Prerequisites

The tool must be cloned and installed locally:

```bash
git clone https://github.com/jonasmedeiros/loom-transcript.git ~/projects/loom-transcript
cd ~/projects/loom-transcript && npm install
```

## How to extract a transcript

Run the CLI tool with the Loom URL:

```bash
node ~/projects/loom-transcript/bin/loom-transcript.mjs <loom-url>
```

Available flags:
- `--json` — Output as JSON with timestamps
- `--vtt` — Output raw VTT captions
- No flag — Plain text transcript (default)

## Steps

1. Take the Loom URL from `$ARGUMENTS` or from the user's message
2. Validate it's a `loom.com/share/` URL
3. Run the CLI to extract the transcript (plain text by default)
4. Present the transcript to the user
5. If the user asks, summarize the key points or analyze the content

## Notes

- The tool launches a headless Chrome browser — requires Google Chrome installed
- Works with any public Loom share link, no Loom account needed
- If the command fails, check that Chrome is installed and the URL is valid
