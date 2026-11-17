<script setup lang="ts">
import { computed, ref } from 'vue'

type Pattern =
  | { kind: 'on' | 'off' }
  | { kind: 'breathe' | 'even' | 'single' | 'double'; periodMs: number }

const regular: Pattern = { kind: 'even', periodMs: 400 }
const singlePulse: Pattern = { kind: 'single', periodMs: 1200 }
const runOptions: { label: string; pattern: Pattern }[] = [
  { label: 'INIT · IN 口有链路', pattern: { kind: 'breathe', periodMs: 2000 } },
  { label: 'INIT · IN 口无链路', pattern: { kind: 'breathe', periodMs: 500 } },
  { label: 'PREOP', pattern: regular },
  { label: 'SAFEOP', pattern: singlePulse },
  { label: 'OP', pattern: { kind: 'on' } },
  { label: 'BOOT / FoE', pattern: { kind: 'even', periodMs: 100 } },
]
const errorOptions: { label: string; pattern: Pattern }[] = [
  { label: '无 EtherCAT 错误', pattern: { kind: 'off' } },
  { label: '本地应用或同步错误', pattern: singlePulse },
  { label: 'PDO 看门狗超时 0x001B', pattern: { kind: 'double', periodMs: 1600 } },
  { label: '其他 EtherCAT 状态错误', pattern: regular },
]

const run = ref(0)
const err = ref(0)
const playing = ref(true)
const lamps = computed(() => [
  { id: 'run', selection: run.value, y: 287, color: '#61ec95', pattern: runOptions[run.value].pattern },
  { id: 'err', selection: err.value, y: 406, color: '#ff646c', pattern: errorOptions[err.value].pattern },
])
</script>

<template>
  <div class="panel-demo">
    <div class="panel-drawing">
      <slot />
      <!-- Match the standalone faceplate's viewBox and LED window positions. -->
      <svg
        v-if="playing"
        class="lamp-overlay"
        viewBox="0 0 332 730"
        aria-hidden="true"
      >
        <rect
          v-for="{ id, selection, y, color, pattern } in lamps"
          :key="`${id}-${selection}`"
          class="lamp"
          :class="`lamp-${pattern.kind}`"
          :style="'periodMs' in pattern ? { animationDuration: `${pattern.periodMs}ms` } : undefined"
          x="73"
          :y="y"
          width="10"
          height="9"
          rx="1"
          :fill="color"
        />
      </svg>
    </div>
    <div class="panel-controls">
      <button type="button" aria-label="灯语演示" :aria-pressed="playing" @click="playing = !playing">
        <span>灯语演示</span>
        <span class="demo-action" aria-hidden="true">{{ playing ? '停止' : '播放' }}</span>
      </button>
      <label>
        <span><i class="lamp-dot run-dot" aria-hidden="true"></i>RUN · PWR/SYS</span>
        <select v-model="run">
          <option v-for="(option, index) in runOptions" :key="option.label" :value="index">
            {{ option.label }}
          </option>
        </select>
      </label>
      <label>
        <span><i class="lamp-dot err-dot" aria-hidden="true"></i>ERR · ERROR</span>
        <select v-model="err">
          <option v-for="(option, index) in errorOptions" :key="option.label" :value="index">
            {{ option.label }}
          </option>
        </select>
      </label>
    </div>
  </div>
</template>

<style scoped>
.panel-demo {
  display: grid;
  grid-template-columns: minmax(0, 264px) minmax(205px, 1fr);
  gap: 16px;
  align-items: center;
  margin: 20px 0;
  max-width: 550px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  padding: 12px;
}
.panel-drawing { position: relative; align-self: center; }
.panel-demo .panel-drawing :slotted(img) { display: block; width: 100%; height: auto; filter: none; }
.lamp-overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.lamp { opacity: 0; animation-iteration-count: infinite; animation-timing-function: steps(1, end); }
.lamp-on { opacity: 1; }
.lamp-even { animation-name: led-even; }
.lamp-single { animation-name: led-single; }
.lamp-double { animation-name: led-double; }
.lamp-breathe { animation-name: led-breathe; }

@keyframes led-even {
  0% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
@keyframes led-single {
  0% { opacity: 1; }
  16.666667%, 100% { opacity: 0; }
}
@keyframes led-double {
  0%, 25% { opacity: 1; }
  12.5%, 37.5%, 100% { opacity: 0; }
}
@keyframes led-breathe {
  0% { opacity: 0; animation-timing-function: ease-in; }
  50% { opacity: 1; animation-timing-function: ease-out; }
  100% { opacity: 0; }
}

.panel-controls {
  display: grid;
  gap: 15px;
  min-width: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 16px;
  background: var(--vp-c-bg);
  color-scheme: light dark;
}
.panel-controls label { display: grid; gap: 5px; font-size: 13px; font-weight: 600; }
.lamp-dot { display: inline-block; width: 8px; height: 8px; margin-right: 7px; border-radius: 2px; }
.run-dot { background: #269b63; }
.err-dot { background: #ce525a; }
.panel-controls select {
  appearance: auto;
  width: 100%;
  min-width: 0;
  min-height: 38px;
  padding: 6px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 5px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 13px;
}
.panel-controls button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 38px;
  padding: 6px 12px;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 5px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 16px;
  font-weight: 600;
}
.demo-action { font-size: 12px; }
.panel-controls button:hover { background: var(--vp-c-bg-soft); }
.panel-controls :is(select, button):focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
@media (max-width: 640px) {
  .panel-demo { grid-template-columns: minmax(0, 1fr); }
  .panel-drawing { width: 100%; max-width: 264px; }
}
@media print {
  .panel-demo { display: block; break-inside: avoid; }
  .panel-drawing { max-width: 264px; }
  .panel-controls, .lamp-overlay { display: none; }
}
</style>
