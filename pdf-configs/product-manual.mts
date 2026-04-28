import { makePdfConfig } from './shared.mts'

export default makePdfConfig({
  outFile: 'product-manual.pdf',
  routePatterns: ['/pdf/product-manual.html']
})
