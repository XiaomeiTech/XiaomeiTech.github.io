import DefaultTheme from 'vitepress/theme'
// @ts-ignore
import Layout from './Layout.vue'
// @ts-ignore
import './custom.css'
import './module-colors.css'
// @ts-ignore
import './print.css'
// @ts-ignore
import WavedromVue from './components/Wavedrom.vue'
// @ts-ignore
import XmCarousel from './components/XmCarousel.vue'
// @ts-ignore
import XmSolutionCards from './components/XmSolutionCards.vue'
// @ts-ignore
import IoSelectionTable from './components/IoSelectionTable.vue'
// @ts-ignore
import ModuleBadge from './components/ModuleBadge.vue'

import type { App } from 'vue'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }: { app: App }) {
    app.component("WavedromVue", WavedromVue)
    app.component("XmCarousel", XmCarousel)
    app.component("XmSolutionCards", XmSolutionCards)
    app.component("IoSelectionTable", IoSelectionTable)
    app.component("ModuleBadge", ModuleBadge)
  }
}
