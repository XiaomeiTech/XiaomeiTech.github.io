<template>
  <div ref="waveRef" style="font-family: var(--vp-font-family-mono); overflow-x: auto;" class="wavedrom-wrapper"></div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import wavedrom from "wavedrom";
import WaveSkin from "wavedrom/skins/default.js";

const props = defineProps<{
    id: string;
    encodedText: string;
}>()

const waveRef = ref()

onMounted(() => {
    try {
        const text = decodeURIComponent(props.encodedText);
        let parsed;
        try {
            // first try JSON
            parsed = JSON.parse(text);
        } catch(e) {
            // fallback to eval for unquoted keys etc.
            parsed = new Function('return ' + text)();
        }
        
        if (typeof window !== 'undefined') {
            (window as any).WaveSkin = WaveSkin;
        }
        wavedrom.renderWaveElement(props.id, parsed, waveRef.value, WaveSkin);
    } catch (e) {
        console.error('Wavedrom render error:', e)
        if (waveRef.value) {
            waveRef.value.innerText = "Error rendering Wavedrom: " + String(e);
        }
    }
})
</script>

<style>
.wavedrom-wrapper svg {
  max-width: 100%;
}
</style>