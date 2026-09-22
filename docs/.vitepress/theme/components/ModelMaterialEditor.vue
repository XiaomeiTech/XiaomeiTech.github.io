<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { withBase } from 'vitepress'
import type { ModelViewerElement } from '@google/model-viewer'
import type { ModelLabProfile } from './modelLabProfiles'
import ModelStickerEditor from './ModelStickerEditor.vue'
import { attachSticker, renderSticker, slaveStickerTemplate, stickerStorage, validateSticker, type StickerState } from './modelSticker'

type Mode = 'day' | 'night'
type MaterialState = { name: string; color: number[]; metallic: number; roughness: number }
type LightState = { exposure: number; environment: string; tone: string; shadow: number; softness: number; background: string }
const props = defineProps<{ profile: ModelLabProfile }>()
// The parent keys this editor by profile so loads, cameras and settings cannot
// leak into another model while either preview is still loading.
const modelPath = props.profile.path
const modelSource = props.profile.revision ? `${modelPath}?v=${props.profile.revision}` : modelPath
const previewSource = ref(withBase(modelSource))
const stickerTemplate = props.profile.connectorCount ? slaveStickerTemplate(props.profile.connectorCount) : null
const sticker = ref<StickerState | null>(null)
const stickerOpen = ref(false), stickerBusy = ref(false), stickerError = ref('')
let modelBuffer: ArrayBuffer | undefined, modelUrl: string | undefined, disposed = false
let stickerRestored = false
const savedCameras: Partial<Record<Mode, { orbit: string; target: string; fov: string }>> = {}
const storageKey = props.profile.storageKey
const modes: { id: Mode; title: string; caption: string }[] = [
  { id: 'day', title: '白天模式', caption: '浅色页面' },
  { id: 'night', title: '黑夜模式', caption: '深色页面' }
]
const defaults = (): Record<Mode, LightState> => ({
  day: { exposure: 1, environment: 'neutral', tone: 'neutral', shadow: 0.8, softness: 1, background: '#ffffff' },
  night: { exposure: 1, environment: 'neutral', tone: 'neutral', shadow: 0.65, softness: 1, background: '#1b1b1f' }
})
const lighting = reactive(defaults())
const materials = ref<MaterialState[]>([])
const selected = ref(0)
const activeMaterial = computed(() => materials.value[selected.value])
const panelEnabled = ref(true)
const ready = reactive({ day: false, night: false })
const errors = reactive({ day: '', night: '' })
const status = ref('正在加载模型…')
const exporting = ref(false)
const fileInput = ref<HTMLInputElement>()
const viewers: Partial<Record<Mode, ModelViewerElement>> = {}
let original: MaterialState[] = []
const initialized = ref(false)
let saveTimer: ReturnType<typeof setTimeout> | undefined
let stickerSaveTimer: ReturnType<typeof setTimeout> | undefined
let loadTimer: ReturnType<typeof setTimeout> | undefined
const copy = <T,>(data: T): T => JSON.parse(JSON.stringify(data))
const materialName = (index: number) => props.profile.labels?.[index] || materials.value[index]?.name || `材质 ${index + 1}`

function toHex(color: number[]) {
  return '#' + color.slice(0, 3).map(c => {
    const srgb = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055
    return Math.round(Math.min(1, Math.max(0, srgb)) * 255).toString(16).padStart(2, '0')
  }).join('')
}
function setColor(value: string) {
  if (!activeMaterial.value || !/^#[\da-f]{6}$/i.test(value)) return
  const color = value.slice(1).match(/.{2}/g)!.map(channel => {
    const c = parseInt(channel, 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  activeMaterial.value.color = [...color, activeMaterial.value.color[3] ?? 1]
}
function setViewer(mode: Mode, element: unknown) {
  if (element) viewers[mode] = element as ModelViewerElement
  else delete viewers[mode]
}
function applyMaterials(mode: Mode) {
  const model = viewers[mode]?.model
  if (!ready[mode] || !model) return
  materials.value.forEach((state, index) => {
    const material = model.materials[index]
    if (!material) return
    const color = [...state.color] as [number, number, number, number]
    if (state.name.includes('前面板')) {
      material.setAlphaMode(panelEnabled.value ? 'OPAQUE' : 'MASK')
      if (!panelEnabled.value) color[3] = 0
    }
    material.pbrMetallicRoughness.setBaseColorFactor(color)
    material.pbrMetallicRoughness.setMetallicFactor(state.metallic)
    material.pbrMetallicRoughness.setRoughnessFactor(state.roughness)
  })
  applyStickerFinish(mode)
}
function applyStickerFinish(mode: Mode) {
  if (!sticker.value || !ready[mode]) return
  const material = viewers[mode]?.model?.materials.find(m => m.name === '贴纸 · 印刷面')
  material?.pbrMetallicRoughness.setRoughnessFactor(sticker.value.roughness ?? .7)
  material?.setSpecularFactor(sticker.value.reflection ?? .3)
}
function setStickerFinish(roughness: number, reflection: number) {
  if (sticker.value) { sticker.value.roughness = roughness; sticker.value.reflection = reflection }
}
function configuration() {
  return { version: 1, model: modelPath, panelEnabled: panelEnabled.value, materials: copy(materials.value), lighting: copy(lighting) }
}
function restore(data: ReturnType<typeof configuration>) {
  const bounded = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
  if (data?.version !== 1 || data.model !== modelPath || typeof data.panelEnabled !== 'boolean' || !Array.isArray(data.materials) || data.materials.length !== original.length) throw new Error('配置与此型号不匹配')
  data.materials.forEach((m, i) => {
    if (m.name !== original[i].name || !Array.isArray(m.color) || m.color.length !== 4 || !m.color.every(c => bounded(c, 0, 1)) || !bounded(m.metallic, 0, 1) || !bounded(m.roughness, 0, 1)) throw new Error('材质参数无效')
  })
  modes.forEach(({ id }) => {
    const l = data.lighting?.[id]
    if (!l || !bounded(l.exposure, 0.1, 2.5) || !bounded(l.shadow, 0, 2) || !bounded(l.softness, 0, 1) || !['neutral', 'legacy'].includes(l.environment) || !['neutral', 'aces', 'agx'].includes(l.tone) || !/^#[\da-f]{6}$/i.test(l.background)) throw new Error('光照参数无效')
  })
  materials.value = copy(data.materials)
  panelEnabled.value = data.panelEnabled
  Object.assign(lighting.day, data.lighting.day)
  Object.assign(lighting.night, data.lighting.night)
}
function onLoad(mode: Mode) {
  const model = viewers[mode]?.model
  if (!model) return
  ready[mode] = true
  errors[mode] = ''
  if (!initialized.value) {
    original = model.materials.map(m => ({ name: m.name, color: [...m.pbrMetallicRoughness.baseColorFactor], metallic: m.pbrMetallicRoughness.metallicFactor, roughness: m.pbrMetallicRoughness.roughnessFactor }))
    materials.value = copy(original)
    initialized.value = true
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) restore(JSON.parse(saved))
      status.value = saved ? '已恢复此浏览器上次的调整' : '已载入实物参考材质'
    } catch { status.value = '已载入实物参考材质；旧配置未恢复' }
  }
  applyMaterials(mode)
  const camera = savedCameras[mode]
  if (camera && viewers[mode]) {
    viewers[mode]!.cameraOrbit = camera.orbit; viewers[mode]!.cameraTarget = camera.target; viewers[mode]!.fieldOfView = camera.fov
    viewers[mode]!.jumpCameraToGoal(); delete savedCameras[mode]
  }
  if (!stickerRestored && stickerTemplate) {
    stickerRestored = true
    void stickerStorage(storageKey).then(saved => {
      if (!disposed && saved && validateSticker(saved, stickerTemplate)) return applySticker(saved, false)
    }).catch(() => { if (!disposed) status.value = '贴纸未能从浏览器恢复，可重新导入配置' })
  }
  if (ready.day && ready.night && loadTimer) clearTimeout(loadTimer)
  if (ready.day && ready.night && status.value === '已应用实体贴膜，正在更新日夜预览') status.value = '已应用实体贴膜，日夜预览已同步'
}
function syncCamera(mode: Mode, event: Event) {
  if ((event as CustomEvent).detail?.source !== 'user-interaction') return
  const source = viewers[mode]
  const other = viewers[mode === 'day' ? 'night' : 'day']
  if (!source || !other) return
  const orbit = source.getCameraOrbit()
  const target = source.getCameraTarget()
  other.cameraOrbit = `${orbit.theta}rad ${orbit.phi}rad ${orbit.radius}m`
  other.cameraTarget = `${target.x}m ${target.y}m ${target.z}m`
  other.fieldOfView = `${source.getFieldOfView()}deg`
  other.jumpCameraToGoal()
}
function setView(view: 'front' | 'perspective' | 'contacts' | 'opposite' = 'perspective') {
  const detail = view === 'contacts' ? props.profile.contactsView : view === 'opposite' ? props.profile.oppositeView : undefined
  const orbit = detail?.orbit || { front: '0deg 90deg 105%', perspective: props.profile.orbit, contacts: '90deg 90deg 105%', opposite: '-90deg 90deg 105%' }[view]
  Object.values(viewers).forEach(viewer => {
    viewer.cameraOrbit = orbit
    viewer.cameraTarget = detail?.target || 'auto auto auto'
    viewer.fieldOfView = '30deg'
    viewer.jumpCameraToGoal()
  })
}
function connectorCloseup() {
  const view = props.profile.closeup
  if (!view) return
  Object.values(viewers).forEach(viewer => {
    viewer.cameraOrbit = view.orbit
    viewer.cameraTarget = view.target
    viewer.fieldOfView = '30deg'
    viewer.jumpCameraToGoal()
  })
}
let pointer: { x: number; y: number; id: number } | undefined
function pointerDown(event: PointerEvent) {
  pointer = event.isPrimary ? { x: event.clientX, y: event.clientY, id: event.pointerId } : undefined
}
function pickMaterial(mode: Mode, event: PointerEvent) {
  const start = pointer; pointer = undefined
  if (!start || start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return
  const viewer = viewers[mode]
  const hit = viewer?.materialFromPoint(event.clientX, event.clientY)
  const index = hit ? viewer!.model!.materials.indexOf(hit) : -1
  if (index >= 0 && index < materials.value.length) selected.value = index
  else if (hit?.name.startsWith('贴纸')) status.value = '贴纸的磨砂、亮面与反射强度可在“前面板贴纸”中调整'
}
function resetMaterial() {
  if (original[selected.value]) materials.value[selected.value] = copy(original[selected.value])
}
function resetAll() {
  materials.value = copy(original)
  Object.assign(lighting, defaults())
  panelEnabled.value = true
  selected.value = 0
  setView()
  status.value = '已恢复实物参考预设'
}
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = filename
  document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10000)
}
function exportSettings() {
  download(new Blob([JSON.stringify({ ...configuration(), sticker: sticker.value }, null, 2)], { type: 'application/json' }), `${props.profile.id}-materials.json`)
  status.value = '已导出材质、日夜光照与贴纸配置'
}
async function importSettings(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const data = JSON.parse(await file.text())
    if (data.sticker && (!stickerTemplate || !validateSticker(data.sticker, stickerTemplate))) throw new Error('贴纸与此型号不匹配')
    restore(data)
    if ('sticker' in data && stickerTemplate) await applySticker(data.sticker)
    status.value = '已导入配置'
  }
  catch (error) { status.value = error instanceof Error ? error.message : '无法读取配置文件' }
  input.value = ''
}
async function exportModel() {
  if (!viewers.day || !ready.day || stickerBusy.value || exporting.value) return
  exporting.value = true
  status.value = '正在导出当前模型、材质与贴纸…'
  try {
    await nextTick()
    if (disposed) return
    applyMaterials('day')
    // Export the live scene so edited materials, embedded textures and solid film
    // travel with the model instead of downloading the original source GLB.
    const blob = await viewers.day.exportScene({ binary: true })
    if (disposed) return
    download(blob, `${props.profile.id}-tuned.glb`)
    status.value = '已导出当前 GLB，包含材质、贴图与实体贴纸；日夜光照可通过“导出配置”保存'
  } catch { if (!disposed) status.value = 'GLB 导出失败，请重试' }
  finally { exporting.value = false }
}
async function applySticker(next: StickerState | null, persist = true) {
  if (!stickerTemplate || stickerBusy.value || exporting.value || disposed) return
  stickerBusy.value = true; stickerError.value = ''
  try {
    let blob: Blob | undefined
    if (next) {
      if (!validateSticker(next, stickerTemplate)) throw new Error('贴纸参数无效')
      if (!modelBuffer) {
        const response = await fetch(withBase(modelSource))
        if (!response.ok) throw new Error('模型读取失败，请重试')
        modelBuffer = await response.arrayBuffer()
      }
      const png = await renderSticker(next, stickerTemplate)
      blob = attachSticker(modelBuffer, stickerTemplate, next, png)
    }
    if (disposed) return
    for (const { id } of modes) {
      const viewer = viewers[id]
      if (viewer && ready[id]) {
        const orbit = viewer.getCameraOrbit(), target = viewer.getCameraTarget()
        savedCameras[id] = { orbit: `${orbit.theta}rad ${orbit.phi}rad ${orbit.radius}m`, target: `${target.x}m ${target.y}m ${target.z}m`, fov: `${viewer.getFieldOfView()}deg` }
      }
    }
    const previousUrl = modelUrl
    modelUrl = blob ? URL.createObjectURL(blob) : undefined
    ready.day = false; ready.night = false; errors.day = ''; errors.night = ''
    previewSource.value = modelUrl || withBase(modelSource)
    sticker.value = next ? copy(next) : null
    if (previousUrl) URL.revokeObjectURL(previousUrl)
    stickerOpen.value = false
    status.value = next ? '已应用实体贴膜，正在更新日夜预览' : '已移除贴纸'
    if (persist) {
      try { await stickerStorage(storageKey, next) }
      catch { status.value = '贴纸已应用；浏览器无法保存，请导出配置留存' }
    }
  } catch (e) { stickerError.value = e instanceof Error ? e.message : '贴纸应用失败'; status.value = stickerError.value }
  finally { if (!disposed) stickerBusy.value = false }
}
watch([materials, panelEnabled], () => modes.forEach(({ id }) => applyMaterials(id)), { deep: true })
watch(() => [sticker.value?.roughness, sticker.value?.reflection], () => {
  modes.forEach(({ id }) => applyStickerFinish(id))
  clearTimeout(stickerSaveTimer)
  if (sticker.value) stickerSaveTimer = setTimeout(() => { void stickerStorage(storageKey, sticker.value).catch(() => { status.value = '贴纸材质未能保存，请导出配置留存' }) }, 400)
})
watch([materials, lighting, panelEnabled], () => {
  if (!initialized.value) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(configuration())); status.value = '已自动保存在此浏览器' }
    catch { status.value = '浏览器无法保存，请导出配置留存' }
  }, 400)
}, { deep: true })
onMounted(() => {
  loadTimer = setTimeout(() => modes.forEach(({ id }) => {
    if (!ready[id]) errors[id] = '模型尚未载入，请检查网络后刷新页面。'
  }), 30000)
})
onBeforeUnmount(() => {
  disposed = true
  if (modelUrl) URL.revokeObjectURL(modelUrl)
  clearTimeout(saveTimer); clearTimeout(loadTimer); clearTimeout(stickerSaveTimer)
  if (sticker.value) void stickerStorage(storageKey, sticker.value).catch(() => {})
  if (initialized.value) {
    try { localStorage.setItem(storageKey, JSON.stringify(configuration())) } catch { /* Export remains available when storage is blocked. */ }
  }
})
</script>

<template>
  <main class="material-lab">
    <header class="lab-header">
      <div>
        <a class="back-link" :href="withBase('/pexus/edge/EtherCAT/')">← 返回 EtherCAT 耦合器</a>
        <p class="eyebrow">PEXUS EDGE · MODEL LAB</p>
        <h1>材质与光照工作台</h1>
        <p class="intro">以实物照片为参考，同时观察白天与黑夜效果。</p>
      </div>
      <div class="header-actions">
        <button :disabled="!initialized || stickerBusy || exporting" @click="fileInput?.click()">导入配置</button>
        <button :disabled="!ready.day || stickerBusy" @click="exportSettings">导出配置</button>
        <button class="primary" :disabled="!ready.day || stickerBusy || exporting" @click="exportModel">{{ exporting ? '正在导出 GLB…' : '导出当前 GLB' }}</button>
        <input ref="fileInput" class="file-input" type="file" accept=".json,application/json" aria-label="导入材质配置" @change="importSettings" />
      </div>
    </header>

    <slot name="model-select" />

    <section v-if="profile.cad" class="cad-downloads" aria-label="原始装配模型下载">
      <div><strong>{{ profile.cad === 'slave' ? '从模块' : '主模块' }} · 原始装配模型</strong><p>用于客户装配，直接下载原始 STEP / Parasolid 文件。{{ profile.cad === 'slave' ? '从模块原文件包含上、下两个连接器。' : '' }}</p></div>
      <a v-for="format in ['STEP', 'x_t']" :key="format" :href="withBase('/models/cad/io-' + profile.cad + '.' + format)" :download="'装配体-' + (profile.cad === 'slave' ? '从模块' : '主模块') + '与PCB-可外发.' + format">下载 {{ format }} ↓</a>
    </section>

    <div class="lab-workspace">
      <section class="preview-area" aria-label="日夜模型对比">
        <div class="preview-toolbar">
          <span><i class="live-dot" />双视图同步</span>
          <div><button @click="setView('front')">正面</button><button @click="setView()">立体</button><button @click="setView('contacts')">{{ profile.contactsView ? '弹片特写' : '触点侧' }}</button><button @click="setView('opposite')">{{ profile.oppositeView ? '触片特写' : '另一侧' }}</button><button v-if="profile.closeup" @click="connectorCloseup">端子特写</button></div>
        </div>
        <div class="preview-grid">
          <article v-for="mode in modes" :key="mode.id" class="preview-card" :data-mode="mode.id">
            <div class="preview-title"><h2>{{ mode.title }}</h2><span>{{ mode.caption }}</span></div>
            <div class="model-stage" :style="{ backgroundColor: lighting[mode.id].background }">
              <component
                :is="'model-viewer'" :ref="el => setViewer(mode.id, el)"
                :src="previewSource" :alt="`${mode.title} ${profile.title}`"
                camera-controls disable-pan touch-action="pan-y" interaction-prompt="none"
                :camera-orbit="profile.orbit" field-of-view="30deg"
                :exposure="lighting[mode.id].exposure" :environment-image="lighting[mode.id].environment"
                :tone-mapping="lighting[mode.id].tone" :shadow-intensity="lighting[mode.id].shadow"
                :shadow-softness="lighting[mode.id].softness" loading="eager"
                @load="onLoad(mode.id)" @error="errors[mode.id] = '模型加载失败，请刷新重试。'"
                @camera-change="syncCamera(mode.id, $event)" @pointerdown="pointerDown"
                @pointerup="pickMaterial(mode.id, $event)" @pointercancel="pointer = undefined"
              />
              <p v-if="!ready[mode.id] || errors[mode.id]" class="load-state" role="status">{{ errors[mode.id] || '正在载入 3D 模型…' }}</p>
              <span class="stage-caption">拖动旋转 · 双指缩放 · 点击选材质</span>
            </div>
            <div class="light-controls">
              <label :for="`${mode.id}-exposure`">光照强度 <output>{{ lighting[mode.id].exposure.toFixed(2) }}</output></label>
              <input :id="`${mode.id}-exposure`" v-model.number="lighting[mode.id].exposure" :aria-label="`${mode.title}光照强度`" type="range" min="0.1" max="2.5" step="0.05" />
              <div class="control-pair">
                <label>环境光<select v-model="lighting[mode.id].environment" :aria-label="`${mode.title}环境光`"><option value="neutral">中性柔光</option><option value="legacy">明亮影棚</option></select></label>
                <label>色调映射<select v-model="lighting[mode.id].tone" :aria-label="`${mode.title}色调映射`"><option value="neutral">Neutral · 保色</option><option value="aces">ACES · 对比</option><option value="agx">AgX · 柔和</option></select></label>
              </div>
              <details>
                <summary>阴影与背景</summary>
                <label :for="`${mode.id}-shadow`">阴影浓度 <output>{{ lighting[mode.id].shadow.toFixed(2) }}</output></label>
                <input :id="`${mode.id}-shadow`" v-model.number="lighting[mode.id].shadow" type="range" min="0" max="2" step="0.05" />
                <label :for="`${mode.id}-softness`">阴影柔和度 <output>{{ lighting[mode.id].softness.toFixed(2) }}</output></label>
                <input :id="`${mode.id}-softness`" v-model.number="lighting[mode.id].softness" type="range" min="0" max="1" step="0.05" />
                <label class="background-row">背景颜色<input v-model="lighting[mode.id].background" :aria-label="`${mode.title}背景颜色`" type="color" /></label>
              </details>
            </div>
          </article>
        </div>
        <p class="preview-note">两侧使用同一套材质；视角同步，光照独立。照片匹配为视觉近似，可按实物继续微调。</p>
      </section>

      <aside class="material-controls" aria-label="材质调整">
        <div class="section-heading"><h2>材质</h2><span>{{ materials.length }} 个部件</span></div>
        <label for="material-select">选择部件</label>
        <select id="material-select" v-model.number="selected" :disabled="!materials.length">
          <option v-for="(material, index) in materials" :key="material.name" :value="index">{{ materialName(index) }}</option>
        </select>
        <p class="help">也可以直接点击模型上的部位。</p>
        <fieldset v-if="activeMaterial" class="material-fields">
          <legend>{{ materialName(selected) }}</legend>
          <label for="base-color">{{ profile.panel && selected === 12 ? '面板整体色调' : '基础颜色' }}</label>
          <div class="color-row">
            <input id="base-color" type="color" :value="toHex(activeMaterial.color)" @input="setColor(($event.target as HTMLInputElement).value)" />
            <input aria-label="颜色十六进制" class="hex-input" type="text" :value="toHex(activeMaterial.color)" maxlength="7" pattern="#[0-9a-fA-F]{6}" @input="setColor(($event.target as HTMLInputElement).value)" />
          </div>
          <label for="metallic">金属感 <output>{{ activeMaterial.metallic.toFixed(2) }}</output></label>
          <input id="metallic" v-model.number="activeMaterial.metallic" type="range" min="0" max="1" step="0.01" />
          <div class="range-labels"><span>塑料</span><span>金属</span></div>
          <label for="roughness">粗糙度 <output>{{ activeMaterial.roughness.toFixed(2) }}</output></label>
          <input id="roughness" v-model.number="activeMaterial.roughness" type="range" min="0" max="1" step="0.01" />
          <div class="range-labels"><span>光滑</span><span>哑光</span></div>
          <button class="subtle-button" @click="resetMaterial">恢复此材质</button>
        </fieldset>
        <section v-if="stickerTemplate" class="panel-section sticker-section">
          <div class="section-heading"><h2>前面板贴纸</h2><span>{{ profile.connectorCount === 1 ? '单连接器' : '双连接器' }}</span></div>
          <p class="help">{{ sticker ? `${sticker.filename} · ${sticker.thickness} mm` : '上传图片，旋转裁切并对齐开孔。默认 0.35 mm 实体贴膜。' }}</p>
          <button class="subtle-button" :disabled="!ready.day || !ready.night || stickerBusy || exporting" @click="stickerError = ''; stickerOpen = true">{{ sticker ? '调整贴纸' : '添加贴纸' }}</button>
          <button v-if="sticker" class="remove-sticker" :disabled="stickerBusy || !ready.day || exporting" @click="applySticker(null)">移除贴纸</button>
          <div v-if="sticker" class="sticker-finish">
            <div class="finish-buttons" role="group" aria-label="预览贴纸材质"><button :aria-pressed="(sticker.roughness ?? .7) === .7 && (sticker.reflection ?? .3) === .3" @click="setStickerFinish(.7, .3)">磨砂</button><button :aria-pressed="sticker.roughness === .18 && sticker.reflection === 1" @click="setStickerFinish(.18, 1)">亮面</button></div>
            <label>贴纸粗糙度 <output>{{ (sticker.roughness ?? .7).toFixed(2) }}</output><input :value="sticker.roughness ?? .7" aria-label="预览贴纸粗糙度" type="range" min=".02" max="1" step=".01" @input="sticker.roughness = Number(($event.target as HTMLInputElement).value)" /></label>
            <label>贴纸反射强度 <output>{{ (sticker.reflection ?? .3).toFixed(2) }}</output><input :value="sticker.reflection ?? .3" aria-label="预览贴纸反射强度" type="range" min="0" max="1" step=".01" @input="sticker.reflection = Number(($event.target as HTMLInputElement).value)" /></label>
            <p class="help">两侧材质同步；分别调节光照强度，观察反射变化。</p>
          </div>
        </section>
        <section v-if="profile.panel" class="panel-section">
          <div class="section-heading"><h2>型号前面板</h2><label class="check-label"><input v-model="panelEnabled" type="checkbox" />显示</label></div>
          <p class="panel-model">IM2620 / EC</p>
          <div class="panel-preview"><img :src="withBase('/models/panels/im2620-ec.svg')" alt="IM2620 EC 前面板设计，包含电源、USB 和 IN / OUT 网口标识" /></div>
          <p class="help">0.35 mm 实体面板，真实接口开孔，仅保留右侧 USB。</p>
        </section>
        <section v-else class="panel-section">
          <div class="section-heading"><h2>当前模型</h2></div>
          <p class="panel-model">{{ profile.title }}</p>
          <p class="help">{{ profile.note }}</p>
          <p class="help">外壳沿用冷灰细纹注塑预设。旋转到两侧，可以检查镀金触点与黑色绝缘隔栏。</p>
        </section>
        <button class="reset-button" :disabled="!materials.length" @click="resetAll">恢复实物参考预设</button>
        <p class="save-status" role="status">{{ status }}</p>
      </aside>
    </div>
    <footer class="lab-footer">“导出当前 GLB”包含当前模型、材质、贴图与实体贴纸，可用于其他软件和网页。日夜环境光通过“导出配置”保存，在其他软件中需设置对应光照。装配下载提供原始 STEP 和 x_t 文件。</footer>
    <ModelStickerEditor v-if="stickerOpen && stickerTemplate" :template="stickerTemplate" :value="sticker" :busy="stickerBusy" :error="stickerError" @apply="applySticker" @close="stickerOpen = false" />
  </main>
</template>

<style scoped>
.material-lab { --lab-accent: #bd6657; max-width: 1600px; margin: 0 auto; padding: 36px 32px 28px; color: var(--vp-c-text-1); }
.lab-header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; margin-bottom: 28px; }
.back-link { font-size: 13px; color: var(--vp-c-text-2); text-decoration: none; }
.back-link:hover { color: var(--lab-accent); }
.eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .15em; color: var(--lab-accent); margin: 22px 0 8px; }
h1 { font-size: 30px; line-height: 1.3; font-weight: 650; letter-spacing: -.03em; margin: 0; }
.intro { color: var(--vp-c-text-2); font-size: 14px; margin: 10px 0 0; }
.header-actions { display: flex; flex-wrap: wrap; gap: 8px; }
button { padding: 9px 14px; min-height: 40px; border: 1px solid var(--vp-c-divider); border-radius: 7px; background: var(--vp-c-bg); color: var(--vp-c-text-1); cursor: pointer; font-size: 13px; transition: border-color .15s, background .15s; }
button:hover { border-color: var(--lab-accent); background: var(--vp-c-bg-soft); }
button:disabled { opacity: .45; cursor: wait; }
button.primary { background: var(--lab-accent); color: #fff; border-color: var(--lab-accent); }
button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible { outline: 2px solid var(--lab-accent); outline-offset: 3px; }
.file-input { display: none; }
.cad-downloads { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 24px; padding: 16px 20px; border: 1px solid var(--vp-c-divider); border-radius: 10px; }
.cad-downloads > div { flex: 1 1 260px; }.cad-downloads strong { font-size: 14px; }.cad-downloads p { margin: 5px 0 0; font-size: 12px; color: var(--vp-c-text-2); }
.cad-downloads a { padding: 9px 14px; border: 1px solid var(--vp-c-divider); border-radius: 7px; color: var(--vp-c-brand-1); font-size: 13px; white-space: nowrap; }.cad-downloads a:hover { border-color: var(--lab-accent); }.cad-downloads a:focus-visible { outline: 2px solid var(--lab-accent); outline-offset: 3px; }
.lab-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 24px; align-items: start; }
.preview-area { min-width: 0; }
.preview-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 43px; margin-bottom: 12px; font-size: 12px; color: var(--vp-c-text-2); }
.preview-toolbar > div { display: flex; flex-wrap: wrap; gap: 6px; }
.preview-toolbar button { min-height: 34px; padding: 5px 12px; font-size: 12px; }
.live-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #65a987; margin-right: 8px; }
.preview-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }
.preview-card { min-width: 0; border-radius: 12px; border: 1px solid var(--vp-c-divider); overflow: hidden; }
.preview-title { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 16px 18px; }
.preview-card[data-mode="day"] .preview-title { background: #fff; color: #30343a; border-bottom: 1px solid #ededee; }
.preview-card[data-mode="night"] .preview-title { background: #1b1b1f; color: #e8e8ed; border-bottom: 1px solid #333339; }
.preview-title h2, .section-heading h2 { margin: 0; font-size: 15px; font-weight: 600; }
.preview-title span { font-size: 11px; opacity: .55; }
.model-stage { position: relative; height: 490px; }
model-viewer { display: block; width: 100%; height: 100%; --progress-bar-color: var(--lab-accent); touch-action: pan-y; }
.stage-caption { position: absolute; bottom: 14px; left: 8px; right: 8px; text-align: center; font-size: 10px; color: #8b8e94; pointer-events: none; }
.load-state { position: absolute; inset: 42% 15px auto; text-align: center; color: #888; font-size: 13px; pointer-events: none; }
.light-controls { padding: 18px; background: var(--vp-c-bg-soft); }
label { display: block; font-size: 12px; font-weight: 500; color: var(--vp-c-text-2); margin-bottom: 8px; }
label output { float: right; font-variant-numeric: tabular-nums; color: var(--vp-c-text-1); }
input[type="range"] { display: block; width: 100%; height: 26px; accent-color: var(--lab-accent); cursor: pointer; margin: 2px 0 12px; touch-action: pan-y; }
.control-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.control-pair label { min-width: 0; margin-bottom: 0; }
select, .hex-input { display: block; width: 100%; min-width: 0; border: 1px solid var(--vp-c-divider); border-radius: 6px; background: var(--vp-c-bg); color: var(--vp-c-text-1); min-height: 40px; padding: 6px 9px; font-size: 13px; }
.control-pair select { margin-top: 8px; padding-left: 6px; font-size: 12px; }
details { border-top: 1px solid var(--vp-c-divider); margin-top: 18px; padding-top: 12px; }
summary { cursor: pointer; font-size: 12px; color: var(--vp-c-text-2); }
details[open] summary { margin-bottom: 18px; }
.background-row { display: flex; align-items: center; justify-content: space-between; margin: 8px 0 0; }
input[type="color"] { width: 44px; height: 38px; background: none; border: 1px solid var(--vp-c-divider); border-radius: 6px; padding: 3px; cursor: pointer; }
.preview-note { font-size: 12px; color: var(--vp-c-text-3); line-height: 1.7; margin: 14px 2px; }
.material-controls { border: 1px solid var(--vp-c-divider); border-radius: 12px; padding: 22px; background: var(--vp-c-bg-soft); }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 20px; }
.section-heading > span { font-size: 11px; color: var(--vp-c-text-3); }
.help { font-size: 11px; line-height: 1.65; color: var(--vp-c-text-3); margin: 8px 0 18px; }
.material-fields { border: 0; padding: 0; margin: 22px 0 0; min-width: 0; }
.material-fields legend { font-size: 13px; font-weight: 600; margin-bottom: 16px; }
.color-row { display: flex; gap: 8px; margin-bottom: 22px; }
.color-row input[type="color"] { flex: 0 0 44px; height: 42px; }
.hex-input { font-family: var(--vp-font-family-mono); }
.range-labels { display: flex; justify-content: space-between; margin-top: -9px; margin-bottom: 20px; font-size: 10px; color: var(--vp-c-text-3); }
.subtle-button { width: 100%; font-size: 12px; }
.panel-section { border-top: 1px solid var(--vp-c-divider); margin-top: 24px; padding-top: 20px; }
.panel-section .section-heading { margin-bottom: 10px; }
.remove-sticker { display: block; margin: 8px auto 0; border: 0; background: none; font-size: 12px; color: var(--vp-c-text-3); }
.sticker-section .help { overflow-wrap: anywhere; }
.sticker-finish { margin-top: 16px; }.finish-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 14px; }.finish-buttons button { font-size: 12px; padding: 5px; min-height: 34px; }.finish-buttons button[aria-pressed=true] { color: white; background: var(--lab-accent); border-color: var(--lab-accent); }
.check-label { display: flex; gap: 6px; align-items: center; margin: 0; font-size: 12px; }
.check-label input { accent-color: var(--lab-accent); width: 17px; height: 17px; }
.panel-model { margin: 0 0 12px; color: var(--vp-c-text-2); font-size: 12px; }
.panel-preview { padding: 12px; background: #282b30; border-radius: 8px; }
.panel-preview img { height: 190px; width: auto; display: block; margin: auto; filter: none !important; }
.reset-button { width: 100%; margin-top: 4px; font-size: 12px; }
.save-status { font-size: 11px; color: var(--vp-c-text-3); margin: 12px 0 0; line-height: 1.6; }
.lab-footer { margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--vp-c-divider); font-size: 12px; line-height: 1.7; color: var(--vp-c-text-3); }
@media (min-width: 1500px) { .model-stage { height: 580px; } }
@media (max-width: 1100px) { .lab-workspace { grid-template-columns: minmax(0, 1fr); } .material-controls { display: grid; grid-template-columns: 1fr 1fr; column-gap: 28px; } .material-controls > .section-heading, .material-controls > label, .material-controls > select, .material-controls > .help { grid-column: 1 / -1; } .panel-section { margin: 0; padding: 0; border-top: 0; } .material-fields { margin: 0; } .panel-preview img { height: 230px; } .lab-header { align-items: flex-start; } .header-actions { justify-content: flex-end; } }
@media (max-width: 600px) { .material-lab { padding: 22px 14px; } .lab-header { display: block; } h1 { font-size: 25px; } .header-actions { justify-content: flex-start; margin-top: 20px; } .preview-grid { gap: 8px; } .preview-title { display: block; padding: 12px; } .preview-title h2 { font-size: 13px; } .preview-title span { display: none; } .model-stage { height: 330px; } .stage-caption { font-size: 9px; } .light-controls { padding: 12px; } .control-pair { grid-template-columns: 1fr; } .control-pair select, select, .hex-input { font-size: 16px; } .material-controls { padding: 18px; column-gap: 18px; } .material-fields legend { font-size: 12px; } .section-heading h2 { font-size: 13px; } .panel-preview img { height: 190px; } }
</style>
