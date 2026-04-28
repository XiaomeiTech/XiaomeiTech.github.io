import { makePdfConfig } from './shared.mts'

export default makePdfConfig({
  outFile: 'datasheet.pdf',
  routePatterns: ['/pdf/datasheet.html']
})
