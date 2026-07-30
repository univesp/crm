<script setup>
import { ref, toRef } from 'vue'

import { useDialogA11y } from '@/composables/useDialogA11y'

import FaqV3FlowMap from './FaqV3FlowMap.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  payload: { type: Object, default: null },
  selectedNodeId: { type: String, default: '' },
  nodeIssues: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['close', 'select-node'])

const panelRef = ref(null)

useDialogA11y(toRef(props, 'open'), panelRef, () => emit('close'))

function handleSelect(nodeId) {
  emit('select-node', nodeId)
  emit('close')
}
</script>

<template>
  <div
    v-if="open && payload"
    class="faq-v3-map-overlay-backdrop"
    @click.self="$emit('close')"
  >
    <div
      ref="panelRef"
      class="faq-v3-map-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="faq-v3-map-title"
      tabindex="-1"
    >
      <div class="faq-v3-map-overlay__toolbar">
        <p class="faq-v3-map-overlay__hint">Selecione uma etapa para editar o conteúdo.</p>
        <button type="button" class="crm-button-secondary" @click="$emit('close')">Fechar mapa</button>
      </div>
      <FaqV3FlowMap
        class="faq-v3-map-overlay__map"
        :payload="payload"
        :selected-node-id="selectedNodeId"
        :node-issues="nodeIssues"
        @select-node="handleSelect"
      />
    </div>
  </div>
</template>

<style scoped>
.faq-v3-map-overlay-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: color-mix(in srgb, var(--color-text) 35%, transparent);
}

.faq-v3-map-overlay {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: var(--space-3);
  width: min(100%, calc(100vw - 2rem));
  height: min(100%, calc(100vh - 2rem));
  padding: var(--space-4);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg, 0 1rem 2rem rgba(0, 0, 0, 0.18));
  outline: none;
}

.faq-v3-map-overlay__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.faq-v3-map-overlay__hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.faq-v3-map-overlay__map {
  min-height: 0;
  height: 100%;
}

.faq-v3-map-overlay__map :deep(.faq-v3-flow-map__canvas) {
  height: min(100%, calc(100vh - 12rem));
  min-height: 20rem;
}
</style>
