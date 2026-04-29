import { spawnSync } from 'node:child_process'
import { readFileSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'

const root = process.cwd()
const outDir = path.join(root, 'artifacts', 'pdf')
const tempDir = path.join(root, 'artifacts', '.temp')
const coverDir = path.join(root, 'pdf-configs', 'covers')

const configs = [
  { config: 'pdf-configs/datasheet.mts',  cover: 'cover-datasheet.html',  out: 'datasheet.pdf' },
  // { config: 'pdf-configs/app-guide.mts', cover: 'cover-app-guide.html', out: 'app-guide.pdf' },
  // { config: 'pdf-configs/product-manual.mts', cover: 'cover-product-manual.html', out: 'product-manual.pdf' },
  // { config: 'pdf-configs/series-manual.mts', cover: 'cover-series-manual.html', out: 'series-manual.pdf' },
]

mkdirSync(tempDir, { recursive: true })
mkdirSync(outDir, { recursive: true })

async function renderCover(browser, htmlFile) {
  const html = readFileSync(path.join(coverDir, htmlFile), 'utf-8')
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const outPath = path.join(tempDir, htmlFile.replace('.html', '.pdf'))
  await page.pdf({
    path: outPath,
    format: 'A4',
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    printBackground: true,
  })
  await page.close()
  return outPath
}

function runVitepressExport(config, outFile) {
  const args = [
    'vitepress-export-pdf', 'export', 'docs',
    '--config', config,
    '--outFile', outFile,
    '--outDir', tempDir,
  ]
  const result = spawnSync('npx', args, { stdio: 'inherit', shell: true })
  return result.status === 0
}

function mergePDFs(coverPath, bodyPath, outputPath) {
  const args = ['merge-pdfs', coverPath, bodyPath, '-o', outputPath]
  const result = spawnSync('npx', args, { stdio: 'inherit', shell: true })
  return result.status === 0
}

async function main() {
  const browser = await puppeteer.launch({ headless: true })

  for (const { config, cover, out } of configs) {
    console.log(`\n=== ${out} ===`)

    // 1. render cover
    console.log('[cover] rendering...')
    const coverPath = await renderCover(browser, cover)

    // 2. body via vitepress-export-pdf
    console.log('[body] generating...')
    const ok = runVitepressExport(config, out)
    if (!ok) {
      console.error(`[body] failed for ${config}`)
      continue
    }
    const bodyPath = path.join(tempDir, out)

    // 3. merge
    console.log('[merge] combining...')
    const finalPath = path.join(outDir, out)
    mergePDFs(coverPath, bodyPath, finalPath)
    console.log(`[done] ${finalPath}`)
  }

  await browser.close()

  // clean temp
  rmSync(tempDir, { recursive: true, force: true })
  console.log('\nAll PDFs generated.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
