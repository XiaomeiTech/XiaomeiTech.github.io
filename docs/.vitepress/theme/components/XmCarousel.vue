<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const slides = [
  {
    src: new URL('../../../../markdown/img/CM-SC15124-N.jpg', import.meta.url).href,
    label: '飞达控制器',
    title: '飞达控制器',
    description: '面向高速供料与节拍控制场景，提供稳定的运动协同与现场联动能力。',
    ctaText: '查看飞达控制器',
    href: '/feeder-controller/'
  },
  {
    src: new URL('../../../../markdown/img/EM7230L.jpg', import.meta.url).href,
    label: '定制远程IO系统',
    title: '定制远程IO系统',
    description: '支持协议转换、远程采集与模块化扩展，适配复杂产线和分布式设备。',
    ctaText: '查看远程IO',
    href: '/remoteIO/'
  },
  {
    src: new URL('../../../../markdown/img/RemoteIO.jpg', import.meta.url).href,
    label: '远程IO系统',
    title: '远程IO系统',
    description: '帮助现场设备快速联网、统一采集与数据上送，便于系统集成与可视化。',
    ctaText: '查看定制项目',
    href: '/custom/'
  }
]

const current = ref(0)
const progress = ref(0)
const duration = 4000
const paused = ref(false)

let progressTimer: number | undefined
let advanceTimer: number | undefined
let lastStartedAt = 0
let elapsedBeforePause = 0

function clearTimers() {
  if (progressTimer !== undefined) window.clearInterval(progressTimer)
  if (advanceTimer !== undefined) window.clearTimeout(advanceTimer)
  progressTimer = undefined
  advanceTimer = undefined
}

function scheduleAdvance() {
  advanceTimer = window.setTimeout(() => {
    next()
  }, duration)
}

function startProgress() {
  clearTimers()
  lastStartedAt = Date.now()
  progressTimer = window.setInterval(() => {
    const elapsed = elapsedBeforePause + (Date.now() - lastStartedAt)
    progress.value = Math.min(100, (elapsed / duration) * 100)
    if (elapsed >= duration) {
      next()
    }
  }, 50)
  scheduleAdvance()
}

function syncSlide(index: number) {
  current.value = (index + slides.length) % slides.length
  progress.value = 0
  elapsedBeforePause = 0
  startProgress()
}

function next() {
  syncSlide(current.value + 1)
}

function prev() {
  syncSlide(current.value - 1)
}

function goTo(index: number) {
  syncSlide(index)
}

function pause() {
  if (paused.value) return
  paused.value = true
  elapsedBeforePause += Date.now() - lastStartedAt
  clearTimers()
}

function resume() {
  if (!paused.value) return
  paused.value = false
  startProgress()
}

onMounted(() => {
  startProgress()
})

onBeforeUnmount(() => {
  clearTimers()
})
</script>

<template>
  <div class="xm-carousel" @mouseenter="pause" @mouseleave="resume">
    <div class="xm-slides">
      <div
        v-for="(slide, index) in slides"
        :key="slide.label"
        class="xm-slide"
        :class="{ 'is-active': index === current }"
      >
        <img :src="slide.src" :alt="slide.label" />
        <div class="xm-content">
          <h2 class="xm-title">{{ slide.title }}</h2>
          <p class="xm-desc">{{ slide.description }}</p>
          <a class="xm-cta" :href="slide.href">{{ slide.ctaText }}</a>
        </div>
      </div>
    </div>

    <button class="xm-chevron xm-prev" type="button" aria-label="Previous slide" @click="prev">‹</button>
    <button class="xm-chevron xm-next" type="button" aria-label="Next slide" @click="next">›</button>

    <div class="xm-progress" aria-label="Carousel progress">
      <button
        v-for="(slide, index) in slides"
        :key="slide.label"
        class="xm-item"
        type="button"
        :class="{ active: index === current }"
        @click="goTo(index)"
      >
        <span class="xm-label">{{ slide.label }}</span>
        <span class="xm-bar">
          <span
            class="xm-fill"
            :style="{ width: index === current ? `${progress}%` : index < current ? '100%' : '0%' }"
          />
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.xm-carousel {
  position: relative;
  max-width: 100%;
  overflow: hidden;
  border-radius: 6px;
  margin: 12px 0;
}

.xm-slides {
  position: relative;
  aspect-ratio: 16 / 9;
  min-height: 240px;
  max-height: 720px;
}

.xm-slide {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.45s ease;
}

.xm-slide.is-active {
  opacity: 1;
}

.xm-slide img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.xm-slide::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.18) 46%, rgba(0, 0, 0, 0.02) 100%);
  pointer-events: none;
}

.xm-content {
  position: absolute;
  left: 64px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  max-width: 520px;
  color: #fff;
}

.xm-title {
  margin: 0 0 14px;
  font-size: 54px;
  line-height: 1.08;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.xm-desc {
  margin: 0 0 24px;
  font-size: 18px;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.92);
  max-width: 46ch;
}

.xm-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 20px;
  border: 1px solid rgba(255, 255, 255, 0.9);
  color: #fff;
  text-decoration: none;
  font-size: 14px;
  font-weight: 700;
  background: rgba(0, 0, 0, 0.18);
  transition: background 0.2s ease, transform 0.2s ease;
}

.xm-cta:hover {
  background: rgba(0, 0, 0, 0.32);
  transform: translateY(-1px);
}

.xm-chevron {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 0;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 5;
  user-select: none;
}

.xm-chevron:hover {
  background: rgba(0, 0, 0, 0.7);
}

.xm-prev {
  left: 12px;
}

.xm-next {
  right: 12px;
}

.xm-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 18px;
  display: flex;
  gap: 50px;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  z-index: 4;
}

.xm-item {
  flex: 0 1 150px;
  max-width: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  user-select: none;
}

.xm-label {
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  letter-spacing: 0.08em;
  line-height: 1.2;
}

.xm-bar {
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.25);
  position: relative;
  overflow: hidden;
  border-radius: 4px;
}

.xm-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 0;
  background: linear-gradient(90deg, #fff, #ff3030);
}

.xm-item.active .xm-label {
  color: #fff;
}

@media (max-width: 720px) {
  .xm-slides {
    min-height: 180px;
  }

  .xm-content {
    left: 18px;
    right: 18px;
    max-width: none;
  }

  .xm-title {
    font-size: 28px;
    margin-bottom: 8px;
  }

  .xm-desc {
    font-size: 13px;
    margin-bottom: 14px;
  }

  .xm-cta {
    min-height: 38px;
    padding: 0 14px;
    font-size: 13px;
  }

  .xm-progress {
    gap: 8px;
    padding: 0 12px;
  }

  .xm-item {
    flex: 1;
    max-width: none;
  }

  .xm-label {
    display: none;
  }
}
</style>
