<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { withBase } from 'vitepress'
import { ioModules, isPerformanceModule, moduleCategories, productStatuses, type IoModule, type ModuleCategory } from './ioModules'
import ModuleBadge from './ModuleBadge.vue'
import IoColumnFilter from './IoColumnFilter.vue'

type ColumnKey = 'model' | 'category' | 'channels' | 'signal' | 'speed' | 'status'
const props = defineProps<{ category?: ModuleCategory }>()
const columns: { key: ColumnKey; label: string }[] = [
  { key: 'model', label: '型号' },
  { key: 'category', label: '模块类型' },
  { key: 'channels', label: '通道数' },
  { key: 'signal', label: '信号 / 协议' },
  { key: 'speed', label: '性能型' },
  { key: 'status', label: '产品状态' }
]
const emptyFilters = (): Record<ColumnKey, string[]> => ({ model: [], category: [], channels: [], signal: [], speed: [], status: [] })
const filters = ref(emptyFilters())
const activeFilter = ref<ColumnKey | null>(null)
const sortKey = ref<ColumnKey>('model')
const descending = ref(false)
const baseRows = computed(() => ioModules.filter(row => !props.category || row.category === props.category))
const hasFilters = computed(() => columns.some(column => filters.value[column.key].length))
const categoryLabel = (category: ModuleCategory) => `${category} ${moduleCategories.find(item => item.value === category)?.label}`
const performanceLabel = (row: IoModule) => isPerformanceModule(row) ? '性能型' : '-'
function valueFor(row: IoModule, key: ColumnKey): string {
  if (key === 'channels') return row.channels === undefined ? 'none' : String(row.channels)
  if (key === 'speed') return performanceLabel(row)
  return row[key]
}
function matches(row: IoModule, except?: ColumnKey) {
  // OR within a column; AND across columns. Empty selections leave a column unrestricted.
  return columns.every(({ key }) => key === except || !filters.value[key].length || filters.value[key].includes(valueFor(row, key)))
}
const options = computed(() => Object.fromEntries(columns.map(({ key }) => {
  const values = key === 'status' ? [...productStatuses]
    : key === 'category' ? moduleCategories.filter(item => baseRows.value.some(row => row.category === item.value)).map(item => item.value)
    : [...new Set(baseRows.value.map(row => valueFor(row, key)))].sort((a, b) => {
      if (key === 'channels') return (a === 'none' ? Infinity : Number(a)) - (b === 'none' ? Infinity : Number(b))
      return a.localeCompare(b, 'zh-CN', { numeric: true })
    })
  const candidates = baseRows.value.filter(row => matches(row, key))
  return [key, values.map(value => ({
    value,
    label: key === 'category' ? categoryLabel(value as ModuleCategory)
      : key === 'channels' ? value === 'none' ? '—（耦合器）' : `${value} 通道${value === '8' ? '（含 4+4）' : ''}`
      : value,
    count: candidates.filter(row => valueFor(row, key) === value).length
  }))]
})) as Record<ColumnKey, { value: string; label: string; count: number }[]>)
const rows = computed(() => baseRows.value.filter(row => matches(row)).sort((a, b) => {
  let order: number
  if (sortKey.value === 'channels') {
    // Keep couplers without a channel count at the end in either direction.
    if (a.channels === undefined || b.channels === undefined) return (a.channels === undefined ? 1 : 0) - (b.channels === undefined ? 1 : 0) || a.model.localeCompare(b.model)
    order = a.channels - b.channels
  } else if (sortKey.value === 'status') {
    order = productStatuses.indexOf(a.status) - productStatuses.indexOf(b.status)
  } else {
    order = valueFor(a, sortKey.value).localeCompare(valueFor(b, sortKey.value), 'zh-CN', { numeric: true })
  }
  return (descending.value ? -order : order) || a.model.localeCompare(b.model)
}))
function sortBy(key: ColumnKey) {
  descending.value = sortKey.value === key ? !descending.value : false
  sortKey.value = key
}
function chooseCategory(category?: ModuleCategory) {
  filters.value.category = category ? [category] : []
}
function reset() {
  filters.value = emptyFilters()
  activeFilter.value = null
}
watch(() => props.category, () => { reset(); sortKey.value = 'model'; descending.value = false })
</script>

<template>
  <section class="io-selection" aria-label="耦合器与扩展模块选型表">
    <div v-if="!props.category" class="io-categories" role="group" aria-label="模块类型快捷筛选">
      <button type="button" :aria-pressed="!filters.category.length" @click="chooseCategory()">
        全部产品 <span>{{ baseRows.length }}</span>
      </button>
      <button v-for="item in moduleCategories" :key="item.value" type="button"
        :data-module-kind="item.value" :aria-pressed="filters.category.includes(item.value)" @click="chooseCategory(item.value)">
        <ModuleBadge :kind="item.value" compact /> <span class="io-category-name">{{ item.label }}</span>
        <span>{{ baseRows.filter(row => row.category === item.value).length }}</span>
      </button>
    </div>

    <div class="io-table-meta">
      <span role="status" aria-live="polite">显示 <strong>{{ rows.length }}</strong> / {{ baseRows.length }} 个型号</span>
      <span v-if="!props.category" class="io-filter-hint">点击表头下方筛选，可多选</span>
      <button v-if="!props.category" type="button" class="io-reset" :disabled="!hasFilters" @click="reset">清除全部筛选</button>
      <a :href="withBase('/pexus/edge/Expansion/#产品命名规则')">型号命名规则 ↗</a>
    </div>

    <div class="io-table-scroll" role="region" aria-label="产品参数表，可横向滚动" tabindex="0">
      <table class="io-table">
        <caption>IM 耦合器与 EM 背板总线扩展模块选型表</caption>
        <thead>
          <tr>
            <th v-for="column in columns" :key="column.key" scope="col"
              :aria-sort="sortKey === column.key ? descending ? 'descending' : 'ascending' : 'none'">
              <button type="button" class="io-sort" :aria-label="`${column.label}：点击${sortKey === column.key && !descending ? '降序' : '升序'}排列`" @click="sortBy(column.key)">
                {{ column.label }} <span aria-hidden="true">{{ sortKey === column.key ? descending ? '↓' : '↑' : '↕' }}</span>
              </button>
            </th>
          </tr>
          <tr v-if="!props.category" class="io-column-filters">
            <td v-for="column in columns" :key="column.key">
              <IoColumnFilter v-model="filters[column.key]" :label="column.label" :options="options[column.key]" :open="activeFilter === column.key"
                @toggle="activeFilter = activeFilter === column.key ? null : column.key" @close="activeFilter = null" />
            </td>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.model" :data-module-kind="row.category" :data-performance="isPerformanceModule(row)">
            <th scope="row" class="io-model"><a :href="withBase(row.href || `/pexus/edge/${row.category}/${row.model}.html`)"><ModuleBadge v-if="row.category === 'IM'" kind="IM" :protocol="row.protocol" :label="row.model" /><template v-else>{{ row.model }}</template></a></th>
            <td><span class="io-type"><ModuleBadge v-if="row.category === 'IM'" kind="IM" :label="categoryLabel(row.category)" /><a v-else :href="withBase(`/pexus/edge/${row.category}/`)"><ModuleBadge :kind="row.category" :label="categoryLabel(row.category)" /></a></span></td>
            <td><span v-if="row.channels" class="channel-badge" :data-channels="row.channels" :title="row.channelLabel ? '4 路电流 + 4 路电压，共 8 通道' : undefined">{{ row.channelLabel || row.channels }}</span><span v-else class="io-not-applicable">—</span></td>
            <td>{{ row.signal }}</td>
            <td>{{ performanceLabel(row) }}</td>
            <td><span class="io-product-status" :data-product-status="row.status">{{ row.status }}</span></td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="6" class="io-empty">没有符合条件的型号。<button type="button" @click="reset">清除全部筛选</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.io-selection { margin: 24px 0 32px; font-size: 14px; }
.io-categories { display: flex; flex-wrap: wrap; gap: 0 20px; border-bottom: 1px solid var(--vp-c-divider); }
.io-categories button { display: inline-flex; align-items: center; gap: 7px; padding: 13px 0; border-bottom: 3px solid transparent; color: var(--vp-c-text-2); font-weight: 600; }
.io-categories button[aria-pressed="true"] { border-color: var(--module-color, var(--vp-c-text-1)); color: var(--vp-c-text-1); }
.io-categories button:hover { color: var(--vp-c-text-1); }
.io-category-name { font-size: 13px; }
.io-categories button > span:last-child { margin-left: 6px; font-size: 12px; color: var(--vp-c-text-2); }
.io-reset { color: var(--vp-c-brand-1); white-space: nowrap; }
.io-reset:disabled { color: var(--vp-c-text-3); cursor: default; }
.io-selection button { cursor: pointer; }
.io-selection :is(button, .io-table-scroll):focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
.io-table-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 18px; margin: 18px 0 10px; color: var(--vp-c-text-2); font-size: 13px; }
.io-table-meta strong { color: var(--vp-c-text-1); }
.io-table-meta a { margin-left: auto; font-weight: 400; text-decoration: none; }
.io-filter-hint { color: var(--vp-c-text-3); font-size: 12px; }
.io-table-scroll { overflow-x: auto; border: 1px solid var(--vp-c-divider); border-radius: 6px; }
.io-table { display: table; width: 100%; min-width: 800px; margin: 0; border-collapse: collapse; font-size: 14px; }
.io-table caption { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.io-table tr { border: 0; background: var(--vp-c-bg); }
.io-table th, .io-table td { padding: 12px 14px; border: 0; border-bottom: 1px solid var(--vp-c-divider); text-align: left; white-space: nowrap; }
.io-table tbody tr[data-module-kind] > * { background: color-mix(in srgb, var(--module-color) 3%, var(--vp-c-bg)); }
.io-table thead th { background: var(--vp-c-bg-soft); font-size: 13px; font-weight: 600; }
.io-sort { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 12px; font: inherit; }
.io-sort span { color: var(--vp-c-brand-1); }
.io-table .io-column-filters td { padding: 5px 14px; background: var(--vp-c-bg-soft); }
.io-table tbody tr:last-child > * { border-bottom: 0; }
.io-table tbody tr:hover > * { background: color-mix(in srgb, var(--module-color) 9%, var(--vp-c-bg)); }
.io-table tbody tr[data-performance="true"] {
  --performance-tint: 26%;
  background: linear-gradient(90deg, color-mix(in srgb, var(--module-color) var(--performance-tint), transparent) 0%, transparent 20%) var(--vp-c-bg);
}
.io-table tbody tr[data-performance="true"] > * { background: transparent; }
.io-table tbody tr[data-performance="true"]:hover { --performance-tint: 38%; }
:global(.dark .io-table tbody tr[data-performance="true"]) { --performance-tint: 42%; }
:global(.dark .io-table tbody tr[data-performance="true"]:hover) { --performance-tint: 56%; }
.io-model { box-shadow: inset 5px 0 var(--module-color); font-family: var(--vp-font-family-mono); font-weight: 600; }
.io-model a { color: var(--vp-c-text-1); }
.io-table tr[data-module-kind="IM"] .io-model { box-shadow: inset 8px 0 var(--module-color); }
.io-not-applicable { color: var(--vp-c-text-3); }
.io-type { display: inline-flex; align-items: center; }
.io-type :deep(.module-badge) { min-width: 116px; justify-content: flex-start; }
.io-table a { text-decoration: none; }
.io-table a:hover { text-decoration: underline; }
.io-table a:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
.io-table .io-empty { padding: 40px 16px; text-align: center; color: var(--vp-c-text-2); }
.io-empty button { margin-left: 8px; color: var(--vp-c-brand-1); text-decoration: underline; }
.io-product-status { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border: 1px solid; border-radius: 4px; font-size: 12px; font-weight: 600; line-height: 22px; }
.io-product-status::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
[data-product-status="未发布"] { background: #f0f1f3; color: #5a6472; border-color: #d5d9df; }
[data-product-status="预发布"] { background: #eaf2ff; color: #245ca6; border-color: #bfd4f4; }
[data-product-status="正在供货"] { background: #e6f5eb; color: #21653a; border-color: #b9dcc5; }
[data-product-status="不推荐新设计"] { background: #fff4df; color: #8a4b00; border-color: #ecd4aa; }
:global(.dark [data-product-status="未发布"]) { background: #2b2e34; color: #c6cbd2; border-color: #515761; }
:global(.dark [data-product-status="预发布"]) { background: #1c2e48; color: #a9cbff; border-color: #385a87; }
:global(.dark [data-product-status="正在供货"]) { background: #1d3527; color: #9bd6af; border-color: #3b654a; }
:global(.dark [data-product-status="不推荐新设计"]) { background: #382b19; color: #f3ca78; border-color: #68502e; }
@media (max-width: 640px) {
  .io-categories { gap: 0 18px; }
  .io-category-name, .io-filter-hint { display: none; }
}
@media print {
  .io-categories, .io-column-filters, .io-table-meta a, .io-reset, .io-filter-hint { display: none; }
  .io-table-scroll { overflow: visible; }
  .io-table { min-width: 0; font-size: 11px; }
  .io-table th, .io-table td { padding: 6px; }
  .io-product-status, .io-table tbody tr[data-performance="true"] { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
</style>
