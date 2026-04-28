import { makePdfConfig } from './shared.mts'

export default makePdfConfig({
  outFile: 'series-manual.pdf',
  routePatterns: ['/pdf/series-manual.html']
})
