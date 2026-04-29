import { defineUserConfig } from 'vitepress-export-pdf'
import { datasheetConfig } from './_shared.mjs'

export default defineUserConfig(datasheetConfig({
  outFile: 'datasheet.pdf',
  title: '数据手册',
  routePatterns: [
    '!/',
    '!/web/**',
    '!/pdf/**',
    '!/custom/**',
    '!/company/**',
  ],
}))
