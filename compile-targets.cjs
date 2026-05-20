/**
 * compile-targets.cjs
 * -------------------
 * Automates the MindAR online compiler to generate .mind image-target files
 * from the kit photos in public/kits/ and saves them to public/targets/.
 *
 * Usage (from ar-lab/ directory):
 *   node compile-targets.cjs
 */

const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const COMPILER_URL = 'https://hiukim.github.io/mind-ar-js-doc/tools/compile/'

// Map: source image → output filename
const KITS = [
  { image: 'npn-ce.jpeg',              output: 'npn-ce.mind'               },
  { image: 'half-full-subtractor.jpeg', output: 'half-full-subtractor.mind' },
  { image: 'rs-flipflop.jpeg',          output: 'rs-flipflop.mind'          },
  { image: 'jk-flipflop.jpeg',          output: 'jk-flipflop.mind'          },
  { image: 'ic741-amp.jpeg',            output: 'ic741-amp.mind'            },
  { image: 'ic555-astable.jpeg',        output: 'ic555-astable.mind'        },
]

const KITS_DIR    = path.resolve(__dirname, 'public', 'kits')
const TARGETS_DIR = path.resolve(__dirname, 'public', 'targets')

async function compileKit(page, kit) {
  const imagePath = path.join(KITS_DIR, kit.image)
  const outputPath = path.join(TARGETS_DIR, kit.output)

  if (!fs.existsSync(imagePath)) {
    console.log(`  ⚠  Skipping — image not found: ${imagePath}`)
    return false
  }
  if (fs.existsSync(outputPath)) {
    console.log(`  ✓  Already exists, skipping: ${kit.output}`)
    return true
  }

  console.log(`\n──────────────────────────────────────`)
  console.log(`  Kit:    ${kit.image}`)
  console.log(`  Output: ${kit.output}`)

  // Fresh page load for each kit (resets Dropzone + compiler state)
  await page.goto(COMPILER_URL, { waitUntil: 'networkidle', timeout: 60000 })

  // Upload image via the hidden Dropzone input
  await page.locator('input.dz-hidden-input').setInputFiles(imagePath)
  console.log('  → Image uploaded')
  await page.waitForTimeout(1200)

  // Click "Start" to begin compilation
  await page.locator('button.startButton_OY2G').click()
  console.log('  → Compilation started …')

  // Poll progress text shown on the page, wait until button says "Download compiled"
  let lastPct = ''
  for (let i = 0; i < 120; i++) {   // up to 120 × 2s = 4 minutes
    await page.waitForTimeout(2000)

    const btnText = await page.locator('button.startButton_OY2G').textContent()
    const pctMatch = (await page.content()).match(/(\d+)\s*%/)
    if (pctMatch && pctMatch[1] !== lastPct) {
      lastPct = pctMatch[1]
      process.stdout.write(`\r  → Progress: ${lastPct}%   `)
    }

    if (btnText && btnText.toLowerCase().includes('download')) {
      process.stdout.write('\n')
      console.log('  → Compilation complete — downloading …')
      break
    }
    if (i === 119) {
      process.stdout.write('\n')
      throw new Error('Compilation timed out (4 min)')
    }
  }

  // Now click "Download compiled" — this triggers a file download
  const dlPromise = page.waitForEvent('download', { timeout: 30000 })
  await page.locator('button.startButton_OY2G').click()

  const download = await dlPromise
  await download.saveAs(outputPath)

  const size = fs.statSync(outputPath).size
  console.log(`  ✓  Saved: ${kit.output}  (${(size / 1024).toFixed(0)} KB)`)
  return true
}

;(async () => {
  if (!fs.existsSync(TARGETS_DIR)) fs.mkdirSync(TARGETS_DIR, { recursive: true })

  console.log('Starting MindAR compiler automation …')
  console.log(`Kits dir:    ${KITS_DIR}`)
  console.log(`Targets dir: ${TARGETS_DIR}`)

  const browser = await chromium.launch({
    headless: false,          // headed mode needed for WebGL (used by TF.js during compile)
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  })

  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()

  let ok = 0
  for (const kit of KITS) {
    try {
      const success = await compileKit(page, kit)
      if (success) ok++
    } catch (err) {
      console.error(`\n  ✗  Error compiling ${kit.image}:`, err.message)
    }
  }

  await browser.close()

  console.log(`\n══════════════════════════════════════`)
  console.log(`  Done — ${ok}/${KITS.length} target files generated`)
  console.log(`  Location: ${TARGETS_DIR}`)
  if (ok < KITS.length) {
    console.log('\n  For any failed kits, use the online compiler manually:')
    console.log('  https://hiukim.github.io/mind-ar-js-doc/tools/compile/')
  }
  console.log(`══════════════════════════════════════\n`)
})()
