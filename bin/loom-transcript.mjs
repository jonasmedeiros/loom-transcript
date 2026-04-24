#!/usr/bin/env node

import puppeteer from "puppeteer-core"
import { existsSync } from "fs"
import { platform } from "os"

const CHROME_PATHS = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ],
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  ],
}

function findChrome() {
  const paths = CHROME_PATHS[platform()] || []
  for (const p of paths) {
    if (existsSync(p)) return p
  }
  return null
}

function parseVttToText(vtt) {
  const lines = vtt.split("\n")
  const textLines = []

  for (const line of lines) {
    // Skip WEBVTT header, cue numbers, timestamps, and empty lines
    if (
      line.startsWith("WEBVTT") ||
      line.trim() === "" ||
      /^\d+$/.test(line.trim()) ||
      /^\d{2}:\d{2}/.test(line.trim())
    ) {
      continue
    }
    // Strip speaker tags like <v 0>...</v>
    const cleaned = line.replace(/<\/?v[^>]*>/g, "").trim()
    if (cleaned) textLines.push(cleaned)
  }

  return textLines.join(" ")
}

function parseVttToJson(vtt) {
  const lines = vtt.split("\n")
  const cues = []
  let currentCue = null

  for (const line of lines) {
    const timestampMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/)
    if (timestampMatch) {
      if (currentCue) cues.push(currentCue)
      currentCue = { start: timestampMatch[1], end: timestampMatch[2], text: "" }
      continue
    }

    if (currentCue && line.trim() && !/^\d+$/.test(line.trim())) {
      const cleaned = line.replace(/<\/?v[^>]*>/g, "").trim()
      if (cleaned) {
        currentCue.text += (currentCue.text ? " " : "") + cleaned
      }
    }
  }

  if (currentCue) cues.push(currentCue)
  return cues
}

function printUsage() {
  console.log(`
loom-transcript - Extract transcripts from Loom videos

Usage:
  loom-transcript <loom-share-url> [options]

Options:
  --json    Output as JSON with timestamps
  --vtt     Output raw VTT captions
  --help    Show this help message

Examples:
  loom-transcript https://www.loom.com/share/abc123def456
  loom-transcript --json https://www.loom.com/share/abc123def456
  loom-transcript --vtt https://www.loom.com/share/abc123def456

Requirements:
  Google Chrome (or Chromium) must be installed on your machine.
`)
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    printUsage()
    process.exit(0)
  }

  const flags = args.filter((a) => a.startsWith("--"))
  const positional = args.filter((a) => !a.startsWith("--"))
  const outputJson = flags.includes("--json")
  const outputVtt = flags.includes("--vtt")

  const url = positional[0]
  if (!url) {
    console.error("Error: Please provide a Loom share URL.")
    printUsage()
    process.exit(1)
  }

  if (!url.match(/^https?:\/\/(www\.)?loom\.com\/share\//)) {
    console.error("Error: URL must be a Loom share link (https://www.loom.com/share/...)")
    process.exit(1)
  }

  const chromePath = findChrome()
  if (!chromePath) {
    console.error("Error: Could not find Chrome or Chromium.")
    console.error(`Looked in: ${(CHROME_PATHS[platform()] || []).join(", ")}`)
    console.error("Install Google Chrome or set the path manually.")
    process.exit(1)
  }

  let browser
  async function cleanup() {
    if (browser) {
      try { await browser.close() } catch {}
      browser = null
    }
  }
  process.on("SIGINT", async () => { await cleanup(); process.exit(130) })
  process.on("SIGTERM", async () => { await cleanup(); process.exit(143) })
  process.on("uncaughtException", async () => { await cleanup(); process.exit(1) })

  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })

    const page = await browser.newPage()

    let captionsVtt = null

    page.on("response", async (response) => {
      const respUrl = response.url()
      if (respUrl.includes("captions") && respUrl.includes(".vtt")) {
        try {
          captionsVtt = await response.text()
        } catch {}
      }
    })

    process.stderr.write("Fetching transcript...")
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 })

    // Wait for captions to load (they load async)
    for (let i = 0; i < 10 && !captionsVtt; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      process.stderr.write(".")
    }
    process.stderr.write("\n")

    if (!captionsVtt) {
      console.error("Error: No transcript found. The video may not have captions enabled.")
      process.exit(1)
    }

    if (outputVtt) {
      console.log(captionsVtt)
    } else if (outputJson) {
      console.log(JSON.stringify(parseVttToJson(captionsVtt), null, 2))
    } else {
      console.log(parseVttToText(captionsVtt))
    }
  } catch (err) {
    if (err.message.includes("timeout")) {
      console.error("Error: Timed out loading the Loom page. Check the URL and your internet connection.")
    } else {
      console.error(`Error: ${err.message}`)
    }
    process.exit(1)
  } finally {
    await cleanup()
  }
}

main()
