#!/usr/bin/env node

import { chromium } from "playwright"
import { mkdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"

function printUsage() {
  console.log(`
loom-watch - Capture video frames from Loom recordings for visual analysis

Usage:
  loom-watch <loom-share-url> [options]

Options:
  --interval=N    Seconds between frames (default: 2)
  --max-frames=N  Maximum number of frames to capture (default: 60)
  --out=<dir>     Output directory (default: tmp/loom-frames)
  --help          Show this help message

Examples:
  loom-watch https://www.loom.com/share/abc123def456
  loom-watch --interval=1 https://www.loom.com/share/abc123def456
  loom-watch --interval=3 --max-frames=30 https://www.loom.com/share/abc123def456
`)
}

function parseArgs(argv) {
  const args = { interval: 2, maxFrames: 60 }

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") { printUsage(); process.exit(0) }
    else if (arg.startsWith("--interval=")) args.interval = Number(arg.slice(11))
    else if (arg.startsWith("--max-frames=")) args.maxFrames = Number(arg.slice(13))
    else if (arg.startsWith("--out=")) args.outDir = arg.slice(6)
    else if (arg.startsWith("http://") || arg.startsWith("https://")) args.url = arg
    else if (!arg.startsWith("--")) args.url = arg
  }

  if (!args.url) {
    console.error("Error: Please provide a Loom share URL.")
    printUsage()
    process.exit(1)
  }

  if (!args.url.match(/^https?:\/\/(www\.)?loom\.com\/share\//)) {
    console.error("Error: URL must be a Loom share link (https://www.loom.com/share/...)")
    process.exit(1)
  }

  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const outDir = resolve(args.outDir || "tmp/loom-frames")

  // Clean previous frames and create fresh directory
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  let browser
  async function cleanup() {
    if (browser) {
      try { await browser.close() } catch {}
      browser = null
    }
  }
  process.on("SIGINT", async () => { await cleanup(); process.exit(130) })
  process.on("SIGTERM", async () => { await cleanup(); process.exit(143) })

  try {
    browser = await chromium.launch()
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()

    process.stderr.write("Loading Loom page...\n")
    await page.goto(args.url, { waitUntil: "load", timeout: 60000 })
    // Wait for the video player to initialize
    await page.waitForSelector("video", { timeout: 15000 }).catch(() => {})
    await new Promise(r => setTimeout(r, 2000))

    // Click the video area to start playback
    try {
      const playBtn = await page.locator("button[aria-label*='Play'], [data-testid='play-button']").first()
      await playBtn.click({ timeout: 3000 })
    } catch {
      // Fall back to clicking the video area
      await page.click("video", { timeout: 3000 }).catch(() => {
        page.click("body", { position: { x: 720, y: 400 } })
      })
    }

    await new Promise(r => setTimeout(r, 1000))

    // Dismiss Loom signup popup and any other overlays that sit on top of the video
    for (let attempt = 0; attempt < 3; attempt++) {
      // Try clicking the X/close button on the "Sign up to let X know you saw their Loom" modal
      try {
        const closeBtn = await page.locator("[aria-label='Close'], [aria-label='Dismiss'], button:has(svg[aria-label='Close']), [class*='modal'] button[class*='close'], [class*='Modal'] button").first()
        await closeBtn.click({ timeout: 1000 })
        await new Promise(r => setTimeout(r, 500))
      } catch { /* no popup to dismiss */ }
    }

    // Nuclear option: hide any remaining overlays/modals via CSS
    await page.evaluate(() => {
      const style = document.createElement("style")
      style.id = "loom-watch-cleanup"
      style.textContent = `
        [class*="Modal"], [class*="modal"], [class*="Popup"], [class*="popup"],
        [class*="Overlay"][class*="signup"], [class*="SignUp"], [class*="sign-up"],
        [class*="cta-modal"], [class*="CtaModal"], [class*="Prompt"],
        [role="dialog"], [aria-modal="true"] { display: none !important; }
      `
      document.head.appendChild(style)
    })

    // Get video info
    const videoInfo = await page.evaluate(() => {
      const video = document.querySelector("video")
      if (!video) return null
      return { duration: video.duration, width: video.videoWidth, height: video.videoHeight }
    })

    if (!videoInfo || !videoInfo.duration) {
      console.error("Error: Could not find video element or determine duration.")
      process.exit(1)
    }

    const duration = videoInfo.duration
    const frameCount = Math.min(Math.ceil(duration / args.interval), args.maxFrames)

    process.stderr.write(`Video: ${duration.toFixed(1)}s, capturing ${frameCount} frames every ${args.interval}s\n`)

    // Pause the video for clean frame captures
    await page.evaluate(() => {
      const video = document.querySelector("video")
      if (video) video.pause()
    })

    // Hide Loom UI chrome to get clean video frames
    await page.evaluate(() => {
      // Hide everything except the video
      const style = document.createElement("style")
      style.textContent = `
        [class*="TopBar"], [class*="BottomBar"], [class*="Controls"],
        [class*="sidebar"], [class*="Sidebar"], [class*="Comment"],
        [class*="header"], [class*="Header"], [class*="transcript"],
        [class*="emoji"], [class*="Emoji"], [class*="reaction"],
        [class*="speed"], [class*="Speed"], [class*="caption"],
        nav, footer { display: none !important; }
      `
      document.head.appendChild(style)
    })

    const framePaths = []

    for (let i = 0; i < frameCount; i++) {
      const seekTime = i * args.interval

      // Seek to specific time
      await page.evaluate((t) => {
        const video = document.querySelector("video")
        if (video) video.currentTime = t
      }, seekTime)

      // Wait for seek to complete and frame to render
      await page.evaluate(() => {
        return new Promise((resolve) => {
          const video = document.querySelector("video")
          if (!video) return resolve()
          if (video.readyState >= 2) return resolve()
          video.addEventListener("seeked", resolve, { once: true })
          setTimeout(resolve, 500) // fallback timeout
        })
      })
      await new Promise(r => setTimeout(r, 100))

      // Try to screenshot just the video element for cleaner output
      const filename = `${outDir}/frame-${String(i).padStart(3, "0")}-${seekTime}s.png`
      try {
        const videoEl = await page.locator("video").first()
        await videoEl.screenshot({ path: filename })
      } catch {
        // Fallback to full page if video element screenshot fails
        await page.screenshot({ path: filename })
      }

      framePaths.push(filename)
      process.stderr.write(`  [${i + 1}/${frameCount}] ${seekTime}s\n`)
    }

    // Output frame paths to stdout (one per line) for consumption by the skill
    console.log(JSON.stringify({
      url: args.url,
      duration: duration,
      interval: args.interval,
      frameCount: framePaths.length,
      outDir: outDir,
      frames: framePaths.map((path, i) => ({
        path,
        timestamp: i * args.interval,
      })),
    }, null, 2))

  } catch (err) {
    if (err.message?.includes("timeout")) {
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
