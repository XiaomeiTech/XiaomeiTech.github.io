<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ModelMaterialEditor from './ModelMaterialEditor.vue'
import { modelLabProfiles } from './modelLabProfiles'

const selectedModel = ref(modelLabProfiles[0].id)
const profile = computed(() => modelLabProfiles.find(p => p.id === selectedModel.value) || modelLabProfiles[0])
onMounted(() => {
  const requested = new URL(window.location.href).searchParams.get('model')
  if (modelLabProfiles.some(p => p.id === requested)) selectedModel.value = requested!
})
function selectModel(event: Event) {
  selectedModel.value = (event.target as HTMLSelectElement).value
  const url = new URL(window.location.href)
  url.searchParams.set('model', selectedModel.value)
  window.history.replaceState(window.history.state, '', url)
}
</script>

<template>
  <ModelMaterialEditor :key="`${profile.id}:${profile.revision || ''}`" :profile="profile">
    <template #model-select>
      <section class="model-picker" aria-label="测试模型">
        <div class="model-choice">
          <label for="test-model">测试模型</label>
          <select id="test-model" :value="selectedModel" @change="selectModel">
            <option v-for="model in modelLabProfiles" :key="model.id" :value="model.id">{{ model.title }}</option>
          </select>
        </div>
        <p>{{ profile.note }}<br /><span>每个版本分别保存材质、日夜光照与贴纸。</span></p>
      </section>
    </template>
  </ModelMaterialEditor>
</template>

<style scoped>
.model-picker { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 24px; margin-bottom: 24px; padding: 18px 20px; border: 1px solid var(--vp-c-divider); border-radius: 10px; background: var(--vp-c-bg-soft); }
.model-choice { min-width: 250px; }
label { display: block; margin-bottom: 7px; font-size: 12px; color: var(--vp-c-text-2); }
select { width: 100%; min-height: 42px; padding: 7px 12px; border: 1px solid var(--vp-c-divider); border-radius: 6px; background: var(--vp-c-bg); color: var(--vp-c-text-1); font-size: 14px; }
select:focus-visible, a:focus-visible { outline: 2px solid #bd6657; outline-offset: 3px; }
p { flex: 1; margin: 0; font-size: 12px; line-height: 1.8; color: var(--vp-c-text-2); }
p span { color: var(--vp-c-text-3); }
a { color: var(--vp-c-brand-1); font-size: 13px; white-space: nowrap; }
@media (max-width: 600px) { .model-picker { padding: 15px; gap: 12px; } .model-choice { width: 100%; min-width: 0; } select { font-size: 16px; } p { flex-basis: 100%; } }
</style>
