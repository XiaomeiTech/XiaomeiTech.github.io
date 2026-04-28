import { makePdfConfig } from './shared.mts'

export default makePdfConfig({
  outFile: 'manuals-all.pdf',
  routePatterns: ['/pdf/**', '!/pdf/index.html']
})
