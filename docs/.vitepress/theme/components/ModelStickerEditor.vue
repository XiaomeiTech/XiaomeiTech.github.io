<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { artworkCorners, imagePlacement, loadStickerImage, localCorners, newSticker, paintSticker, sourceDimensions, validQuad, validateSticker, type StickerState, type StickerTemplate } from './modelSticker'
import { svgStickerData } from './svgSticker'

const props = defineProps<{ template: StickerTemplate; value: StickerState | null; busy: boolean; error: string }>()
const emit = defineEmits<{ apply: [value: StickerState]; close: [] }>()
const draft = reactive<StickerState>(props.value ? JSON.parse(JSON.stringify(props.value)) : newSticker(props.template))
draft.corners ||= [[0, 0], [0, 0], [0, 0], [0, 0]]
draft.roughness ??= .7; draft.reflection ??= .3
const editMode = ref<'crop' | 'perspective' | 'pick'>('crop')
const sourceSurface = ref<SVGSVGElement>()
const picked = ref<[number, number][]>(draft.sourceCorners ? draft.sourceCorners.map(p => [...p]) : [])
const cursor = reactive({ x: 0, y: 0, span: 100 })
const nextCorner = computed(() => ['左上', '右上', '右下', '左下'][picked.value.length] || '四角已选好')
const artwork = ref<HTMLCanvasElement>()
let loadedImage: HTMLImageElement | undefined, paintFrame = 0
const dialog = ref<HTMLDialogElement>(), upload = ref<HTMLInputElement>(), surface = ref<SVGSVGElement>()
const size = reactive({ width: 1, height: 1 }), imageReady = ref(false), message = ref('')
const dragDepth = ref(0), reading = ref(false)
let readVersion = 0
const guides = ref(true), grid = ref(true), artworkOpacity = ref(1)
const guideX = ref(props.template.width / 2), guideY = ref(props.template.height / 2)
const placement = computed(() => imagePlacement(draft, props.template, size.width, size.height))
const corners = computed(() => artworkCorners(draft, props.template, size.width, size.height))
const cornerNames = ['nw', 'ne', 'se', 'sw']
const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const gridX = Array.from({ length: Math.floor(props.template.width / 5) }, (_, i) => (i + 1) * 5)
const gridY = Array.from({ length: Math.floor(props.template.height / 5) }, (_, i) => (i + 1) * 5)
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const angle = (v: number) => ((v + 180) % 360 + 360) % 360 - 180
function resetPlacement() { Object.assign(draft, { x: 0, y: 0, zoom: 1, scaleX: 1, scaleY: 1, rotation: 0, corners: [[0, 0], [0, 0], [0, 0], [0, 0]] }) }
function redraw() {
  cancelAnimationFrame(paintFrame)
  paintFrame = requestAnimationFrame(() => {
    const canvas = artwork.value
    if (!canvas || !loadedImage || !validQuad(localCorners(draft))) return
    canvas.width = 360; canvas.height = Math.round(360 * props.template.height / props.template.width)
    const ctx = canvas.getContext('2d')!
    ctx.scale(canvas.width / props.template.width, canvas.height / props.template.height)
    paintSticker(ctx, loadedImage, draft, props.template, 24)
  })
}
watch(draft, redraw, { deep: true })
async function inspectImage() {
  const img = await loadStickerImage(draft.image)
  loadedImage = img; size.width = img.naturalWidth; size.height = img.naturalHeight; imageReady.value = true
  await nextTick(); redraw()
}
async function pickFile(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  if (!file) return
  await readFile(file)
  input.value = ''
}
async function readFile(file: File) {
  if (props.busy) return
  const version = ++readVersion
  reading.value = true
  message.value = ''
  try {
    if (!supportedImage(file)) throw new Error('请选择 SVG、PNG、JPG 或 WebP 图片')
    if (file.size > 20 * 1024 * 1024) throw new Error('图片请控制在 20 MB 以内')
    if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
      const data = svgStickerData(await file.text()), img = await loadStickerImage(data)
      if (version !== readVersion) return
      draft.image = data; draft.filename = file.name; loadedImage = img
      size.width = img.naturalWidth; size.height = img.naturalHeight; imageReady.value = true
      draft.sourceCorners = undefined; picked.value = []; resetPlacement()
      editMode.value = 'pick'
      await nextTick(); redraw(); return
    }
    const url = URL.createObjectURL(file)
    try {
      const img = await loadStickerImage(url), canvas = document.createElement('canvas')
      const scale = Math.min(1, 4096 / Math.max(img.naturalWidth, img.naturalHeight))
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      if (version !== readVersion) return
      draft.image = canvas.toDataURL('image/png'); draft.filename = file.name || '粘贴的图片.png'
      size.width = canvas.width; size.height = canvas.height; imageReady.value = true; draft.sourceCorners = undefined; picked.value = []; resetPlacement()
      loadedImage = await loadStickerImage(draft.image); await nextTick(); redraw()
    } finally { URL.revokeObjectURL(url) }
  } catch (e) { if (version === readVersion) message.value = e instanceof Error ? e.message : '图片读取失败' }
  finally { if (version === readVersion) reading.value = false }
}
function sourcePoint(event: PointerEvent) {
  const svg = sourceSurface.value!, matrix = svg.getScreenCTM()!, p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  cursor.x = clamp(p.x, 0, size.width); cursor.y = clamp(p.y, 0, size.height)
  cursor.span = 128 / 5 / matrix.a
  return [cursor.x / size.width, cursor.y / size.height] as [number, number]
}
function pickCorner(event: PointerEvent) {
  if (!imageReady.value || picked.value.length === 4 || event.button !== 0 || !event.isPrimary) return
  event.preventDefault(); const p = sourcePoint(event)
  picked.value.push(p); message.value = ''
}
function confirmSource() {
  if (picked.value.length !== 4 || !validQuad(picked.value)) { message.value = '请按左上、右上、右下、左下的顺序点选，四边不能交叉'; return }
  draft.sourceCorners = picked.value.map(p => [...p]); resetPlacement(); editMode.value = 'crop'; message.value = ''; void nextTick(redraw)
}
watch(editMode, () => { if (editMode.value !== 'pick') void nextTick(redraw) })
function dragEnter(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  event.preventDefault(); dragDepth.value++
}
function dragOver(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  event.preventDefault(); event.dataTransfer.dropEffect = props.busy ? 'none' : 'copy'
}
function drop(event: DragEvent) {
  event.preventDefault(); dragDepth.value = 0
  const files = Array.from(event.dataTransfer?.files || [])
  const image = files.find(supportedImage)
  if (image) void readFile(image)
  else message.value = '请拖入 SVG、PNG、JPG 或 WebP 图片文件'
}
function supportedImage(file: File) { return ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type) || /\.svg$/i.test(file.name) }
function paste(event: ClipboardEvent) {
  const image = Array.from(event.clipboardData?.items || []).find(item => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile()
  if (!image) return
  event.preventDefault(); void readFile(image)
}
function point(event: PointerEvent) {
  const matrix = surface.value!.getScreenCTM()!
  return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
}
let dragging: { id: number; kind: string; x: number; y: number; draftX: number; draftY: number; rotation: number; startAngle: number } | null = null
function start(event: PointerEvent, kind: string) {
  if ((!imageReady.value && !kind.startsWith('guide')) || props.busy) return
  event.preventDefault(); event.stopPropagation()
  const p = point(event)
  dragging = { id: event.pointerId, kind, x: p.x, y: p.y, draftX: draft.x, draftY: draft.y, rotation: draft.rotation, startAngle: Math.atan2(p.y - placement.value.y, p.x - placement.value.x) }
  surface.value!.setPointerCapture(event.pointerId)
}
function move(event: PointerEvent) {
  if (!dragging || dragging.id !== event.pointerId) return
  const p = point(event), d = dragging
  if (d.kind === 'pan') {
    draft.x = clamp(d.draftX + p.x - d.x, -200, 200); draft.y = clamp(d.draftY + p.y - d.y, -200, 200)
  } else if (d.kind === 'guide-x') guideX.value = clamp(p.x, 0, props.template.width)
  else if (d.kind === 'guide-y') guideY.value = clamp(p.y, 0, props.template.height)
  else if (d.kind === 'rotate') draft.rotation = angle(d.rotation + (Math.atan2(p.y - placement.value.y, p.x - placement.value.x) - d.startAngle) * 180 / Math.PI)
  else if (d.kind.startsWith('corner-')) {
    const index = Number(d.kind.slice(7)), base = [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]][index]
    const rad = -draft.rotation * Math.PI / 180, dx = p.x - placement.value.x, dy = p.y - placement.value.y
    const candidate = draft.corners!.map(p => [...p]) as [number, number][]
    candidate[index] = [clamp((dx * Math.cos(rad) - dy * Math.sin(rad)) / placement.value.width - base[0], -3, 3), clamp((dx * Math.sin(rad) + dy * Math.cos(rad)) / placement.value.height - base[1], -3, 3)]
    if (validQuad(localCorners({ ...draft, corners: candidate }))) draft.corners = candidate
  } else {
    const rad = -draft.rotation * Math.PI / 180, dx = p.x - placement.value.x, dy = p.y - placement.value.y
    const [width, height] = sourceDimensions(draft, size.width, size.height), fit = Math.max(props.template.width / width, props.template.height / height) * draft.zoom
    if (/[ew]/.test(d.kind)) draft.scaleX = clamp(Math.abs(dx * Math.cos(rad) - dy * Math.sin(rad)) * 2 / (width * fit), .1, 8)
    if (/[ns]/.test(d.kind)) draft.scaleY = clamp(Math.abs(dx * Math.sin(rad) + dy * Math.cos(rad)) * 2 / (height * fit), .1, 8)
  }
}
function stop() { dragging = null }
function nudge(event: KeyboardEvent) {
  const delta = event.shiftKey ? 1 : .1
  if (event.key === 'ArrowLeft') draft.x = clamp(draft.x - delta, -200, 200)
  else if (event.key === 'ArrowRight') draft.x = clamp(draft.x + delta, -200, 200)
  else if (event.key === 'ArrowUp') draft.y = clamp(draft.y - delta, -200, 200)
  else if (event.key === 'ArrowDown') draft.y = clamp(draft.y + delta, -200, 200)
  else return
  event.preventDefault()
}
function apply() {
  if (!imageReady.value || !validateSticker(draft, props.template)) { message.value = '请先选择图片，并检查缩放和厚度范围'; return }
  emit('apply', { ...draft })
}
let previousFocus: HTMLElement | null = null
onMounted(async () => {
  document.addEventListener('paste', paste)
  previousFocus = document.activeElement as HTMLElement
  await nextTick(); dialog.value?.showModal()
  if (draft.image) { try { await inspectImage() } catch { message.value = '保存的图片无法读取，请重新选择' } }
})
onBeforeUnmount(() => { readVersion++; cancelAnimationFrame(paintFrame); document.removeEventListener('paste', paste); dialog.value?.close(); previousFocus?.focus() })
</script>

<template>
  <dialog ref="dialog" class="sticker-dialog" aria-labelledby="sticker-title" @cancel.prevent="!busy && emit('close')" @dragenter="dragEnter" @dragover="dragOver" @dragleave="dragDepth = Math.max(0, dragDepth - 1)" @drop="drop">
    <div v-if="dragDepth > 0" class="drop-overlay" aria-hidden="true"><strong>松开以添加贴纸</strong><span>SVG / PNG / JPG / WebP</span></div>
    <header>
      <div><p class="eyebrow">前面板贴纸</p><h2 id="sticker-title">{{ template.title }}</h2><p>{{ template.width }} × {{ template.height }} mm · {{ template.openings.length }} 个接口开孔</p></div>
      <button class="close" aria-label="关闭贴纸编辑器" :disabled="busy" @click="emit('close')">×</button>
    </header>
    <div class="sticker-body">
      <section class="crop-preview" aria-label="贴纸裁切预览">
        <template v-if="editMode === 'pick'">
          <div class="crop-toolbar"><span>原图取点 · {{ picked.length }}/4</span><strong>{{ picked.length < 4 ? `请点选${nextCorner}角` : '确认四角后即可缩放' }}</strong></div>
          <svg v-if="imageReady" ref="sourceSurface" :viewBox="`0 0 ${size.width} ${size.height}`" class="source-surface" role="application" aria-label="原图四点取图画布，依次点选左上右上右下左下" @pointermove="sourcePoint" @pointerdown="pickCorner">
            <image :href="draft.image" :width="size.width" :height="size.height"/>
            <polygon v-if="picked.length > 1" :points="picked.map(p => `${p[0] * size.width},${p[1] * size.height}`).join(' ')" fill="#5bd7ef22" stroke="#5bd7ef" stroke-width="2" vector-effect="non-scaling-stroke"/>
            <g v-for="(p, i) in picked" :key="i"><circle :cx="p[0] * size.width" :cy="p[1] * size.height" :r="size.width / 75" fill="#fff" stroke="#bd6657" stroke-width="2" vector-effect="non-scaling-stroke"/><text :x="p[0] * size.width" :y="p[1] * size.height + size.width / 200" text-anchor="middle" :font-size="size.width / 55" fill="#222">{{ i + 1 }}</text></g>
          </svg>
          <p v-else class="empty-source">先选择、拖入或粘贴一张图片</p>
          <div class="loupe-row">
            <div class="loupe"><svg v-if="imageReady" :viewBox="`${cursor.x - cursor.span / 2} ${cursor.y - cursor.span / 2} ${cursor.span} ${cursor.span}`" aria-label="选点放大镜，五倍放大"><image :href="draft.image" :width="size.width" :height="size.height"/><path :d="`M${cursor.x - cursor.span / 2} ${cursor.y}h${cursor.span}M${cursor.x} ${cursor.y - cursor.span / 2}v${cursor.span}`" stroke="#fc617f" stroke-width="1" vector-effect="non-scaling-stroke"/></svg><span>5× 放大镜</span></div>
            <div><p>按顺时针点选四个角，放大镜跟随指针辅助定位。</p><div class="pick-actions"><button :disabled="!picked.length" @click="picked.pop()">撤销一点</button><button :disabled="!picked.length" @click="picked = []">重新选点</button></div><button class="primary" :disabled="picked.length !== 4" @click="confirmSource">确认四角并缩放</button></div>
          </div>
        </template>
        <div v-if="editMode !== 'pick'" class="crop-toolbar"><span>正面 · 上端 ↑</span><label><input v-model="guides" type="checkbox" />开孔辅助线</label><label><input v-model="grid" type="checkbox" />5 mm 网格</label></div>
        <svg v-if="editMode !== 'pick'" ref="surface" :viewBox="`-6 -6 ${template.width + 12} ${template.height + 12}`" class="crop-surface" tabindex="0" role="application" aria-label="贴纸裁切画布，可拖动图片，方向键微调位置" @pointerdown="start($event, 'pan')" @pointermove="move" @pointerup="stop" @pointercancel="stop" @lostpointercapture="stop" @keydown="nudge">
          <defs><clipPath id="sticker-crop"><rect :width="template.width" :height="template.height" /></clipPath><pattern id="hole-checker" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="#e7ebf0"/><path d="M0 0h1v1H0zM1 1h1v1H1z" fill="#cad1db"/></pattern></defs>
          <rect :width="template.width" :height="template.height" :fill="draft.background" />
          <g clip-path="url(#sticker-crop)">
            <foreignObject v-if="imageReady" x="0" y="0" :width="template.width" :height="template.height" :opacity="artworkOpacity" style="pointer-events: none"><canvas ref="artwork" style="width:100%;height:100%;display:block" /></foreignObject>
            <g v-if="grid" class="grid-lines"><path v-for="x in gridX" :key="`x${x}`" :d="`M${x} 0V${template.height}`"/><path v-for="y in gridY" :key="`y${y}`" :d="`M0 ${y}H${template.width}`"/></g>
            <g v-for="(hole, i) in template.openings" :key="hole.name">
              <rect :x="hole.x" :y="hole.y" :width="hole.width" :height="hole.height" fill="url(#hole-checker)" :stroke="guides ? '#5bd7ef' : '#8f9aa7'" stroke-width=".18"/>
              <text :x="hole.x + hole.width / 2" :y="hole.y + hole.height / 2" text-anchor="middle" class="hole-label">{{ i + 1 }} · {{ hole.name }}</text>
              <path v-if="guides" :d="`M0 ${hole.y}H${template.width}M0 ${hole.y + hole.height}H${template.width}M${hole.x} 0V${template.height}M${hole.x + hole.width} 0V${template.height}`" class="hole-guides"/>
            </g>
          </g>
          <rect :width="template.width" :height="template.height" fill="none" stroke="#f6c46a" stroke-width=".2" />
          <g v-if="guides" class="movable-guides">
            <path :d="`M${guideX} -3V${template.height + 3}`" @pointerdown.stop="start($event, 'guide-x')"/>
            <path :d="`M-3 ${guideY}H${template.width + 3}`" @pointerdown.stop="start($event, 'guide-y')"/>
            <path :d="`M${guideX} -3V${template.height + 3}M-3 ${guideY}H${template.width + 3}`" class="guide-visible"/>
          </g>
          <g v-if="imageReady && editMode === 'crop'" :transform="`translate(${placement.x} ${placement.y}) rotate(${draft.rotation})`" class="image-handles">
            <rect :x="-placement.width / 2" :y="-placement.height / 2" :width="placement.width" :height="placement.height" class="image-border"/>
            <rect v-for="handle in handles" :key="handle" :x="(handle.includes('w') ? -placement.width / 2 : handle.includes('e') ? placement.width / 2 : 0) - .8" :y="(handle.includes('n') ? -placement.height / 2 : handle.includes('s') ? placement.height / 2 : 0) - .8" width="1.6" height="1.6" :class="`handle-${handle}`" @pointerdown.stop="start($event, handle)" />
            <path :d="`M0 ${-placement.height / 2}v-3`" class="image-border"/><circle cx="0" :cy="-placement.height / 2 - 3" r="1" aria-label="旋转图片" @pointerdown.stop="start($event, 'rotate')"/>
          </g>
          <g v-if="imageReady && editMode === 'perspective'" class="image-handles perspective-handles">
            <polygon :points="corners.map(p => p.join(',')).join(' ')" class="image-border" />
            <g v-for="(corner, i) in corners" :key="cornerNames[i]" @pointerdown.stop="start($event, `corner-${i}`)"><circle :cx="corner[0]" :cy="corner[1]" r="1.15"/><text :x="corner[0]" :y="corner[1] + .4" text-anchor="middle">{{ i + 1 }}</text></g>
          </g>
          <text v-for="y in gridY" :key="y" x="-1" :y="y + .4" class="ruler" text-anchor="end">{{ y }}</text>
        </svg>
        <p v-if="editMode !== 'pick'" class="crop-hint">{{ editMode === 'crop' ? '拖动图片移动；边角整体拉伸，圆柄旋转。' : '拖动编号角点，只移动这个角，其他三个角保持原位。' }}方向键微调 0.1 mm，Shift 为 1 mm。</p>
      </section>
      <section class="crop-controls" aria-label="贴纸调整参数">
        <button class="upload-button" :disabled="busy || reading" @click="upload?.click()">{{ reading ? '正在读取图片…' : imageReady ? '更换图片' : '选择贴纸图片' }}</button>
        <input ref="upload" type="file" accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp" hidden @change="pickFile" />
        <p class="upload-hint">也可以把图片拖到此窗口，或直接 <kbd>Ctrl</kbd> + <kbd>V</kbd> 粘贴截图。</p>
        <p class="filename">{{ draft.filename || 'SVG / PNG / JPG / WebP，最多 20 MB' }}</p>
        <div class="mode-switch" role="group" aria-label="贴纸编辑模式"><button :aria-pressed="editMode === 'crop'" @click="editMode = 'crop'">普通裁切</button><button :aria-pressed="editMode === 'perspective'" @click="editMode = 'perspective'">四点校准</button><button :aria-pressed="editMode === 'pick'" @click="editMode = 'pick'">四点取图</button></div>
        <p class="mode-help">{{ editMode === 'crop' ? '整体移动、缩放和旋转图片。' : editMode === 'perspective' ? '四角独立调整透视，用于校正照片和对准开孔。' : '在原图中点选四角，确认后校正为矩形，再缩放贴合。' }}</p>
        <button v-if="draft.sourceCorners" class="clear-perspective" @click="draft.sourceCorners = undefined; picked = []; resetPlacement()">恢复完整原图</button>
        <button v-if="editMode === 'perspective'" class="clear-perspective" @click="draft.corners = [[0, 0], [0, 0], [0, 0], [0, 0]]">重置四角</button>
        <fieldset :disabled="busy">
          <legend>裁切与位置</legend>
          <label>整体缩放 <output>{{ draft.zoom.toFixed(2) }}×</output><input v-model.number="draft.zoom" aria-label="贴纸整体缩放" type="range" min=".1" max="10" step=".01" /></label>
          <div class="pair"><label>横向拉伸<input v-model.number="draft.scaleX" type="number" min=".1" max="8" step=".01" /></label><label>纵向拉伸<input v-model.number="draft.scaleY" type="number" min=".1" max="8" step=".01" /></label></div>
          <div class="pair"><label>水平位移 / mm<input v-model.number="draft.x" type="number" min="-200" max="200" step=".1" /></label><label>垂直位移 / mm<input v-model.number="draft.y" type="number" min="-200" max="200" step=".1" /></label></div>
          <label>旋转角度 / °<input v-model.number="draft.rotation" type="number" min="-180" max="180" step=".1" /></label>
          <input v-model.number="draft.rotation" aria-label="贴纸旋转滑块" type="range" min="-180" max="180" step=".1" />
          <div class="button-row"><button @click="draft.rotation = angle(draft.rotation - 90)">↶ 90°</button><button @click="draft.rotation = angle(draft.rotation + 90)">↷ 90°</button><button @click="resetPlacement">重置位置</button></div>
        </fieldset>
        <fieldset :disabled="busy"><legend>实体贴膜</legend>
          <div class="pair"><label>厚度 / mm<input v-model.number="draft.thickness" type="number" min=".05" max="2" step=".05" /></label><label>底色<input v-model="draft.background" type="color" /></label></div>
          <p>开孔位置固定。图片超出金色边框的部分会裁掉，透明处使用底色。</p>
        </fieldset>
        <fieldset :disabled="busy"><legend>贴纸材质</legend>
          <div class="mode-switch finish-switch" role="group" aria-label="贴纸材质预设"><button :aria-pressed="draft.roughness === .7 && draft.reflection === .3" @click="draft.roughness = .7; draft.reflection = .3">磨砂</button><button :aria-pressed="draft.roughness === .18 && draft.reflection === 1" @click="draft.roughness = .18; draft.reflection = 1">亮面</button></div>
          <label>粗糙度 <output>{{ draft.roughness!.toFixed(2) }}</output><input v-model.number="draft.roughness" aria-label="贴纸粗糙度" type="range" min=".02" max="1" step=".01" /></label>
          <label>反射强度 <output>{{ draft.reflection!.toFixed(2) }}</output><input v-model.number="draft.reflection" aria-label="贴纸反射强度" type="range" min="0" max="1" step=".01" /></label>
          <p>应用后可在日夜预览中继续实时调整材质与光照。</p>
        </fieldset>
        <details><summary>辅助线微调</summary><div class="pair"><label>竖线 / mm<input v-model.number="guideX" type="number" min="0" :max="template.width" step=".1" /></label><label>横线 / mm<input v-model.number="guideY" type="number" min="0" :max="template.height" step=".1" /></label></div><label>预览图片透明度<input v-model.number="artworkOpacity" type="range" min=".2" max="1" step=".05" /></label><p>青色：开孔边界；粉色：可拖动对齐线。辅助线不会印入贴纸。</p></details>
        <p class="error" role="status">{{ error || message }}</p>
      </section>
    </div>
    <footer><span>应用后同步到日夜模型，可随当前 GLB 导出；配置保留贴纸原图。</span><div><button :disabled="busy" @click="emit('close')">取消</button><button class="primary" :disabled="!imageReady || busy || reading || editMode === 'pick'" @click="apply">{{ busy ? '正在贴合…' : editMode === 'pick' ? '请先确认四角' : '应用贴纸' }}</button></div></footer>
  </dialog>
</template>

<style scoped>
.sticker-dialog { width: min(980px, calc(100vw - 28px)); max-height: calc(100dvh - 32px); border: 1px solid var(--vp-c-divider); border-radius: 16px; padding: 0; color: var(--vp-c-text-1); background: var(--vp-c-bg); margin: auto; box-shadow: 0 24px 100px #0006; }
.sticker-dialog[open] { display: flex; flex-direction: column; overflow: hidden; }
.sticker-dialog::backdrop { background: #111827a8; backdrop-filter: blur(3px); }
.drop-overlay { position: absolute; inset: 8px; z-index: 5; pointer-events: none; border: 3px dashed #65cce1; border-radius: 12px; background: #202b39eb; color: #fff; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 12px; }.drop-overlay strong { font-size: 24px; }.drop-overlay span { font-size: 13px; }
.upload-hint { font-size: 12px; line-height: 1.8; color: var(--vp-c-text-2); } kbd { font-size: 11px; padding: 1px 4px; border: 1px solid var(--vp-c-divider); border-radius: 4px; }
header, footer { display: flex; justify-content: space-between; gap: 20px; padding: 20px 24px; align-items: center; }
header { border-bottom: 1px solid var(--vp-c-divider); } h2 { font-size: 21px; margin: 0; }
header p { margin: 4px 0 0; color: var(--vp-c-text-2); font-size: 12px; }.eyebrow { color: #bd6657; font-size: 11px; letter-spacing: .12em; }
button { border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg); color: inherit; padding: 9px 14px; border-radius: 7px; cursor: pointer; font-size: 13px; min-height: 40px; } button:disabled { opacity: .45; cursor: wait; } .close { font-size: 24px; border: 0; } .primary, .upload-button { background: #bd6657; color: #fff; border-color: #bd6657; }
.sticker-body { display: grid; grid-template-columns: minmax(250px, 1fr) 330px; gap: 24px; padding: 20px 24px; min-height: 0; overflow: hidden; }
.crop-preview { min-width: 0; background: #20242b; color: #d7dce5; border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; }
.crop-toolbar { display: flex; flex-wrap: wrap; gap: 8px 14px; padding: 14px; align-items: center; font-size: 11px; }.crop-toolbar label { display: flex; gap: 5px; align-items: center; margin: 0; }.crop-toolbar input { accent-color: #65cce1; }
.crop-surface { width: 100%; height: min(53vh, 540px); min-height: 220px; flex: 1; display: block; touch-action: none; cursor: move; user-select: none; overflow: hidden; }
.grid-lines { stroke: #fff6; stroke-width: .06; pointer-events: none; }.hole-guides { stroke: #5bd7ef; stroke-width: .1; stroke-dasharray: 1 .6; pointer-events: none; }.hole-label { fill: #4b5664; font-size: 1.05px; pointer-events: none; }.ruler { fill: #aab6c5; font-size: 1.3px; pointer-events: none; }
.movable-guides > path { stroke: transparent; stroke-width: 1.6; cursor: crosshair; }.movable-guides > .guide-visible { stroke: #ff87b0; stroke-width: .12; stroke-dasharray: 1 .5; pointer-events: none; }
.image-handles rect, .image-handles circle { fill: #fff; stroke: #65cce1; stroke-width: .2; cursor: crosshair; }.image-handles .image-border { fill: none; stroke: #65cce1; stroke-width: .1; stroke-dasharray: 1 .7; pointer-events: none; }
.perspective-handles text { fill: #203947; font-size: 1.3px; font-weight: 700; pointer-events: none; }
.mode-switch { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--vp-c-divider); border-radius: 7px; padding: 3px; gap: 3px; }.mode-switch button { border: 0; background: transparent; padding: 8px 4px; font-size: 12px; }.mode-switch button[aria-pressed=true] { background: #bd6657; color: #fff; }.mode-help { color: var(--vp-c-text-3); font-size: 11px; margin: 8px 0; }.clear-perspective { width: 100%; font-size: 12px; }
.finish-switch { grid-template-columns: 1fr 1fr; margin-bottom: 16px; }
.source-surface { width: 100%; height: min(38vh, 380px); min-height: 240px; touch-action: none; cursor: crosshair; }.empty-source { min-height: 240px; display: grid; place-content: center; font-size: 13px; }.loupe-row { display: flex; align-items: center; gap: 14px; padding: 14px; margin-top: auto; }.loupe { flex: 0 0 128px; width: 128px; position: relative; height: 128px; background: #15181e; border: 1px solid #5bd7ef; overflow: hidden; border-radius: 8px; }.loupe svg { width: 100%; height: 100%; }.loupe span { position: absolute; bottom: 3px; left: 5px; background: #10151db0; font-size: 10px; padding: 2px 4px; }.loupe-row p { font-size: 11px; line-height: 1.7; }.pick-actions { display: flex; gap: 6px; margin-bottom: 8px; }.loupe-row button { font-size: 11px; padding: 7px; min-height: 32px; background: #313943; border-color: #56616e; color: #fff; }.loupe-row .primary { background: #bd6657; border-color: #bd6657; }
.crop-hint { margin: auto 14px 14px; font-size: 11px; line-height: 1.7; color: #aab6c5; }
.crop-controls { min-width: 0; min-height: 0; overflow-y: auto; max-height: calc(100dvh - 260px); padding-right: 6px; }.upload-button { width: 100%; }.filename { overflow-wrap: anywhere; font-size: 11px; color: var(--vp-c-text-3); margin: 7px 0 18px; }
fieldset { border: 0; border-top: 1px solid var(--vp-c-divider); padding: 15px 0 0; margin: 18px 0; } legend { font-size: 13px; font-weight: 600; padding-right: 10px; }
label { display: block; font-size: 12px; color: var(--vp-c-text-2); margin-bottom: 10px; } output { float: right; } input[type=number] { display: block; width: 100%; min-height: 36px; border: 1px solid var(--vp-c-divider); border-radius: 6px; padding: 6px 8px; background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); font-size: 13px; margin-top: 6px; } input[type=range] { display: block; width: 100%; height: 22px; accent-color: #bd6657; margin: 5px 0; } input[type=color] { display: block; width: 100%; height: 36px; margin-top: 6px; background: transparent; border: 1px solid var(--vp-c-divider); border-radius: 6px; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }.button-row { display: flex; gap: 6px; }.button-row button { flex: 1; font-size: 11px; padding: 6px; } fieldset p, details p { color: var(--vp-c-text-3); font-size: 11px; line-height: 1.7; } summary { font-size: 12px; cursor: pointer; margin-bottom: 12px; }.error { color: #d76758; font-size: 12px; }
footer { border-top: 1px solid var(--vp-c-divider); } footer span { color: var(--vp-c-text-3); font-size: 11px; } footer > div { display: flex; gap: 8px; flex-shrink: 0; } :focus-visible { outline: 2px solid #65cce1; outline-offset: 2px; }
@media(max-width: 650px) { .sticker-dialog { width: calc(100vw - 12px); max-height: calc(100dvh - 12px); } header, footer { padding: 14px; }.sticker-body { display: block; padding: 14px; overflow-y: auto; }.crop-controls { max-height: none; overflow: visible; margin-top: 18px; padding-right: 0; }.crop-surface { min-height: 400px; height: 54vh; } footer { flex-shrink: 0; background: var(--vp-c-bg); } footer span { display: none; } footer > div { margin-left: auto; } input[type=number] { font-size: 16px; } }
</style>
