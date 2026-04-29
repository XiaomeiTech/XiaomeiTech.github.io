import { defineUserConfig } from 'vitepress-export-pdf'
import { datasheetConfig } from './_shared.mjs'

export default defineUserConfig(datasheetConfig({
  outFile: 'product-manual.pdf',
  title: '单品手册',
  routePatterns: [
    '!/',
    '!/web/**',
    '!/remoteIO/**',
    '!/pdf/**',
    '!/custom/**',
    '!/company/**',
    '!/cover/**',
  ],
}))
