<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

const props = defineProps<{
  label: string
  options: { value: string; label: string; count: number }[]
  modelValue: string[]
  open: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  toggle: []
  close: []
}>()
const id = useId()
const trigger = ref<HTMLButtonElement>()
const panel = ref<HTMLDivElement>()
const searchInput = ref<HTMLInputElement>()
const search = ref('')
const position = ref({ left: '0px', top: '0px', maxHeight: '440px' })
const visibleOptions = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return props.options.filter(option => option.label.toLocaleLowerCase().includes(term))
})
const selectedVisible = computed(() => visibleOptions.value.filter(option => props.modelValue.includes(option.value)).length)
const allVisibleSelected = computed(() => visibleOptions.value.length > 0 && selectedVisible.value === visibleOptions.value.length)
const summary = computed(() => props.options.filter(option => props.modelValue.includes(option.value)).map(option => option.label).join('、'))

function toggleValue(value: string) {
  emit('update:modelValue', props.modelValue.includes(value)
    ? props.modelValue.filter(item => item !== value)
    : [...props.modelValue, value])
}
function toggleAll() {
  const visible = visibleOptions.value.map(option => option.value)
  emit('update:modelValue', allVisibleSelected.value
    ? props.modelValue.filter(value => !visible.includes(value))
    : [...new Set([...props.modelValue, ...visible])])
}
function clear() {
  emit('update:modelValue', [])
  search.value = ''
}
function closeAndFocus() {
  emit('close')
  trigger.value?.focus()
}
function placePanel() {
  if (!props.open || !trigger.value || !panel.value) return
  const rect = trigger.value.getBoundingClientRect()
  const viewportWidth = document.documentElement.clientWidth
  const availableBelow = document.documentElement.clientHeight - rect.bottom - 16
  const availableAbove = rect.top - 16
  const above = availableBelow < 280 && availableAbove > availableBelow
  const maxHeight = Math.max(160, Math.min(440, above ? availableAbove : availableBelow))
  const height = Math.min(panel.value.scrollHeight, maxHeight)
  position.value = {
    left: `${Math.max(8, Math.min(rect.left, viewportWidth - panel.value.offsetWidth - 8))}px`,
    top: `${Math.max(8, above ? rect.top - height - 6 : rect.bottom + 6)}px`,
    maxHeight: `${maxHeight}px`
  }
}
function dismissOutside(event: Event) {
  const target = event.target as Node
  if (props.open && !panel.value?.contains(target) && !trigger.value?.contains(target)) emit('close')
}
function reposition(event: Event) {
  if (!panel.value?.contains(event.target as Node)) placePanel()
}
watch(() => props.open, async open => {
  if (!open) return
  search.value = ''
  await nextTick()
  placePanel()
  searchInput.value?.focus({ preventScroll: true })
})
watch(visibleOptions, async () => { await nextTick(); placePanel() })
onMounted(() => {
  document.addEventListener('pointerdown', dismissOutside)
  document.addEventListener('focusin', dismissOutside)
  window.addEventListener('resize', placePanel)
  window.addEventListener('scroll', reposition, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', dismissOutside)
  document.removeEventListener('focusin', dismissOutside)
  window.removeEventListener('resize', placePanel)
  window.removeEventListener('scroll', reposition, true)
})
</script>

<template>
  <button ref="trigger" type="button" class="io-filter-trigger" :class="{ 'is-active': modelValue.length }"
    :aria-label="`筛选${label}${modelValue.length ? `，已选 ${modelValue.length} 项` : ''}`"
    :aria-expanded="open" :aria-controls="`${id}-panel`" aria-haspopup="dialog"
    :title="summary || `筛选${label}（可多选）`" @click="emit('toggle')" @keydown.esc.prevent="closeAndFocus">
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M2 6h7m4 0h5M2 14h3m4 0h9" /><circle cx="11" cy="6" r="2" /><circle cx="7" cy="14" r="2" />
    </svg>
    <span>{{ modelValue.length ? `已选 ${modelValue.length} 项` : '全部' }}</span>
    <span class="io-filter-caret" aria-hidden="true">⌄</span>
  </button>
  <Teleport to="body">
    <div v-if="open" :id="`${id}-panel`" ref="panel" class="io-filter-panel" :style="position"
      role="dialog" :aria-label="`${label}多选筛选`" @keydown.esc.prevent.stop="closeAndFocus">
      <div class="io-filter-heading">
        <strong>{{ label }}<span>可多选</span></strong>
        <button type="button" class="io-filter-close" :aria-label="`关闭${label}筛选`" @click="closeAndFocus">×</button>
      </div>
      <div class="io-filter-search">
        <input ref="searchInput" v-model="search" type="search" :aria-label="`搜索${label}选项`"
          placeholder="搜索选项…" autocomplete="off" spellcheck="false">
      </div>
      <label class="io-filter-option io-filter-all">
        <input type="checkbox" :checked="allVisibleSelected"
          :indeterminate="selectedVisible > 0 && !allVisibleSelected" :disabled="!visibleOptions.length" @change="toggleAll">
        <span>{{ search.trim() ? '全选搜索结果' : '全选' }}</span>
      </label>
      <div class="io-filter-options" :aria-label="`${label}选项`">
        <label v-for="option in visibleOptions" :key="option.value" class="io-filter-option"
          :class="{ 'is-selected': modelValue.includes(option.value) }">
          <input type="checkbox" :checked="modelValue.includes(option.value)" :aria-label="option.label" @change="toggleValue(option.value)">
          <span>{{ option.label }}</span><span class="io-option-count" aria-hidden="true">{{ option.count }}</span>
        </label>
        <p v-if="!visibleOptions.length" class="io-filter-empty">没有匹配的选项</p>
      </div>
      <div class="io-filter-footer">
        <button type="button" :disabled="!modelValue.length && !search" @click="clear">清除此列筛选</button>
        <span>{{ modelValue.length ? `已选 ${modelValue.length} 项` : '不限' }}</span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.io-filter-trigger { display: flex; width: 100%; align-items: center; gap: 8px; min-height: 28px; color: var(--vp-c-text-2); font: inherit; font-size: 12px; font-weight: 400; cursor: pointer; }
.io-filter-trigger:hover, .io-filter-trigger[aria-expanded="true"], .io-filter-trigger.is-active { color: var(--vp-c-brand-1); }
.io-filter-trigger.is-active { font-weight: 600; }
.io-filter-caret { margin-left: auto; }
.io-filter-panel { position: fixed; z-index: 100; display: flex; flex-direction: column; box-sizing: border-box; width: min(310px, calc(100vw - 16px)); overflow: hidden; border: 1px solid var(--vp-c-divider); border-radius: 5px; background: var(--vp-c-bg); color: var(--vp-c-text-1); box-shadow: 0 8px 28px rgb(0 0 0 / 18%); font-family: var(--vp-font-family-base); font-size: 13px; line-height: 1.5; }
.io-filter-heading, .io-filter-footer { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; background: var(--vp-c-bg-soft); }
.io-filter-heading strong { font-size: 14px; }
.io-filter-heading strong span { margin-left: 10px; color: var(--vp-c-text-2); font-size: 12px; font-weight: 400; }
.io-filter-close { width: 26px; height: 26px; border-radius: 3px; font-size: 22px; line-height: 1; }
.io-filter-close:hover { background: var(--vp-c-bg-mute); }
.io-filter-search { flex: 0 0 auto; padding: 14px 16px 8px; }
.io-filter-search input { box-sizing: border-box; width: 100%; height: 34px; padding: 0 10px; border: 1px solid var(--vp-c-divider); border-radius: 3px; background: var(--vp-c-bg); color: var(--vp-c-text-1); font: inherit; }
.io-filter-search input::placeholder { color: var(--vp-c-text-3); }
.io-filter-options { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 4px 0; }
.io-filter-option { display: flex; align-items: center; gap: 10px; min-height: 36px; padding: 6px 16px; cursor: pointer; }
.io-filter-option:hover { background: var(--vp-c-bg-soft); }
.io-filter-option.is-selected { background: var(--vp-c-brand-soft); }
.io-filter-option input { flex: 0 0 auto; appearance: auto; width: 16px; height: 16px; margin: 0; accent-color: var(--vp-c-brand-1); cursor: pointer; }
.io-filter-all { flex: 0 0 auto; border-bottom: 1px solid var(--vp-c-divider); }
.io-option-count { margin-left: auto; color: var(--vp-c-text-3); font-size: 12px; font-variant-numeric: tabular-nums; }
.io-filter-footer { border-top: 1px solid var(--vp-c-divider); font-size: 12px; }
.io-filter-footer button { color: var(--vp-c-brand-1); }
.io-filter-footer span { color: var(--vp-c-text-2); }
.io-filter-panel button { cursor: pointer; }
.io-filter-panel button:disabled { color: var(--vp-c-text-3); cursor: default; }
.io-filter-empty { margin: 12px 16px; color: var(--vp-c-text-2); }
.io-filter-trigger:focus-visible, .io-filter-panel :is(button, input):focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
@media print { .io-filter-panel { display: none; } }
</style>
