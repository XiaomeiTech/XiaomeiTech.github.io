export default function wavedromPlugin(md) {
  const defaultRenderer = md.renderer.rules.fence?.bind(md.renderer.rules)
  md.renderer.rules.fence = (tokens, index, options, env, slf) => {
    const token = tokens[index]
    if (token.info.trim() === 'wavedrom') {
      try {
        const content = encodeURIComponent(token.content.trim())
        return `<WavedromVue id="wave-${index}" encoded-text="${content}"></WavedromVue>`
      } catch (err) {
        return `<pre>${err}</pre>`
      }
    }
    if (defaultRenderer) {
      return defaultRenderer(tokens, index, options, env, slf)
    }
    return slf.renderToken(tokens, index, options)
  }
}