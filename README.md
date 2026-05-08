# loom-transcript

Extract transcripts and capture frames from Loom video share URLs.

## Requirements

- **Node.js** 18 or later

## Installation

Run directly from GitHub (no install needed):

```bash
npx github:jonasmedeiros/loom-transcript https://www.loom.com/share/your-video-id
```

Or clone and install locally:

```bash
git clone https://github.com/jonasmedeiros/loom-transcript.git
cd loom-transcript
npm install
npm link  # makes 'loom-transcript' and 'loom-watch' available globally
```

## loom-transcript

Extract the text transcript from a Loom video.

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

## loom-watch

Capture video frames from a Loom recording as PNG screenshots. Useful when the audio transcript is poor (background noise, no narration) and you need to see what's on screen.

```bash
# Capture frames every 2 seconds (default)
loom-watch https://www.loom.com/share/abc123

# Capture every second for more detail
loom-watch --interval=1 https://www.loom.com/share/abc123

# Quick overview: 20 frames, 3 seconds apart
loom-watch --interval=3 --max-frames=20 https://www.loom.com/share/abc123

# Custom output directory
loom-watch --out=./my-frames https://www.loom.com/share/abc123
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--interval=N` | `2` | Seconds between frames |
| `--max-frames=N` | `60` | Maximum number of frames to capture |
| `--out=<dir>` | `tmp/loom-frames` | Output directory for PNG files |

### Output

Progress is printed to stderr. The final JSON result is printed to stdout:

```json
{
  "url": "https://www.loom.com/share/abc123",
  "duration": 45.2,
  "interval": 2,
  "frameCount": 23,
  "outDir": "/absolute/path/to/tmp/loom-frames",
  "frames": [
    { "path": "/absolute/path/to/tmp/loom-frames/frame-000-0s.png", "timestamp": 0 },
    { "path": "/absolute/path/to/tmp/loom-frames/frame-001-2s.png", "timestamp": 2 }
  ]
}
```

Frame files are named `frame-NNN-Ts.png` where `NNN` is the frame index and `T` is the timestamp in seconds.

### Tips

- For a 60s video, `--interval=3` gives ~20 frames -- good first pass
- If you spot an interesting moment, re-run with `--interval=1` for more detail
- Screenshots are cropped to just the video element (no Loom page chrome)
- The tool automatically dismisses Loom's signup popup

## How it works

Both tools launch a headless Chromium browser using [Playwright](https://playwright.dev) and navigate to the Loom share page. No Loom account or API key is required -- works with any public share link.

- **loom-transcript** intercepts the network response containing the VTT captions file
- **loom-watch** seeks through the video element and captures screenshots at each interval

## License

MIT
