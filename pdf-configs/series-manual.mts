import { defineUserConfig } from 'vitepress-export-pdf'
import { datasheetConfig } from './_shared.mjs'

export default defineUserConfig(datasheetConfig({
  outFile: 'series-manual.pdf',
  title: '系列合并手册',
  routePatterns: [
    '!/',
    '!/web/**',
    '!/pdf/**',
  ],
}))
