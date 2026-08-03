<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

import ethercatImage from '../../../../markdown/img/EM7230L.jpg'
import profinetImage from '../../../../markdown/img/RemoteIO.jpg'
import ethernetipImage from '../../../../markdown/img/RemoteIO-BP.jpg'
import modbusImage from '../../../../markdown/img/PE1637.jpg'
import feederImage from '../../../../markdown/img/CM-SC15124-N.jpg'
import customImage from '../../../../markdown/img/WH-DB15.jpg'

const solutions = [
  {
    icon: 'ecat',
    title: 'EtherCAT 远程IO',
    subtitle: '高性能实时工业以太网',
    description: '支持EtherCAT总线协议，微秒级实时响应，适配倍福、欧姆龙、ACS等主流PLC与运动控制器，为高速高精设备提供确定性通讯。',
    href: '/remoteIO/EtherCAT/',
    src: ethercatImage
  },
  {
    icon: 'pn',
    title: 'PROFINET 远程IO',
    subtitle: '西门子生态无缝集成',
    description: '兼容PROFINET RT/IRT协议，支持TIA Portal快速组态与诊断，适配S7-1200/1500等西门子全系列PLC，即插即用。',
    href: '/remoteIO/PROFINET/',
    src: profinetImage
  },
  {
    icon: 'eip',
    title: 'EtherNet/IP 远程IO',
    subtitle: '罗克韦尔生态兼容',
    description: '适配ControlLogix、CompactLogix等罗克韦尔PLC，CIP协议无缝对接，支持显式报文与隐式IO数据交换。',
    href: '/remoteIO/EtherNetIP/',
    src: ethernetipImage
  },
  {
    icon: 'mb',
    title: 'Modbus 远程IO',
    subtitle: '经典工业协议广泛适配',
    description: '支持Modbus TCP与Modbus RTU双模式，兼容主流HMI、SCADA与各类PLC，部署简单、运维便捷。',
    href: '/remoteIO/Modbus/',
    src: modbusImage
  },
  {
    icon: 'fc',
    title: '飞达控制器',
    subtitle: '高速供料与节拍控制',
    description: '采用FOC矢量控制算法，提供速度闭环与位置闭环控制，适配有感无刷滚筒电机，面向SMT供料与物流分拣场景。',
    href: '/feeder-controller/',
    src: feederImage
  },
  {
    icon: 'custom',
    title: '定制项目',
    subtitle: '一站式硬件定制解决方案',
    description: '从电路设计、嵌入式固件到结构开发，快速响应个性化需求，覆盖工业自动化、精密制造及复杂控制系统的全链路定制。',
    href: '/custom/',
    src: customImage
  }
]

const scrollContainer = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(true)
const cardWidth = 384 // base card width
const cardGap = 16 // gap between cards (2 × 8px margin)
const scrollStep = cardWidth + cardGap

function updateArrowState() {
  const el = scrollContainer.value
  if (!el) return
  canScrollLeft.value = el.scrollLeft > 2
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
}

function scrollNext() {
  const el = scrollContainer.value
  if (!el) return
  el.scrollBy({ left: scrollStep, behavior: 'smooth' })
}

function scrollPrev() {
  const el = scrollContainer.value
  if (!el) return
  el.scrollBy({ left: -scrollStep, behavior: 'smooth' })
}

let scrollTimer: ReturnType<typeof setTimeout> | undefined

function onScroll() {
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = setTimeout(updateArrowState, 50)
}

onMounted(() => {
  scrollContainer.value?.addEventListener('scroll', onScroll, { passive: true })
  updateArrowState()
})

onBeforeUnmount(() => {
  scrollContainer.value?.removeEventListener('scroll', onScroll)
  if (scrollTimer) clearTimeout(scrollTimer)
})
</script>

<template>
  <section class="xm-solutions">
    <div class="xm-solutions-inner">
      <h2 class="xm-solutions-title">覆盖工业现场核心场景</h2>
    </div>

    <div class="xm-solutions-scroll-area">
      <div class="xm-solutions-inner">
        <div ref="scrollContainer" class="xm-solutions-track">
          <a
            v-for="item in solutions"
            :key="item.title"
            class="xm-solution-card"
            :href="item.href"
          >
            <div class="xm-solution-card-inner">
              <!-- top info area -->
              <div class="xm-solution-info">
                <!-- icon -->
                <svg class="xm-solution-icon" viewBox="0 0 32 32" fill="none">
                  <template v-if="item.icon === 'ecat'">
                    <rect x="2" y="7" width="28" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
                    <path d="M10 13h4v6h-4zM17 13h5v6h-5z" fill="currentColor" opacity="0.7"/>
                    <line x1="2" y1="21" x2="30" y2="21" stroke="currentColor" stroke-width="1.5"/>
                  </template>
                  <template v-else-if="item.icon === 'pn'">
                    <circle cx="16" cy="16" r="13" stroke="currentColor" stroke-width="2" fill="none"/>
                    <path d="M16 3v12l10 6" stroke="currentColor" stroke-width="2" fill="none"/>
                    <circle cx="16" cy="16" r="4" fill="currentColor" opacity="0.7"/>
                  </template>
                  <template v-else-if="item.icon === 'eip'">
                    <rect x="2" y="4" width="28" height="24" rx="3" stroke="currentColor" stroke-width="2" fill="none"/>
                    <path d="M8 12h16M8 17h12M8 22h8" stroke="currentColor" stroke-width="2"/>
                  </template>
                  <template v-else-if="item.icon === 'mb'">
                    <rect x="3" y="6" width="26" height="20" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
                    <circle cx="10" cy="14" r="2" fill="currentColor"/>
                    <circle cx="16" cy="14" r="2" fill="currentColor"/>
                    <circle cx="22" cy="14" r="2" fill="currentColor"/>
                    <circle cx="10" cy="20" r="2" fill="currentColor"/>
                    <circle cx="16" cy="20" r="2" fill="currentColor"/>
                    <circle cx="22" cy="20" r="2" fill="currentColor"/>
                  </template>
                  <template v-else-if="item.icon === 'fc'">
                    <circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="2" fill="none"/>
                    <circle cx="16" cy="16" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/>
                    <path d="M16 8v4M16 20v4M8 16h4M20 16h4" stroke="currentColor" stroke-width="2"/>
                    <circle cx="16" cy="16" r="2.5" fill="currentColor"/>
                  </template>
                  <template v-else-if="item.icon === 'custom'">
                    <rect x="4" y="2" width="24" height="28" rx="3" stroke="currentColor" stroke-width="2" fill="none"/>
                    <path d="M4 8h24" stroke="currentColor" stroke-width="2"/>
                    <path d="M12 14l3 3 5-5" stroke="currentColor" stroke-width="2" fill="none"/>
                    <line x1="10" y1="22" x2="22" y2="22" stroke="currentColor" stroke-width="2" opacity="0.6"/>
                  </template>
                </svg>
                <h3 class="xm-solution-card-title">{{ item.title }}</h3>
                <h4 class="xm-solution-card-subtitle">{{ item.subtitle }}</h4>
                <p class="xm-solution-card-desc">{{ item.description }}</p>
              </div>
              <!-- image area -->
              <div class="xm-solution-card-image">
                <img :src="item.src" :alt="item.title" loading="lazy" decoding="async" />
              </div>
            </div>
          </a>
        </div>

        <!-- prev arrow -->
        <button
          class="xm-solutions-arrow xm-solutions-arrow-left"
          :class="{ 'xm-solutions-arrow-hidden': !canScrollLeft }"
          type="button"
          title="上一个"
          @click="scrollPrev"
        >
          <svg viewBox="0 0 24 24" fill="none"><path d="M15 4l-8 8 8 8" stroke="currentColor" stroke-width="2.5" fill="none"/></svg>
        </button>

        <!-- next arrow -->
        <button
          class="xm-solutions-arrow xm-solutions-arrow-right"
          :class="{ 'xm-solutions-arrow-hidden': !canScrollRight }"
          type="button"
          title="下一个"
          @click="scrollNext"
        >
          <svg viewBox="0 0 24 24" fill="none"><path d="M9 4l8 8-8 8" stroke="currentColor" stroke-width="2.5" fill="none"/></svg>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ---- section ---- */
.xm-solutions {
  width: 100%;
  overflow: hidden;
  background: var(--vp-c-bg);
  margin-top: 16px;
}

.xm-solutions-inner {
  max-width: 1264px;
  margin: 0 auto;
  padding: 0 24px;
}

.xm-solutions-title {
  margin: 0;
  padding: 64px 0 48px;
  font-size: 32px;
  font-weight: 600;
  line-height: 1;
  color: var(--vp-c-text-1);
}

/* ---- scroll area ---- */
.xm-solutions-scroll-area {
  position: relative;
  width: 100%;
  margin-bottom: 64px;
}

.xm-solutions-scroll-area .xm-solutions-inner {
  position: relative;
}

/* ---- track ---- */
.xm-solutions-track {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 8px;
}

.xm-solutions-track::-webkit-scrollbar {
  display: none;
}

/* ---- card ---- */
.xm-solution-card {
  flex: 0 0 384px;
  width: 384px;
  height: 574px;
  border-radius: 12px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  scroll-snap-align: start;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

.xm-solution-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.1);
}

.xm-solution-card-inner {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ---- info (top section) ---- */
.xm-solution-info {
  background: var(--vp-c-bg-soft);
  padding: 32px;
  color: var(--vp-c-text-1);
  flex-shrink: 0;
  transition: background 0.3s;
}

.xm-solution-card:hover .xm-solution-info {
  background: var(--vp-c-bg-alt);
}

.xm-solution-icon {
  width: 32px;
  height: 32px;
  color: var(--vp-c-brand-1);
}

.xm-solution-card-title {
  margin: 32px 0 0;
  font-size: 28px;
  font-weight: 600;
  line-height: 1.2;
}

.xm-solution-card-subtitle {
  margin: 20px 0 0;
  font-size: 16px;
  font-weight: 400;
  line-height: 1;
  color: var(--vp-c-text-2);
}

.xm-solution-card-desc {
  margin: 20px 0 0;
  font-size: 14px;
  line-height: 22px;
  color: var(--vp-c-text-2);
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition: max-height 0.8s ease, opacity 0.8s ease, margin 0.8s ease;
}

.xm-solution-card:hover .xm-solution-card-desc {
  max-height: 150px;
  opacity: 1;
}

/* ---- image area ---- */
.xm-solution-card-image {
  flex: 0 0 390px;
  overflow: hidden;
}

.xm-solution-card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.5s ease;
}

/* ---- arrows ---- */
.xm-solutions-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.3s, background 0.3s, transform 0.3s;
  color: var(--vp-c-text-1);
}

.xm-solutions-arrow:hover {
  background: var(--vp-c-bg-alt);
  border-color: var(--vp-c-brand-1);
}

.xm-solutions-arrow svg {
  width: 24px;
  height: 24px;
}

.xm-solutions-arrow-left {
  right: 80px;
}

.xm-solutions-arrow-right {
  right: 24px;
}

.xm-solutions-arrow-hidden {
  opacity: 0;
  pointer-events: none;
}

/* ---- responsive ---- */
@media (max-width: 960px) {
  .xm-solutions-inner {
    padding: 0 16px;
  }

  .xm-solutions-title {
    font-size: 24px;
    padding: 40px 0 32px;
  }

  .xm-solution-card {
    flex: 0 0 300px;
    width: 300px;
    height: 460px;
  }

  .xm-solution-info {
    padding: 24px;
  }

  .xm-solution-card-title {
    font-size: 22px;
    margin-top: 24px;
  }

  .xm-solution-card-subtitle {
    font-size: 14px;
    margin-top: 16px;
  }

  .xm-solution-card-desc {
    font-size: 13px;
  }

  .xm-solutions-arrow {
    display: none;
  }
}

@media (max-width: 640px) {
  .xm-solution-card {
    flex: 0 0 260px;
    width: 260px;
    height: 400px;
  }

  .xm-solution-info {
    padding: 20px;
  }

  .xm-solution-card-title {
    font-size: 18px;
    margin-top: 20px;
  }

  .xm-solution-card-subtitle {
    font-size: 13px;
    margin-top: 12px;
  }
}
</style>
