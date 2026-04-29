const COMPANY = '小美技术（东莞）有限公司'
const COMPANY_EN = 'Xiaomei Technology (Dongguan) Co., Ltd.'
const BRAND = '#dc2626'
const YEAR = new Date().getFullYear()

const MARGIN = { top: 94, right: 57, bottom: 94, left: 57 }

function h(html) { return html.replace(/\n\s*/g, '') }

const FONT = "'Microsoft YaHei', 'SimHei', sans-serif"

/**
 * @param {{ outFile: string, title: string, routePatterns: string[] }} opts
 * @returns {import('vitepress-export-pdf').UserConfig}
 */
export function datasheetConfig(opts) {
  const header = h(`
    <table style="width:100%;padding:0 8px 6px 8px;font-family:${FONT};font-size:11px;color:#333;border-bottom:2px solid ${BRAND};border-collapse:collapse;">
      <tr>
        <td style="font-weight:bold;font-size:12px;color:${BRAND};text-align:left;vertical-align:bottom;">${COMPANY}</td>
        <td style="font-weight:bold;font-size:12px;text-align:right;vertical-align:bottom;">${opts.title}</td>
      </tr>
    </table>
  `)

  const footer = h(`
    <table style="width:100%;padding:6px 8px 0 8px;font-family:${FONT};font-size:8px;color:#999;border-top:1px solid #ddd;border-collapse:collapse;">
      <tr>
        <td style="text-align:left;">&copy; ${YEAR} ${COMPANY_EN}</td>
        <td style="text-align:right;font-size:9px;"><span class="pageNumber"></span> / <span class="totalPages"></span></td>
      </tr>
    </table>
  `)

  return {
    outFile: opts.outFile,
    routePatterns: opts.routePatterns,
    pdfOptions: {
      format: 'A4',
      margin: MARGIN,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: header,
      footerTemplate: footer,
    },
  }
}
