<script setup>
import { ref, toRef } from 'vue'

import { useDialogA11y } from '@/composables/useDialogA11y'

const props = defineProps({
  open: { type: Boolean, default: false },
  versions: { type: Array, default: () => [] },
  lifecycleLabels: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['close'])

const panelRef = ref(null)

useDialogA11y(toRef(props, 'open'), panelRef, () => emit('close'))

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date)
}
</script>

<template>
  <div
    v-if="open"
    class="faq-v3-dialog-overlay"
    aria-modal="true"
    @click.self="$emit('close')"
  >
    <section
      ref="panelRef"
      class="crm-panel faq-v3-dialog"
      role="dialog"
      aria-labelledby="history-dialog-title"
      tabindex="-1"
    >
      <div class="faq-v3-dialog__header">
        <h2 id="history-dialog-title">Histórico de versões</h2>
        <button type="button" class="crm-button-secondary" @click="$emit('close')">Fechar</button>
      </div>
      <ol class="faq-v3-dialog__history">
        <li v-for="version in versions.slice(0, 6)" :key="version.version_id">
          <strong>{{ lifecycleLabels[version.lifecycle_state] || version.lifecycle_state }}</strong>
          <span>{{ formatDate(version.published_at || version.approved_at) }}</span>
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.faq-v3-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: color-mix(in srgb, var(--color-text) 35%, transparent);
}

.faq-v3-dialog {
  width: min(100%, 32rem);
  max-height: min(100%, 80vh);
  overflow: auto;
  padding: var(--space-4);
  outline: none;
}

.faq-v3-dialog__header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.faq-v3-dialog__history {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.faq-v3-dialog__history li {
  display: grid;
  border-bottom: 1px solid var(--border-default);
  padding-block: var(--space-2);
}

.faq-v3-dialog__history span {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
</style>
