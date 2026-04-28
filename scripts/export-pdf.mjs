import { spawnSync } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const outDir = path.join(root, 'artifacts', 'pdf')
const configs = [
  'pdf-configs/datasheet.mts',
  'pdf-configs/app-guide.mts',
  'pdf-configs/product-manual.mts',
  'pdf-configs/series-manual.mts',
  'pdf-configs/legal.mts'
]

for (const config of configs) {
  const args = [
    'vitepress-export-pdf',
    'export',
    'docs',
    '--config',
    config,
    '--outDir',
    outDir
  ]

  const result = spawnSync('npx', args, {
    stdio: 'inherit',
    shell: true
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
