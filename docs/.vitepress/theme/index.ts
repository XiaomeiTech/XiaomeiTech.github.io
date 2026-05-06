import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import './custom.css'
import './print.css'
// @ts-ignore
import WavedromVue from './components/Wavedrom.vue'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component("WavedromVue", WavedromVue)
  }
}
