import { spawnSync } from 'node:child_process'
import { readFileSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'
import { BRAND, COMPANY, COMPANY_EN, YEAR, FONT, HEADER_TEXT_COLOR } from '../pdf-configs/_shared.mjs'

const root = process.cwd()
const outDir = path.join(root, 'artifacts', 'pdf')
// NOTE: Must be a relative path for vitepress-export-pdf to avoid invalid path issue
const relTempDir = 'artifacts/.temp'
const tempDir = path.join(root, relTempDir)
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
  let html = readFileSync(path.join(coverDir, htmlFile), 'utf-8')
  
  // 注入公共 CSS 样式与当前变量
  try {
    const sharedCss = readFileSync(path.join(coverDir, 'shared-cover.css'), 'utf-8')
    const styleVariables = `
      :root {
        --brand-color: ${BRAND};
        --font-family: ${FONT};
        --header-text-color: ${HEADER_TEXT_COLOR};
      }
    `
    html = html.replace('</head>', `<style>${styleVariables}\n${sharedCss}</style></head>`)
  } catch(e) {
    // 忽略找不到样式的错误
  }

  // 模板字符文本替换
  html = html.replace(/{{COMPANY}}/g, COMPANY)
  html = html.replace(/{{COMPANY_EN}}/g, COMPANY_EN)
  html = html.replace(/{{YEAR}}/g, YEAR)
  html = html.replace(/{{MONTH}}/g, MONTH)

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
    '--outDir', relTempDir, // 使用相对路径解决合并时的 Path contains invalid characters
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
