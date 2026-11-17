<script setup lang="ts">
import { computed, ref } from 'vue'

type Pattern = {
  opacity: number
  animation?: {
    duration: string
    values: string
    keyTimes: string
    mode: 'discrete' | 'linear'
  }
}

const on: Pattern = { opacity: 1 }
const off: Pattern = { opacity: 0 }

function blink(...intervals: number[]): Pattern {
  const period = intervals.reduce((total, duration) => total + duration, 0)
  let elapsed = 0
  const keyTimes = [0, ...intervals.map(duration => {
    elapsed += duration
    return elapsed / period
  })]
  const values = intervals.map((_, index) => index % 2 === 0 ? 1 : 0)
  return {
    opacity: 0,
    animation: {
      duration: `${period}ms`,
      values: [...values, values[values.length - 1]].join(';'),
      keyTimes: keyTimes.join(';'),
      mode: 'discrete',
    },
  }
}

function breathe(period: number): Pattern {
  // Approximate the firmware's squared ramp with linear interpolation between samples.
  const frames = 20
  const phases = Array.from({ length: frames + 1 }, (_, index) => index / frames)
  return {
    opacity: 0,
    animation: {
      duration: `${period}ms`,
      values: phases.map(phase => ((1 - Math.abs(2 * phase - 1)) ** 2).toFixed(2)).join(';'),
      keyTimes: phases.join(';'),
      mode: 'linear',
    },
  }
}

const regular = blink(200, 200)
const singlePulse = blink(200, 1000)
const runOptions = [
  { label: 'INIT · IN 口有链路', pattern: breathe(2000) },
  { label: 'INIT · IN 口无链路', pattern: breathe(500) },
  { label: 'PREOP', pattern: regular },
  { label: 'SAFEOP', pattern: singlePulse },
  { label: 'OP', pattern: on },
  { label: 'BOOT / FoE', pattern: blink(50, 50) },
]
const errorOptions = [
  { label: '无 EtherCAT 错误', pattern: off },
  { label: '本地应用或同步错误', pattern: singlePulse },
  { label: 'PDO 看门狗超时 0x001B', pattern: blink(200, 200, 200, 1000) },
  { label: '其他 EtherCAT 状态错误', pattern: regular },
]

const run = ref(0)
const err = ref(0)
const playing = ref(true)
const lamps = computed(() => [
  { id: 'run', y: 287, color: '#61ec95', pattern: runOptions[run.value].pattern },
  { id: 'err', y: 406, color: '#ff646c', pattern: errorOptions[err.value].pattern },
])
</script>

<template>
  <div class="panel-demo">
    <div class="panel-drawing">
      <slot />
      <!-- Match the standalone faceplate's viewBox and LED window positions. -->
      <svg
        v-if="playing"
        :key="`${run}-${err}`"
        class="lamp-overlay"
        viewBox="0 0 332 730"
        aria-hidden="true"
      >
        <rect
          v-for="{ id, y, color, pattern } in lamps"
          :key="id"
          x="73"
          :y="y"
          width="10"
          height="9"
          rx="1"
          :fill="color"
          :opacity="pattern.opacity"
        >
          <animate
            v-if="pattern.animation"
            attributeName="opacity"
            :dur="pattern.animation.duration"
            :values="pattern.animation.values"
            :keyTimes="pattern.animation.keyTimes"
            :calcMode="pattern.animation.mode"
            repeatCount="indefinite"
          />
        </rect>
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
