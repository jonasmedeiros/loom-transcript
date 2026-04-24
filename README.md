# loom-transcript

Extract transcripts from Loom video share URLs.

## Requirements

- **Node.js** 18 or later
- **Google Chrome** (or Chromium) installed on your machine

## Installation

```bash
npm install -g loom-transcript
```

Or run directly without installing:

```bash
npx loom-transcript https://www.loom.com/share/your-video-id
```

## Usage

```bash
# Plain text transcript
loom-transcript https://www.loom.com/share/abc123

# JSON with timestamps
loom-transcript --json https://www.loom.com/share/abc123

# Raw VTT captions
loom-transcript --vtt https://www.loom.com/share/abc123
```

### Output formats

**Default (plain text):**
```
I am able to recreate what the client is saying. They're saying that...
```

**JSON (`--json`):**
```json
[
  {
    "start": "00:00:00.011",
    "end": "00:00:02.500",
    "text": "I am able to recreate what the,"
  },
  {
    "start": "00:00:02.500",
    "end": "00:00:04.562",
    "text": "the client is saying. They're saying that, um,"
  }
]
```

**VTT (`--vtt`):**
```
WEBVTT

1
00:00:00.011 --> 00:00:02.500
I am able to recreate what the,

2
00:00:02.500 --> 00:00:04.562
the client is saying. They're saying that, um,
```

## How it works

Loom stores video transcripts behind authenticated CDN URLs. This tool launches a headless Chrome browser using [Puppeteer](https://pptr.dev), navigates to the Loom share page, and intercepts the network response containing the VTT captions file. No Loom account or API key is required — it works with any public share link.

## License

MIT
