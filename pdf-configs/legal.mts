import { makePdfConfig } from './shared.mts'

export default makePdfConfig({
  outFile: 'legal.pdf',
  routePatterns: ['/pdf/legal.html']
})
