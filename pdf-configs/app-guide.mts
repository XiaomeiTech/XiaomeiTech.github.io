import { defineUserConfig } from 'vitepress-export-pdf'

export default defineUserConfig({
  outFile: 'app-guide.pdf',
  routePatterns: [
    // '!/',
    '!/feeder-controller/**',
    // '!/remoteIO/**',
    // '!/pdf/**',
    // '!/custom/**',
    // '!/company/**',
  ],
  pdfOptions: {
    format: 'A4',
    margin: { top: 25, right: 20, bottom: 25, left: 20 },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `<div style="width:100%;text-align:center;font-size:9px;color:#888;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
  },
})
