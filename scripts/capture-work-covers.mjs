/**
 * 抓取各作品路由首屏截图 → public/images/works/*.webp
 * Usage: node scripts/capture-work-covers.mjs
 */
import pw from '/Users/mac/.npm/_npx/fd3bca3c548369c0/node_modules/playwright/index.js'
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const { chromium } = pw
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const base = process.env.CAPTURE_BASE || 'http://localhost:3000'
const outDir = path.join(root, 'public/images/works')
fs.mkdirSync(outDir, { recursive: true })

const pages = [
  { href: '/canvas', file: 'canvas.webp' },
  { href: '/fortune', file: 'fortune.webp' },
  { href: '/music', file: 'music.webp' },
  { href: '/video', file: 'video.webp' },
  { href: '/short', file: 'short.webp' },
  { href: '/hongguo', file: 'hongguo.webp' },
  { href: '/game', file: 'game.webp' },
  { href: '/education', file: 'education.webp' },
  { href: '/fish', file: 'fish.webp' },
]

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
})
const page = await context.newPage()

for (const item of pages) {
  const url = base + item.href
  console.log('capturing', url)
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
  } catch (e) {
    console.warn('goto soft-fail', item.href, String(e).slice(0, 160))
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    } catch (e2) {
      console.error('goto hard-fail', item.href, String(e2).slice(0, 160))
      continue
    }
  }
  // 若声明弹窗仍在，先关掉再截，避免封面带蒙层
  try {
    const ok = page.getByRole('button', { name: '我知道了' })
    if (await ok.isVisible({ timeout: 800 })) await ok.click({ timeout: 2000 })
  } catch {
    /* no disclaimer */
  }
  await page.waitForTimeout(1800)
  const png = await page.screenshot({ type: 'png', fullPage: false })
  const webp = await sharp(png)
    .resize(1280, 800, { fit: 'cover', position: 'top' })
    .webp({ quality: 82 })
    .toBuffer()
  const dest = path.join(outDir, item.file)
  fs.writeFileSync(dest, webp)
  console.log('wrote', item.file, webp.length)
}

await browser.close()
console.log('done')
