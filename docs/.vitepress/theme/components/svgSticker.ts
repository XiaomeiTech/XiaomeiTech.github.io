// Keep uploaded vector artwork as an image resource, never insert it into the page DOM.
export function svgStickerData(text: string): string {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('SVG 请使用不包含外部实体的普通矢量文件')
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const root = doc.documentElement
  if (root.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('SVG 文件格式无效')
  const allowed = new Set(['svg', 'g', 'defs', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'textPath', 'use', 'image', 'symbol', 'clipPath', 'mask', 'pattern', 'linearGradient', 'radialGradient', 'stop', 'filter', 'feGaussianBlur', 'feOffset', 'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feFuncR', 'feFuncG', 'feFuncB', 'feFuncA', 'feComposite', 'feFlood', 'feMerge', 'feMergeNode', 'feMorphology', 'feTurbulence', 'feDisplacementMap', 'style', 'title', 'desc'])
  const safeReference = (s: string) => /^#[\w.:-]+$/.test(s.trim()) || /^data:image\/(png|jpeg|webp|gif);base64,[a-z\d+/=\s]+$/i.test(s.trim())
  const safeCss = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]*(;|$)/gi, '').replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (_, quote, value) => safeReference(value) ? `url("${value.trim()}")` : 'none')
  for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
    if (el.namespaceURI !== 'http://www.w3.org/2000/svg' || !allowed.has(el.localName)) { el.remove(); continue }
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name) || attr.name === 'xml:base' || (attr.localName === 'href' && !safeReference(attr.value))) el.removeAttributeNode(attr)
      else if (attr.name === 'style' || /url\s*\(/i.test(attr.value)) {
        if (attr.value.includes('\\')) el.removeAttributeNode(attr)
        else attr.value = safeCss(attr.value)
      }
    }
    if (el.localName === 'style') el.textContent = el.textContent?.includes('\\') ? '' : safeCss(el.textContent || '')
  }
  const box = root.getAttribute('viewBox')?.trim().split(/[ ,]+/).map(Number)
  if (box?.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0) {
    root.setAttribute('width', String(box[2])); root.setAttribute('height', String(box[3]))
  }
  const bytes = new TextEncoder().encode(new XMLSerializer().serializeToString(root))
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return 'data:image/svg+xml;base64,' + btoa(binary)
}
