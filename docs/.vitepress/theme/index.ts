import DefaultTheme from 'vitepress/theme'
// @ts-ignore
import Layout from './Layout.vue'
// @ts-ignore
import './custom.css'
// @ts-ignore
import './print.css'
// @ts-ignore
import WavedromVue from './components/Wavedrom.vue'
// @ts-ignore
import XmCarousel from './components/XmCarousel.vue'
// @ts-ignore
import XmSolutionCards from './components/XmSolutionCards.vue'

import type { App } from 'vue'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }: { app: App }) {
    app.component("WavedromVue", WavedromVue)
    app.component("XmCarousel", XmCarousel)
    app.component("XmSolutionCards", XmSolutionCards)
  }
}
