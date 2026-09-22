import { ExtrudeGeometry, Path, Shape } from 'three'

export type Opening = { name: string; x: number; y: number; width: number; height: number }
export type StickerTemplate = {
  id: string; title: string; width: number; height: number
  // Millimetres in the source GLB's local coordinate frame. Artwork Y points down.
  left: number; top: number; back: number; openings: Opening[]
}
export type StickerState = {
  version: 1; template: string; image: string; filename: string
  x: number; y: number; zoom: number; scaleX: number; scaleY: number; rotation: number
  thickness: number; background: string
  // Corner offsets in image-width / image-height units, clockwise from top left.
  corners?: [number, number][]
  // Optional four-point crop in normalized ORIGINAL image coordinates.
  sourceCorners?: [number, number][]
  roughness?: number; reflection?: number
}
export function slaveStickerTemplate(count: 1 | 2): StickerTemplate {
  const left = -28.5, top = 51.8
  const aperture = (name: string, x0: number, x1: number, y0: number, y1: number): Opening =>
    ({ name, x: x0 - left, y: top - y1, width: x1 - x0, height: y1 - y0 })
  return {
    id: `slave-${count}`, title: `${count === 1 ? '单' : '双'}连接器贴膜`,
    width: 19.2, height: 94.1, left, top, back: 71.62,
    // The single-connector film covers the vacant upper moulded opening.
    // Clearances include the complete connector foot, not just the wire entries.
    openings: [
      ...(count === 2 ? [aperture('上方 2×8 pin', -26.4, -12.04, 18.05, 47.55)] : []),
      aperture('下方 2×9 pin', -26.4, -12.83, -37.66, -4.91)
    ]
  }
}
export const newSticker = (template: StickerTemplate): StickerState => ({
  version: 1, template: template.id, image: '', filename: '', x: 0, y: 0,
  zoom: 1, scaleX: 1, scaleY: 1, rotation: 0, thickness: 0.35, background: '#35383e', corners: [[0, 0], [0, 0], [0, 0], [0, 0]], roughness: .7, reflection: .3
})
export function validateSticker(value: unknown, template: StickerTemplate): value is StickerState {
  const s = value as StickerState
  const range = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max
  return !!s && s.version === 1 && s.template === template.id && typeof s.filename === 'string' &&
    typeof s.image === 'string' && s.image.length < 24_000_000 && /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(s.image) &&
    range(s.x, -200, 200) && range(s.y, -200, 200) && range(s.zoom, .1, 10) &&
    range(s.scaleX, .1, 8) && range(s.scaleY, .1, 8) && range(s.rotation, -180, 180) &&
    range(s.thickness, .05, 2) && /^#[\da-f]{6}$/i.test(s.background) &&
    (!s.corners || (s.corners.length === 4 && s.corners.every(p => Array.isArray(p) && p.length === 2 && p.every(n => range(n, -3, 3))) && validQuad(localCorners(s)))) &&
    (!s.sourceCorners || (s.sourceCorners.length === 4 && s.sourceCorners.every(p => Array.isArray(p) && p.length === 2 && p.every(n => range(n, 0, 1))) && validQuad(s.sourceCorners))) &&
    (s.roughness === undefined || range(s.roughness, .02, 1)) && (s.reflection === undefined || range(s.reflection, 0, 1))
}
export function localCorners(s: StickerState): [number, number][] {
  return ([[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]] as [number, number][]).map((p, i) => [p[0] + (s.corners?.[i]?.[0] || 0), p[1] + (s.corners?.[i]?.[1] || 0)])
}
export function validQuad(p: [number, number][]) {
  return p.every((a, i) => { const b = p[(i + 1) % 4], c = p[(i + 2) % 4]; return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) > .0001 })
}
export function imagePlacement(s: StickerState, t: StickerTemplate, width: number, height: number) {
  const cropped = sourceDimensions(s, width, height)
  width = cropped[0]; height = cropped[1]
  const fit = Math.max(t.width / width, t.height / height)
  return { x: t.width / 2 + s.x, y: t.height / 2 + s.y, width: width * fit * s.zoom * s.scaleX, height: height * fit * s.zoom * s.scaleY }
}
export function sourceDimensions(s: StickerState, width: number, height: number): [number, number] {
  if (!s.sourceCorners) return [width, height]
  const p = s.sourceCorners.map(([x, y]) => [x * width, y * height])
  const length = (a: number, b: number) => Math.hypot(p[a][0] - p[b][0], p[a][1] - p[b][1])
  return [(length(0, 1) + length(3, 2)) / 2, (length(0, 3) + length(1, 2)) / 2]
}
export function artworkCorners(s: StickerState, t: StickerTemplate, width: number, height: number): [number, number][] {
  const p = imagePlacement(s, t, width, height), r = s.rotation * Math.PI / 180
  return localCorners(s).map(([x, y]) => [p.x + x * p.width * Math.cos(r) - y * p.height * Math.sin(r), p.y + x * p.width * Math.sin(r) + y * p.height * Math.cos(r)])
}
// Unit square -> arbitrary convex quad, a projective homography (not bilinear
// interpolation). The same mapping drives the crop preview and exported texture.
export function projectiveMap(quad: [number, number][]) {
  if (!validQuad(quad)) throw new Error('四个角不能交叉或重叠')
  const [p0, p1, p2, p3] = quad
  const dx1 = p1[0] - p2[0], dx2 = p3[0] - p2[0], dy1 = p1[1] - p2[1], dy2 = p3[1] - p2[1]
  const dx3 = p0[0] - p1[0] + p2[0] - p3[0], dy3 = p0[1] - p1[1] + p2[1] - p3[1]
  const determinant = dx1 * dy2 - dx2 * dy1
  const g = Math.abs(dx3) + Math.abs(dy3) < 1e-12 ? 0 : (dx3 * dy2 - dx2 * dy3) / determinant
  const h = Math.abs(dx3) + Math.abs(dy3) < 1e-12 ? 0 : (dx1 * dy3 - dx3 * dy1) / determinant
  const a = p1[0] - p0[0] + g * p1[0], b = p3[0] - p0[0] + h * p3[0]
  const d = p1[1] - p0[1] + g * p1[1], e = p3[1] - p0[1] + h * p3[1]
  return (u: number, v: number): [number, number] => {
    const denominator = g * u + h * v + 1
    return [(a * u + b * v + p0[0]) / denominator, (d * u + e * v + p0[1]) / denominator]
  }
}
export function paintSticker(ctx: CanvasRenderingContext2D, img: HTMLImageElement, s: StickerState, t: StickerTemplate, resolution = 24) {
  const width = img.naturalWidth, height = img.naturalHeight, quad = artworkCorners(s, t, width, height)
  ctx.fillStyle = s.background; ctx.fillRect(0, 0, t.width, t.height)
  const crop = s.sourceCorners
  const rectangular = !crop || (Math.abs(crop[0][1] - crop[1][1]) < 1e-8 && Math.abs(crop[1][0] - crop[2][0]) < 1e-8 && Math.abs(crop[2][1] - crop[3][1]) < 1e-8 && Math.abs(crop[3][0] - crop[0][0]) < 1e-8)
  if (rectangular && !s.corners?.some(p => p[0] || p[1])) {
    const p = imagePlacement(s, t, width, height)
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(s.rotation * Math.PI / 180)
    if (crop) ctx.drawImage(img, crop[0][0] * width, crop[0][1] * height, (crop[1][0] - crop[0][0]) * width, (crop[3][1] - crop[0][1]) * height, -p.width / 2, -p.height / 2, p.width, p.height)
    else ctx.drawImage(img, -p.width / 2, -p.height / 2, p.width, p.height)
    ctx.restore(); return
  }
  const project = projectiveMap(quad)
  const source = s.sourceCorners ? projectiveMap(s.sourceCorners.map(([x, y]) => [x * width, y * height])) : (u: number, v: number) => [u * width, v * height]
  function triangle(uv: [number, number][]) {
    const src = uv.map(([u, v]) => source(u, v)), dst = uv.map(([u, v]) => project(u, v))
    const [a, b, c] = src, [p, q, r] = dst
    const det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
    const aa = ((q[0] - p[0]) * (c[1] - a[1]) - (r[0] - p[0]) * (b[1] - a[1])) / det
    const cc = ((r[0] - p[0]) * (b[0] - a[0]) - (q[0] - p[0]) * (c[0] - a[0])) / det
    const bb = ((q[1] - p[1]) * (c[1] - a[1]) - (r[1] - p[1]) * (b[1] - a[1])) / det
    const dd = ((r[1] - p[1]) * (b[0] - a[0]) - (q[1] - p[1]) * (c[0] - a[0])) / det
    ctx.save(); ctx.beginPath()
    // A subpixel overlap prevents hairline cracks between canvas clip triangles.
    const center = [(p[0] + q[0] + r[0]) / 3, (p[1] + q[1] + r[1]) / 3]
    dst.forEach((v, i) => { const length = Math.hypot(v[0] - center[0], v[1] - center[1]); const f = 1 + .015 / length; const x = center[0] + (v[0] - center[0]) * f, y = center[1] + (v[1] - center[1]) * f; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) })
    ctx.closePath(); ctx.clip(); ctx.transform(aa, bb, cc, dd, p[0] - aa * a[0] - cc * a[1], p[1] - bb * a[0] - dd * a[1]); ctx.drawImage(img, 0, 0); ctx.restore()
  }
  for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
    const u = x / resolution, v = y / resolution, u1 = (x + 1) / resolution, v1 = (y + 1) / resolution
    triangle([[u, v], [u1, v], [u1, v1]]); triangle([[u, v], [u1, v1], [u, v1]])
  }
}
export function loadStickerImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('无法读取这张图片，请选择 SVG、PNG、JPG 或 WebP'))
    img.src = src
  })
}
export async function renderSticker(s: StickerState, t: StickerTemplate): Promise<Uint8Array> {
  if (!validateSticker(s, t)) throw new Error('贴纸参数无效')
  const img = await loadStickerImage(s.image)
  const canvas = document.createElement('canvas')
  canvas.height = 2048; canvas.width = Math.round(canvas.height * t.width / t.height)
  const ctx = canvas.getContext('2d')!
  ctx.scale(canvas.width / t.width, canvas.height / t.height)
  paintSticker(ctx, img, s, t, 48)
  // Guides and hole overlays are deliberately absent. Holes are solid geometry.
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('贴纸生成失败')), 'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}

export function readGlb(buffer: ArrayBuffer) {
  const view = new DataView(buffer)
  if (view.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength) throw new Error('GLB 文件无效')
  let json: any, binary = new Uint8Array()
  for (let offset = 12; offset + 8 <= buffer.byteLength;) {
    const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true)
    offset += 8
    if (offset + length > buffer.byteLength) throw new Error('GLB 数据不完整')
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, offset, length)))
    if (type === 0x004e4942) binary = new Uint8Array(buffer, offset, length)
    offset += length
  }
  if (!json || !binary.length || json.buffers?.length !== 1 || json.buffers[0].uri) throw new Error('仅支持内嵌数据的 GLB')
  return { json, binary }
}
export function attachSticker(buffer: ArrayBuffer, t: StickerTemplate, s: StickerState, png: Uint8Array): Blob {
  if (!validateSticker(s, t)) throw new Error('贴纸参数与模板不匹配')
  const { json, binary } = readGlb(buffer)
  const chunks: Uint8Array[] = [binary]; let size = binary.byteLength
  function append(bytes: Uint8Array, target?: number) {
    const pad = (4 - size % 4) % 4
    if (pad) { chunks.push(new Uint8Array(pad)); size += pad }
    const i = json.bufferViews.push({ buffer: 0, byteOffset: size, byteLength: bytes.byteLength, ...(target ? { target } : {}) }) - 1
    chunks.push(bytes); size += bytes.byteLength; return i
  }
  const shape = new Shape()
  shape.moveTo(0, 0); shape.lineTo(t.width, 0); shape.lineTo(t.width, t.height); shape.lineTo(0, t.height); shape.closePath()
  for (const hole of t.openings) {
    const y = t.height - hole.y - hole.height, path = new Path()
    path.moveTo(hole.x, y); path.lineTo(hole.x, y + hole.height); path.lineTo(hole.x + hole.width, y + hole.height); path.lineTo(hole.x + hole.width, y); path.closePath()
    shape.holes.push(path)
  }
  const geometry = new ExtrudeGeometry(shape, { depth: s.thickness, bevelEnabled: false, steps: 1 })
  const pos = geometry.getAttribute('position'), normal = geometry.getAttribute('normal')
  const front = { p: [] as number[], n: [] as number[], uv: [] as number[] }, edge = { p: [] as number[], n: [] as number[], uv: [] as number[] }
  for (let i = 0; i < pos.count; i++) {
    const target = normal.getZ(i) > .99 ? front : edge
    target.p.push((t.left + pos.getX(i)) / 1000, (t.top - t.height + pos.getY(i)) / 1000, (t.back + pos.getZ(i)) / 1000)
    target.n.push(normal.getX(i), normal.getY(i), normal.getZ(i))
    target.uv.push(pos.getX(i) / t.width, 1 - pos.getY(i) / t.height)
  }
  geometry.dispose()
  function attribute(values: number[], width: number) {
    const data = new Float32Array(values), accessor: any = { bufferView: append(new Uint8Array(data.buffer), 34962), componentType: 5126, count: data.length / width, type: width === 3 ? 'VEC3' : 'VEC2' }
    if (width === 3) {
      accessor.min = [Infinity, Infinity, Infinity]; accessor.max = [-Infinity, -Infinity, -Infinity]
      data.forEach((v, i) => { accessor.min[i % 3] = Math.min(accessor.min[i % 3], v); accessor.max[i % 3] = Math.max(accessor.max[i % 3], v) })
    }
    return json.accessors.push(accessor) - 1
  }
  json.images ||= []; json.textures ||= []; json.samplers ||= []
  const image = json.images.push({ bufferView: append(png), mimeType: 'image/png', name: s.filename }) - 1
  const sampler = json.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }) - 1
  const texture = json.textures.push({ source: image, sampler }) - 1
  const faceMaterial = json.materials.push({ name: '贴纸 · 印刷面', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], baseColorTexture: { index: texture }, metallicFactor: 0, roughnessFactor: s.roughness ?? .7 }, extensions: { KHR_materials_specular: { specularFactor: s.reflection ?? .3 } }, alphaMode: 'OPAQUE' }) - 1
  json.extensionsUsed = [...new Set([...(json.extensionsUsed || []), 'KHR_materials_specular'])]
  const color = s.background.match(/\w\w/g)!.map(v => { const c = parseInt(v, 16) / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4 })
  const edgeMaterial = json.materials.push({ name: '贴纸 · 实体切边', pbrMetallicRoughness: { baseColorFactor: [...color, 1], metallicFactor: 0, roughnessFactor: .68 } }) - 1
  const mesh = json.meshes.push({ name: t.title, primitives: [front, edge].map((data, i) => ({ attributes: { POSITION: attribute(data.p, 3), NORMAL: attribute(data.n, 3), TEXCOORD_0: attribute(data.uv, 2) }, material: i === 0 ? faceMaterial : edgeMaterial })) }) - 1
  const node = json.nodes.push({ name: `${t.title} · ${s.thickness} mm`, mesh, extras: { stickerTemplate: t.id, thicknessMm: s.thickness } }) - 1
  json.scenes[json.scene || 0].nodes.push(node)
  json.buffers = [{ byteLength: size }]
  const text = new TextEncoder().encode(JSON.stringify(json)), paddedText = Math.ceil(text.length / 4) * 4, paddedBin = Math.ceil(size / 4) * 4
  const result = new Uint8Array(28 + paddedText + paddedBin), header = new DataView(result.buffer)
  header.setUint32(0, 0x46546c67, true); header.setUint32(4, 2, true); header.setUint32(8, result.length, true)
  header.setUint32(12, paddedText, true); header.setUint32(16, 0x4e4f534a, true)
  result.fill(32, 20, 20 + paddedText); result.set(text, 20)
  header.setUint32(20 + paddedText, paddedBin, true); header.setUint32(24 + paddedText, 0x004e4942, true)
  let offset = 28 + paddedText
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length }
  return new Blob([result], { type: 'model/gltf-binary' })
}

// Images can exceed localStorage's quota, so store each model's artwork separately.
export async function stickerStorage(key: string, value?: StickerState | null): Promise<StickerState | null> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('xm-model-lab-artwork', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('stickers')
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
  })
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('stickers', value === undefined ? 'readonly' : 'readwrite'), store = tx.objectStore('stickers')
      const request = value === undefined ? store.get(key) : value === null ? store.delete(key) : store.put(JSON.parse(JSON.stringify(value)), key)
      tx.oncomplete = () => resolve(value === undefined ? request.result || null : value)
      tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}
