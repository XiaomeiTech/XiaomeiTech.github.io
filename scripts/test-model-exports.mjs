// Geometry/export regression checks. Run with Node 24: node scripts/test-model-exports.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { attachSticker, artworkCorners, localCorners, newSticker, projectiveMap, readGlb, slaveStickerTemplate, validQuad, validateSticker } from '../docs/.vitepress/theme/components/modelSticker.ts'

const buffer = file => { const b = fs.readFileSync(file); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }
function accessor(glb, index) {
  const { json: j, binary: bin } = glb, a = j.accessors[index], v = j.bufferViews[a.bufferView], view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength)
  const width = { VEC2: 2, VEC3: 3, SCALAR: 1 }[a.type], size = { 5123: 2, 5125: 4, 5126: 4 }[a.componentType]
  return Array.from({ length: a.count }, (_, i) => Array.from({ length: width }, (_, c) => {
    const offset = (v.byteOffset || 0) + (a.byteOffset || 0) + i * (v.byteStride || width * size) + c * size
    return a.componentType === 5126 ? view.getFloat32(offset, true) : a.componentType === 5125 ? view.getUint32(offset, true) : view.getUint16(offset, true)
  }))
}
const png = fs.readFileSync('markdown/public/models/panels/im2620-ec.png')
for (const count of [1, 2]) {
  const template = slaveStickerTemplate(count), state = newSticker(template)
  state.image = `data:image/png;base64,${png.toString('base64')}`
  const source = buffer(`markdown/public/models/io-slave-green-${count}.glb`), original = readGlb(source)
  const result = readGlb(await attachSticker(source, template, state, png).arrayBuffer())
  assert.deepEqual(result.json.meshes.slice(0, -1), original.json.meshes, 'Do not change approved model geometry')
  assert.equal(result.json.materials.at(-2).extensions.KHR_materials_specular.specularFactor, .3)
  assert.equal(result.json.materials.at(-2).pbrMetallicRoughness.roughnessFactor, .7)
  const mesh = result.json.meshes.at(-1), faces = accessor(result, mesh.primitives[0].attributes.POSITION)
  let area = 0
  for (let i = 0; i < faces.length; i += 3) {
    const [a, b, c] = faces.slice(i, i + 3).map(p => p.map(n => n * 1000))
    area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2
    for (const p of [a, b, c]) assert(Math.abs(p[2] - (template.back + .35)) < .00002)
  }
  const expected = template.width * template.height - template.openings.reduce((a, h) => a + h.width * h.height, 0)
  assert(Math.abs(area - expected) < .01, 'Film surface must exclude exactly the connector openings')
  const edges = new Map()
  for (const primitive of mesh.primitives) {
    const pos = accessor(result, primitive.attributes.POSITION)
    for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) {
      const a = pos[i + k].map(n => n.toFixed(7)).join(','), b = pos[i + (k + 1) % 3].map(n => n.toFixed(7)).join(',')
      const key = [a, b].sort().join('|'); edges.set(key, (edges.get(key) || 0) + 1)
    }
  }
  assert([...edges.values()].every(n => n === 2), 'Film must be a closed solid, including aperture walls')
  const before = artworkCorners(state, template, 500, 1000)
  state.corners[0] = [.1, .05]
  const after = artworkCorners(state, template, 500, 1000)
  assert.notDeepEqual(before[0], after[0]); assert.deepEqual(before.slice(1), after.slice(1), 'Four-point adjustment must keep other corners fixed')
  const project = projectiveMap(after)
  for (const [i, uv] of [[0, [0, 0]], [1, [1, 0]], [2, [1, 1]], [3, [0, 1]]]) {
    const p = project(...uv); assert(Math.hypot(p[0] - after[i][0], p[1] - after[i][1]) < 1e-9)
  }
  state.sourceCorners = [[.1, .1], [.8, .15], [.9, .9], [.05, .8]]
  assert(validateSticker(state, template)); state.corners[0] = [2, 2]
  assert(!validQuad(localCorners(state))); assert(!validateSticker(state, template))
  console.log(`PASS ${count}-connector solid film, holes, thickness and independent corner projection`)
}
