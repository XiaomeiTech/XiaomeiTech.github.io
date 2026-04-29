import { defineUserConfig } from 'vitepress-export-pdf'
import { datasheetConfig } from './_shared.mjs'

export default defineUserConfig(datasheetConfig({
  outFile: 'app-guide.pdf',
  title: '应用指南',
  routePatterns: [
    '!/',
    '!/feeder-controller/**',
    '!/remoteIO/**',
    '!/pdf/**',
    '!/custom/**',
    '!/company/**',
  ],
}))
