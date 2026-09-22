// Usage: node scripts/build-io-models.mjs <slave-compatible.glb> <master-compatible.glb>
// Compatible (decoded, no Draco) SolidWorks exports are the immutable inputs.
// Material boundaries below are in metres in this specific assembly's CAD coordinates.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(root, 'markdown/public/models')
if (process.argv.length < 4) throw new Error('Supply the slave and master compatible GLB paths')

function readGLB(filename) {
  const bytes = fs.readFileSync(filename), length = bytes.readUInt32LE(12)
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF')
  assert.equal(bytes.readUInt32LE(4), 2)
  assert.equal(bytes.readUInt32LE(8), bytes.length)
  const json = JSON.parse(bytes.subarray(20, 20 + length))
  assert(!json.extensionsRequired?.includes('KHR_draco_mesh_compression'), 'Decode Draco before building')
  const bin = bytes.subarray(28 + length, 28 + length + json.buffers[0].byteLength)
  function accessor(index) {
    const a = json.accessors[index], view = json.bufferViews[a.bufferView]
    const width = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type]
    const size = { 5123: 2, 5125: 4, 5126: 4 }[a.componentType]
    assert(width && size, 'Unsupported accessor')
    return Array.from({ length: a.count }, (_, row) => Array.from({ length: width }, (_, col) => {
      const offset = (view.byteOffset || 0) + (a.byteOffset || 0) + row * (view.byteStride || width * size) + col * size
      return a.componentType === 5126 ? bin.readFloatLE(offset) : a.componentType === 5125 ? bin.readUInt32LE(offset) : bin.readUInt16LE(offset)
    }))
  }
  return { json, bin, accessor }
}
const reference = readGLB(path.join(output, 'im2620c-ec-panel.glb'))
const housing = structuredClone(reference.json.materials[0])
housing.name = '外壳 · 冷灰细纹注塑'
const normalSource = reference.json.textures[housing.normalTexture.index]
const normalImage = reference.json.images[normalSource.source]
const normalView = reference.json.bufferViews[normalImage.bufferView]
const grain = reference.bin.subarray(normalView.byteOffset, normalView.byteOffset + normalView.byteLength)
housing.normalTexture.index = 0

function material(name, hex, metallic, roughness) {
  const color = hex.match(/[a-f\d]{2}/gi).map(c => {
    const s = parseInt(c, 16) / 255
    return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4
  })
  return { name, pbrMetallicRoughness: { baseColorFactor: [...color, 1], metallicFactor: metallic, roughnessFactor: roughness } }
}
function triangles(source) {
  const result = []
  for (const p of source.json.meshes[0].primitives) {
    const positions = source.accessor(p.attributes.POSITION), normals = source.accessor(p.attributes.NORMAL)
    const uv = source.accessor(p.attributes.TEXCOORD_0), indices = source.accessor(p.indices).flat()
    for (let i = 0; i < indices.length; i += 3) result.push({
      material: p.material,
      vertices: indices.slice(i, i + 3).map(index => ({ p: positions[index], n: normals[index], uv: uv[index] }))
    })
  }
  return result
}
function bounds(vertices) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (const { p } of vertices) for (let axis = 0; axis < 3; axis++) {
    min[axis] = Math.min(min[axis], p[axis]); max[axis] = Math.max(max[axis], p[axis])
  }
  return { min, max }
}
function housingUV({ p, n }) {
  const abs = n.map(Math.abs), axis = abs.indexOf(Math.max(...abs))
  return (axis === 0 ? [p[2], p[1]] : axis === 1 ? [p[0], p[2]] : [p[0], p[1]]).map(v => v / .02)
}
function buildGLB(filename, sourceTriangles, materials, extras, rotation) {
  const json = {
    asset: { version: '2.0', generator: 'XiaomeiTech IO material builder' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: extras.label, mesh: 0, ...(rotation ? { rotation } : {}) }],
    meshes: [{ name: extras.label, primitives: [] }], materials: structuredClone(materials),
    accessors: [], bufferViews: [], buffers: [],
    images: [], textures: [{ source: 0, sampler: 0 }],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }], extras
  }
  const extensions = [...new Set(materials.flatMap(m => Object.keys(m.extensions || {})))]
  if (extensions.length) json.extensionsUsed = extensions
  const chunks = []; let byteLength = 0
  function append(data, target) {
    const padding = (4 - byteLength % 4) % 4
    chunks.push(Buffer.alloc(padding)); byteLength += padding
    const index = json.bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: data.length, ...(target ? { target } : {}) }) - 1
    chunks.push(data); byteLength += data.length
    return index
  }
  function attribute(values, width, type, componentType = 5126) {
    const array = componentType === 5126 ? new Float32Array(values) : new Uint32Array(values)
    const accessor = { bufferView: append(Buffer.from(array.buffer), componentType === 5126 ? 34962 : 34963), componentType, count: values.length / width, type }
    if (type === 'VEC3') {
      accessor.min = [Infinity, Infinity, Infinity]; accessor.max = [-Infinity, -Infinity, -Infinity]
      for (let i = 0; i < array.length; i++) {
        assert(Number.isFinite(array[i]))
        accessor.min[i % 3] = Math.min(accessor.min[i % 3], array[i]); accessor.max[i % 3] = Math.max(accessor.max[i % 3], array[i])
      }
    }
    return json.accessors.push(accessor) - 1
  }
  const counts = []
  for (let m = 0; m < materials.length; m++) {
    const selected = sourceTriangles.filter(t => t.material === m)
    assert(selected.length, `Empty material: ${materials[m].name}`)
    const positions = [], normals = [], uv = [], indices = [], unique = new Map()
    for (const t of selected) for (const vertex of t.vertices) {
      const coords = materials[m].normalTexture ? housingUV(vertex) : vertex.uv
      const key = [...vertex.p, ...vertex.n, ...coords].join(',')
      if (!unique.has(key)) {
        unique.set(key, positions.length / 3)
        positions.push(...vertex.p); normals.push(...vertex.n); uv.push(...coords)
      }
      indices.push(unique.get(key))
    }
    const attributes = { POSITION: attribute(positions, 3, 'VEC3'), NORMAL: attribute(normals, 3, 'VEC3'), TEXCOORD_0: attribute(uv, 2, 'VEC2') }
    json.meshes[0].primitives.push({ attributes, indices: attribute(indices, 1, 'SCALAR', 5125), material: m })
    counts.push({ material: materials[m].name, triangles: selected.length })
  }
  json.images.push({ bufferView: append(grain), mimeType: 'image/png', name: 'Moulded housing micro-normal' })
  json.buffers.push({ byteLength })
  const text = Buffer.from(JSON.stringify(json)), jsonChunk = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 32)])
  const bin = Buffer.concat([...chunks, Buffer.alloc((4 - byteLength % 4) % 4)])
  const header = Buffer.alloc(20), binHeader = Buffer.alloc(8)
  header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jsonChunk.length + bin.length, 8)
  header.writeUInt32LE(jsonChunk.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
  binHeader.writeUInt32LE(bin.length); binHeader.writeUInt32LE(0x004e4942, 4)
  const data = Buffer.concat([header, jsonChunk, binHeader, bin])
  fs.writeFileSync(path.join(output, filename), data)
  return { filename, bytes: data.length, triangles: sourceTriangles.length, materials: counts }
}

const slave = triangles(readGLB(process.argv[2]))
assert.equal(slave.length, 80404, 'Geometry changed; review the assembly-specific material regions')
// Weld only to identify the two large shell surfaces, which overlap the connector
// base in projection. Never remove/recolour those faces with a connector box.
const parents = slave.map((_, i) => i), points = new Map()
function find(i) { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i] } return i }
slave.forEach((t, i) => t.vertices.forEach(({ p }) => {
  const key = p.map(v => Math.round(v / .000001)).join(',')
  if (points.has(key)) parents[find(i)] = find(points.get(key))
  else points.set(key, i)
}))
const groups = new Map()
slave.forEach((t, i) => { const id = find(i); if (!groups.has(id)) groups.set(id, []); groups.get(id).push(t) })
for (const group of groups.values()) {
  const b = bounds(group.flatMap(t => t.vertices))
  const isShell = b.min[2] < .001 && b.max[2] > .071 && b.max[1] - b.min[1] > .1
  group.forEach(t => t.shell = isShell)
}
let goldTriangles = 0, insulatorTriangles = 0
for (const t of slave) {
  const { min, max } = bounds(t.vertices)
  const x = (min[0] + max[0]) / 2, y = (min[1] + max[1]) / 2, z = (min[2] + max[2]) / 2
  t.material = 0
  // Only the two curved spring leaves in each cell are gold. The straight
  // shelves, rounded separator bars and recessed carrier are black plastic.
  if (min[0] >= -.00751 && min[2] >= .01053 && max[2] <= .01707 && min[1] >= .02463 && max[1] <= .05116) {
    t.material = 2
    const curvedCell = Array.from({ length: 8 }, (_, i) => .026893 + i * .00315)
      .some(center => min[1] >= center - .00120 && max[1] <= center + .00120)
    if (max[0] > -.00649 && max[0] < -.00503 && min[2] >= .01134 && max[2] <= .01622 && curvedCell) t.material = 1
  }
  // Eight 0.4 mm-thick contact tabs. Their side faces continue behind the shell
  // to the PCB at X=-29.143 mm, so selecting only shell-exterior vertices would
  // omit entire side walls. Do not plate the wider moulded apertures around them.
  const tabCell = Array.from({ length: 8 }, (_, i) => .026893 + i * .00315)
    .some(center => min[1] >= center - .00022 && max[1] <= center + .00022)
  if (max[0] < -.02913 && min[0] < -.03080 && min[2] >= .01201 && max[2] <= .01555 && tabCell) t.material = 1
  if (t.material === 1) goldTriangles++
  if (t.material === 2) insulatorTriangles++
  const connector = !t.shell && min[2] >= .06999 && min[0] > -.0266 && max[0] < -.012 &&
    ((min[1] > .0175 && max[1] < .0475) || (min[1] > -.0376 && max[1] < -.0048))
  if (connector) {
    t.upper = y > 0
    t.material = 3
    const middleX = t.upper ? -.018823 : -.019612
    const faceZ = t.upper ? .08540 : .08551
    // Use the actual 1.7 × 2.9 mm button footprints, not the whole outer banks:
    // the finely ribbed fixed rails alongside each button belong to the housing.
    const buttonCentersX = t.upper ? [-.023473, -.014173] : [-.024262, -.014962]
    const firstRow = t.upper ? .020357 : -.035355
    const rows = t.upper ? 8 : 9
    const withinButton = buttonCentersX.some(center => min[0] >= center - .00088 && max[0] <= center + .00088) &&
      Array.from({ length: rows }, (_, i) => firstRow + i * .0035)
        .some(center => min[1] >= center - .00150 && max[1] <= center + .00150)
    if (min[2] >= faceZ && withinButton) t.material = 4
    // Tin-plated wire clamps are recessed inside the circular wire entries.
    if (z < .0835 && z > .0819 && Math.abs(x - middleX) < .0035) t.material = 5
  }
}
assert(goldTriangles > 200 && insulatorTriangles > 20, 'Missing side contact or insulation surfaces')
const upper = slave.filter(t => t.upper)
assert(upper.length > 20000 && upper.length < 45000, 'Unexpected upper connector geometry')
const report = []
for (const color of ['green', 'black']) for (const count of [1, 2]) {
  const materials = [
    housing,
    material('侧面总线 · 镀金触点', '#cbb77b', .92, .24),
    material('侧面总线 · 黑色背板与隔栏', '#060708', 0, .82),
    material('前端连接器 · 注塑壳体', color === 'green' ? '#439c4d' : '#202124', 0, .56),
    material('前端连接器 · 橙色按钮', '#ee922b', 0, .5),
    material('前端连接器 · 镀锡夹片', '#b9bdc2', .86, .3)
  ]
  // A low-gloss black carrier should remain black under the neutral studio's
  // broad frontal light, rather than reflecting a grey rectangle behind the gold.
  materials[2].extensions = { KHR_materials_specular: { specularFactor: .12 } }
  const model = count === 1 ? slave.filter(t => !t.upper) : slave
  const filename = `io-slave-${color}-${count}.glb`
  report.push(buildGLB(filename, model, materials, {
    label: `从模块 · ${color === 'green' ? '绿色' : '黑色'} · ${count === 1 ? '单' : '双'}连接器`,
    connectorColor: color, connectorCount: count, lowerPins: 18, upperPins: count === 2 ? 16 : 0,
    removedTriangles: slave.length - model.length, housingReference: 'im2620c-ec-panel.glb'
  }))
}

// Add the main assembly as a separate workbench model. Its shell uses the same
// injected-plastic finish; retain the other source material divisions for tuning.
const master = readGLB(process.argv[3]), mainTriangles = triangles(master)
const mainMaterials = master.json.materials.slice(1).map((m, index) => {
  if (index === 3) return structuredClone(housing)
  const copy = structuredClone(m)
  copy.name = ['接口 · 深色塑料', '绿色指示灯', '黄色指示灯', '', '接口接触片', '内部结构件', '接口 · 金属件'][index]
  return copy
})
mainTriangles.forEach(t => t.material--)
report.push(buildGLB('io-master-compatible.glb', mainTriangles, mainMaterials, { label: '主模块 · SolidWorks 装配体', housingReference: 'im2620c-ec-panel.glb' }, [0, 0, Math.SQRT1_2, Math.SQRT1_2]))
fs.writeFileSync(path.join(output, 'io-model-build-report.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report.map(({ materials, ...r }) => r), null, 2))
