// Build the IM2620 EC faceplate using housing bounds and connector clearances.
// Usage: node scripts/build-model-panel.mjs <path-to-sharp-package>
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { Shape, Path, ExtrudeGeometry } from 'three'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
const sharp = require(process.argv[2] || 'sharp')
const modelDir = path.join(root, 'markdown/public/models')
const panelDir = path.join(modelDir, 'panels')
fs.mkdirSync(panelDir, { recursive: true })
const input = fs.readFileSync(path.join(modelDir, 'im2620c-ec.glb'))
const jsonLength = input.readUInt32LE(12)
const gltf = JSON.parse(input.subarray(20, 20 + jsonLength).toString())
const binary = input.subarray(28 + jsonLength, 28 + jsonLength + gltf.buffers[0].byteLength)

function readAccessor(index) {
  const a = gltf.accessors[index]
  const v = gltf.bufferViews[a.bufferView]
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type]
  const bytes = { 5123: 2, 5126: 4 }[a.componentType]
  if (!components || !bytes) throw new Error('Unsupported accessor')
  return Array.from({ length: a.count }, (_, row) => Array.from({ length: components }, (_, col) => {
    const offset = (v.byteOffset || 0) + (a.byteOffset || 0) + row * (v.byteStride || components * bytes) + col * bytes
    return a.componentType === 5126 ? binary.readFloatLE(offset) : binary.readUInt16LE(offset)
  }))
}

const housing = gltf.meshes[0].primitives.find(p => p.material === 0)
const positions = readAccessor(housing.attributes.POSITION)
const normals = readAccessor(housing.attributes.NORMAL)
const indices = readAccessor(housing.indices).flat()
let front = []
for (let i = 0; i < indices.length; i += 3) {
  const triangle = indices.slice(i, i + 3)
  // The drawing surface is at Y = 61.1 mm. Preserve the real connector holes.
  if (triangle.every(n => normals[n][1] > 0.99 && Math.abs(positions[n][1] - 0.0611) < 0.00001)) {
    front.push(...triangle.map(n => [positions[n][0], positions[n][1] + 0.000045, positions[n][2]]))
  }
}
if (!front.length) throw new Error('No faceplate surface found')
const bounds = {
  min: [0, 1, 2].map(axis => Math.min(...front.map(p => p[axis]))),
  max: [0, 1, 2].map(axis => Math.max(...front.map(p => p[axis])))
}
// A solid 0.35 mm film bridges all moulded recesses. Apertures are actual holes.
const panelBack = 0.06142
const panelThickness = 0.00035
bounds.min[1] = panelBack; bounds.max[1] = panelBack + panelThickness
const panelWidth = bounds.max[2] - bounds.min[2]
const panelHeight = bounds.max[0] - bounds.min[0]
const width = 360
const height = Math.round(width * (bounds.max[0] - bounds.min[0]) / (bounds.max[2] - bounds.min[2]))
const px = x => (x - bounds.min[0]) / (bounds.max[0] - bounds.min[0]) * height
const pz = z => (bounds.max[2] - z) / (bounds.max[2] - bounds.min[2]) * width
const openings = [
  { name: 'power', x0: .00345, x1: .02015, z0: -.00065, z1: .01460, radius: 0 },
  { name: 'usb-right', x0: .04205, x1: .05195, z0: .00005, z1: .00470, radius: .00185 },
  { name: 'ethernet', x0: .06030, x1: .09255, z0: -.00200, z1: .01615, radius: 0 }
]
const shape = new Shape()
shape.moveTo(0, 0); shape.lineTo(panelWidth, 0); shape.lineTo(panelWidth, panelHeight); shape.lineTo(0, panelHeight); shape.closePath()
for (const h of openings) {
  const l = bounds.max[2] - h.z1, r = bounds.max[2] - h.z0
  const bottom = bounds.max[0] - h.x1, top = bounds.max[0] - h.x0, radius = h.radius
  const cut = new Path()
  cut.moveTo(l + radius, bottom)
  cut.lineTo(r - radius, bottom); cut.quadraticCurveTo(r, bottom, r, bottom + radius)
  cut.lineTo(r, top - radius); cut.quadraticCurveTo(r, top, r - radius, top)
  cut.lineTo(l + radius, top); cut.quadraticCurveTo(l, top, l, top - radius)
  cut.lineTo(l, bottom + radius); cut.quadraticCurveTo(l, bottom, l + radius, bottom)
  cut.closePath(); shape.holes.push(cut)
}
for (const u of [75, 114, 153, 192]) {
  const cut = new Path()
  cut.absarc(u / width * panelWidth, bounds.max[0] - .0258, 10 / width * panelWidth, 0, Math.PI * 2, true)
  shape.holes.push(cut)
}
const solid = new ExtrudeGeometry(shape, { depth: panelThickness, bevelEnabled: false, curveSegments: 12, steps: 1 })
const panelPositions = [], panelNormals = [], panelUV = []
for (let i = 0; i < solid.attributes.position.count; i++) {
  const p = solid.attributes.position, n = solid.attributes.normal
  panelPositions.push([bounds.max[0] - p.getY(i), panelBack + p.getZ(i), bounds.max[2] - p.getX(i)])
  panelNormals.push([-n.getY(i), n.getZ(i), -n.getX(i)])
  panelUV.push([p.getX(i) / panelWidth, 1 - p.getY(i) / panelHeight])
}
const hole = (x0, x1, z0, z1, round = 0) => `<rect x="${pz(z1)}" y="${px(x0)}" width="${pz(z0) - pz(z1)}" height="${px(x1) - px(x0)}" rx="${round}" fill="black"/>`
const logo = fs.readFileSync(path.join(root, 'markdown/public/logo/xm-logo-renew.png')).toString('base64')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><mask id="face"><rect width="${width}" height="${height}" fill="white"/>
    ${openings.map(h => hole(h.x0, h.x1, h.z0, h.z1, h.radius / panelWidth * width)).join('')}
    ${[75, 114, 153, 192].map(x => `<circle cx="${x}" cy="${px(.0258)}" r="10" fill="black"/>`).join('')}
  </mask></defs>
  <g mask="url(#face)">
    <rect width="${width}" height="${height}" fill="#35383e"/>
    <rect width="${width}" height="18" fill="#edc89b"/>
    <rect y="${height - 18}" width="${width * .78}" height="18" fill="#edc89b"/>
    <rect x="${width * .8}" y="${height - 18}" width="${width * .2}" height="18" fill="#db302c"/>
    <g fill="#ecebe6" font-family="Arial, sans-serif" font-weight="600">
      <text transform="translate(338 ${px(.017)}) rotate(-90)" font-size="23">N24 P24 PE</text>
      ${['PWR', 'STA', 'RUN', 'ERR'].map((t, i) => `<text transform="translate(${64 + i * 39} ${px(.031)}) rotate(-90)" font-size="23">${t}</text>`).join('')}
      <text x="44" y="${px(.0375)}" font-size="49" font-style="italic">IM2620</text>
      <text x="43" y="${px(.041)}" font-size="24" font-style="italic">EC</text>
      <text transform="translate(${pz(.0003) + 27} ${px(.0505)}) rotate(-90)" font-size="23">USB</text>
      <text transform="translate(338 ${px(.074)}) rotate(-90)" font-size="25">IN</text>
      <text transform="translate(338 ${px(.09)}) rotate(-90)" font-size="25">OUT</text>
    </g>
    <image x="40" y="${px(.043)}" width="132" height="132" href="data:image/png;base64,${logo}"/>
    <text x="44" y="${px(.058)}" fill="#eae9e5" font-family="Arial, sans-serif" font-size="34" font-weight="700">EtherCAT</text>
    <path d="M230 ${px(.055)}h82l-15 -10v6h-67z" fill="#d92c26"/>
    <path d="M230 ${px(.056)}h82v4h-65v6z" fill="#eae9e5"/>
  </g>
</svg>`
fs.writeFileSync(path.join(panelDir, 'im2620-ec.svg'), svg)
const png = await sharp(Buffer.from(svg)).resize({ width: 720 }).png().toBuffer()
fs.writeFileSync(path.join(panelDir, 'im2620-ec.png'), png)

const chunks = [binary]
let byteLength = binary.length
function append(data, target) {
  const padding = (4 - byteLength % 4) % 4
  chunks.push(Buffer.alloc(padding)); byteLength += padding
  const index = gltf.bufferViews.length
  gltf.bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: data.length, ...(target ? { target } : {}) })
  chunks.push(data); byteLength += data.length
  return index
}
function floatAccessor(values, type, extra = {}) {
  const data = Buffer.from(new Float32Array(values.flat()).buffer)
  const index = gltf.accessors.length
  gltf.accessors.push({ bufferView: append(data, 34962), componentType: 5126, count: values.length, type, ...extra })
  return index
}
gltf.images ||= []; gltf.textures ||= []; gltf.samplers ||= []
function linearColor(hex) {
  return [...hex.matchAll(/[0-9a-f]{2}/gi)].map(([channel]) => {
    const c = parseInt(channel, 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }).concat(1)
}
// Photo-matched starting point: cool grey moulded housing, satin metal ports,
// dark connector inserts. This is a visual match, not a measured material scan.
const finishes = [
  ['#606570', 0.05, 0.52], ['#b9bdc2', 0.86, 0.27],
  ['#171a20', 0, 0.57], ['#c79a40', 0.82, 0.28],
  ['#aeb3b9', 0.85, 0.24], ['#24272c', 0, 0.54],
  ['#a9adb2', 0.78, 0.31], ['#1c1f24', 0, 0.61],
  ['#699b35', 0, 0.35], ['#c6b347', 0, 0.36],
  ['#caa74a', 0.78, 0.30], ['#666b74', 0.15, 0.52]
]
finishes.forEach(([color, metallic, roughness], i) => {
  Object.assign(gltf.materials[i].pbrMetallicRoughness, {
    baseColorFactor: linearColor(color), metallicFactor: metallic, roughnessFactor: roughness
  })
})
// A repeatable, subtle micro-normal map adds moulded surface grain.
const size = 128
let seed = 2620
const noise = Float32Array.from({ length: size * size }, () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed / 0xffffffff
})
const pixels = Buffer.alloc(size * size * 3)
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const offset = (y * size + x) * 3
  pixels[offset] = Math.round(128 + 55 * (noise[y * size + (x + 1) % size] - noise[y * size + (x + size - 1) % size]))
  pixels[offset + 1] = Math.round(128 + 55 * (noise[((y + 1) % size) * size + x] - noise[((y + size - 1) % size) * size + x]))
  pixels[offset + 2] = 255
}
const grain = await sharp(pixels, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer()
const grainImage = gltf.images.push({ bufferView: append(grain), mimeType: 'image/png', name: 'Moulded housing micro-normal' }) - 1
const grainSampler = gltf.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }) - 1
const grainTexture = gltf.textures.push({ source: grainImage, sampler: grainSampler }) - 1
gltf.materials[0].normalTexture = { index: grainTexture, scale: 0.22 }
housing.attributes.TEXCOORD_0 = floatAccessor(positions.map((p, i) => {
  const n = normals[i].map(Math.abs)
  const axis = n.indexOf(Math.max(...n))
  return (axis === 0 ? [p[2], p[1]] : axis === 1 ? [p[0], p[2]] : [p[0], p[1]]).map(v => v / 0.02)
}), 'VEC2')
const opaqueArtwork = await sharp(png).flatten({ background: '#35383e' }).png().toBuffer()
const imageIndex = gltf.images.push({ bufferView: append(opaqueArtwork), mimeType: 'image/png', name: 'IM2620 EC faceplate artwork' }) - 1
const samplerIndex = gltf.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }) - 1
const textureIndex = gltf.textures.push({ source: imageIndex, sampler: samplerIndex }) - 1
const materialIndex = gltf.materials.push({
  name: 'IM2620 EC · 前面板印刷',
  pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], baseColorTexture: { index: textureIndex }, metallicFactor: 0, roughnessFactor: 0.72 },
  alphaMode: 'OPAQUE'
}) - 1
const edgeMaterial = gltf.materials.push({ name: 'IM2620 EC · 前面板切边', pbrMetallicRoughness: { baseColorFactor: linearColor('#35383e'), metallicFactor: 0, roughnessFactor: 0.72 }, alphaMode: 'OPAQUE' }) - 1
const primitives = solid.groups.map(group => {
  const from = group.start, to = from + group.count
  const p = panelPositions.slice(from, to)
  return {
    attributes: {
      POSITION: floatAccessor(p, 'VEC3', { min: [0, 1, 2].map(a => Math.min(...p.map(v => v[a]))), max: [0, 1, 2].map(a => Math.max(...p.map(v => v[a]))) }),
      NORMAL: floatAccessor(panelNormals.slice(from, to), 'VEC3'),
      TEXCOORD_0: floatAccessor(panelUV.slice(from, to), 'VEC2')
    }, material: group.materialIndex === 0 ? materialIndex : edgeMaterial
  }
})
const meshIndex = gltf.meshes.push({ name: 'IM2620 EC solid faceplate, 0.35 mm', primitives, extras: { thicknessMm: 0.35, openings: openings.map(h => h.name), ledHoles: 4 } }) - 1
const nodeIndex = gltf.nodes.push({ name: 'IM2620 EC front panel', mesh: meshIndex }) - 1
gltf.scenes[gltf.scene || 0].nodes.push(nodeIndex)
// Present the module upright: power at the top, Ethernet ports at the bottom.
const scene = gltf.scenes[gltf.scene || 0]
const uprightNode = gltf.nodes.push({ name: 'Upright product presentation', rotation: [0.5, -0.5, -0.5, 0.5], children: [...scene.nodes] }) - 1
scene.nodes = [uprightNode]
const padding = (4 - byteLength % 4) % 4
chunks.push(Buffer.alloc(padding)); byteLength += padding
gltf.buffers[0].byteLength = byteLength
let json = Buffer.from(JSON.stringify(gltf))
json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)])
const header = Buffer.alloc(20)
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4)
header.writeUInt32LE(28 + json.length + byteLength, 8)
header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
const binHeader = Buffer.alloc(8)
binHeader.writeUInt32LE(byteLength); binHeader.writeUInt32LE(0x004e4942, 4)
fs.writeFileSync(path.join(modelDir, 'im2620c-ec-panel.glb'), Buffer.concat([header, json, binHeader, ...chunks]))
console.log(JSON.stringify({ triangles: panelPositions.length / 3, thicknessMm: panelThickness * 1000, bounds, texture: [width * 2, height * 2], model: 'im2620c-ec-panel.glb' }, null, 2))
