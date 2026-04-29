import DefaultTheme from 'vitepress/theme'
import './custom.css'
import './print.css'
// @ts-ignore
import WavedromVue from './components/Wavedrom.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("WavedromVue", WavedromVue)
  }
}
