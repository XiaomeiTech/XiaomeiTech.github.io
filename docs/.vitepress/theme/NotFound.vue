<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const countdown = ref(3)

function goBack() {
  try {
    const ref = document.referrer
    if (ref && new URL(ref).origin === window.location.origin) {
      window.history.back()
      return
    }
  } catch {}
  window.location.href = window.location.origin + '/'
}

let timer
onMounted(() => {
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer)
      goBack()
    }
  }, 1000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="NotFound">
    <p class="code">404</p>
    <h1 class="title">前面的区域，以后再来探索吧！</h1>
    <div class="divider" />
    <blockquote class="quote">PAGE NOT FOUND</blockquote>

    <div class="action">
      <a class="link" @click="goBack()">返回上一页</a>
    </div>

    <p class="countdown">{{ countdown }} 秒后自动返回上一页</p>
  </div>
</template>

<style scoped>
.NotFound {
  padding: 64px 24px 96px;
  text-align: center;
}
@media (min-width: 768px) {
  .NotFound {
    padding: 96px 32px 168px;
  }
}
.code {
  line-height: 64px;
  font-size: 64px;
  font-weight: 600;
}
.title {
  padding-top: 12px;
  letter-spacing: 2px;
  line-height: 20px;
  font-size: 20px;
  font-weight: 700;
}
.divider {
  margin: 24px auto 18px;
  width: 64px;
  height: 1px;
  background-color: var(--vp-c-divider);
}
.quote {
  margin: 0 auto;
  max-width: 256px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}
.action {
  padding-top: 20px;
}
.link {
  display: inline-block;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 16px;
  padding: 3px 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
  cursor: pointer;
  transition: border-color 0.25s, color 0.25s;
}
.link:hover {
  border-color: var(--vp-c-brand-2);
  color: var(--vp-c-brand-2);
}
.countdown {
  margin-top: 18px;
  font-size: 13px;
  color: var(--vp-c-text-3);
}
</style>
