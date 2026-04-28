import { defineUserConfig } from 'vitepress-export-pdf'

type UserConfig = Parameters<typeof defineUserConfig>[0]

const commonPdfOptions = {
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div style="font-size:10px;width:100%;text-align:center;color:#6b7280;">Xiaomei Tech</div>',
  footerTemplate: '<div style="font-size:10px;width:100%;text-align:center;color:#6b7280;">PDF Export</div>',
  margin: {
    top: '2cm',
    bottom: '2cm',
    left: '1.5cm',
    right: '1.5cm'
  }
}

export function makePdfConfig(config: UserConfig): ReturnType<typeof defineUserConfig> {
  return defineUserConfig({
    pdfOptions: commonPdfOptions,
    pdfOutlines: true,
    ...config
  })
}
