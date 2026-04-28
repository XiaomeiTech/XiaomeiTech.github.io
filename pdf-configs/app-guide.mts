import { makePdfConfig } from './shared.mts'

export default makePdfConfig({
  outFile: 'app-guide.pdf',
  routePatterns: ['/pdf/app-guide.html']
})
