---
layout: page
title: 贴纸试贴
---
<script setup>
import { computed, ref } from 'vue'
import Editor from '../../docs/.vitepress/theme/components/ModelMaterialEditor.vue'
import { modelLabProfiles } from '../../docs/.vitepress/theme/components/modelLabProfiles'
const count = ref(2)
const profile = computed(() => ({ ...modelLabProfiles[count.value - 1], id: count.value === 1 ? 'sticker-qa' : 'sticker-qa-dual', storageKey: count.value === 1 ? 'xm-sticker-qa-20260922' : 'xm-sticker-qa-dual-20260922' }))
</script>
<Editor :key="profile.id" :profile="profile">
  <template #model-select>
    <div style="margin-bottom:24px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <label>试贴模型 <select v-model.number="count" style="padding:8px;border:1px solid var(--vp-c-divider);border-radius:6px"><option :value="1">单连接器</option><option :value="2">双连接器</option></select></label>
      <span style="font-size:12px;color:var(--vp-c-text-2)">选择或拖入 SVG / 图片，单、双连接器分别保存试贴配置。</span>
    </div>
  </template>
</Editor>
