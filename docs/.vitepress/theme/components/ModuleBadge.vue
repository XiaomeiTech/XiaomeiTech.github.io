<script setup lang="ts">
defineProps<{
  kind: 'DI' | 'DO' | 'AI' | 'AO' | 'OTHER' | 'IM'
  label?: string
  protocol?: 'EC' | 'EIP' | 'PN'
  compact?: boolean
}>()
</script>

<template>
  <span class="module-badge" :class="{ 'module-badge-compact': compact }" :data-module-kind="kind">
    {{ label || (kind === 'OTHER' ? '其他' : kind) }}
    <span v-if="protocol" class="module-protocol-tip" :data-module-kind="protocol" aria-hidden="true"></span>
  </span>
</template>
