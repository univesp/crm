<script setup>
import { ref, toRef } from 'vue'

import StatusBadge from '@/components/StatusBadge.vue'
import { useDialogA11y } from '@/composables/useDialogA11y'

const props = defineProps({
  open: { type: Boolean, default: false },
  entries: { type: Array, default: () => [] },
  selectedEntry: { type: Object, default: null },
  previewDueAt: { type: [Date, null], default: null },
})

const emit = defineEmits(['close', 'select', 'add', 'remove'])

const panelRef = ref(null)

useDialogA11y(toRef(props, 'open'), panelRef, () => emit('close'))

function formatPreviewDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(value)
}
</script>

<template>
  <div
    v-if="open"
    class="admin-calendar-dialog-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="admin-calendar-title"
    @click.self="emit('close')"
  >
    <section ref="panelRef" class="crm-panel admin-calendar-dialog" tabindex="-1">
      <div class="admin-calendar-dialog__header">
        <div>
          <h2 id="admin-calendar-title">Calendário institucional</h2>
          <p class="admin-calendar-dialog__hint">
            Sábado e domingo não contam por padrão.
            <span v-if="previewDueAt">
              Exemplo com o SLA selecionado: {{ formatPreviewDate(previewDueAt) }}.
            </span>
          </p>
        </div>
        <button type="button" class="crm-button-secondary" @click="emit('close')">Fechar</button>
      </div>

      <div class="grid gap-2">
        <button
          v-for="entry in entries"
          :key="entry.id"
          type="button"
          class="option-button"
          :class="{ 'is-active': selectedEntry?.id === entry.id }"
          @click="emit('select', entry.id)"
        >
          <div class="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p class="text-xs font-semibold text-slate-500">{{ entry.type }}</p>
              <p class="mt-1 text-base font-semibold text-slate-950">{{ entry.date }}</p>
              <p class="mt-1 text-sm text-slate-600">{{ entry.label || 'Sem descricao' }}</p>
            </div>
            <StatusBadge :label="entry.type" />
          </div>
        </button>
      </div>

      <div class="flex flex-wrap gap-2">
        <button type="button" class="crm-button-secondary" @click="emit('add')">
          Adicionar entrada
        </button>
        <button
          v-if="selectedEntry"
          type="button"
          class="rounded-[8px] border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700"
          @click="emit('remove', selectedEntry.id)"
        >
          Remover selecionada
        </button>
      </div>

      <div
        v-if="selectedEntry"
        class="grid gap-4 rounded-[8px] border border-slate-200 bg-slate-50/75 p-4 md:grid-cols-2"
      >
        <label class="grid gap-2">
          <span class="text-sm font-semibold text-slate-600">Data</span>
          <input
            v-model="selectedEntry.date"
            type="date"
            class="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
          />
        </label>
        <label class="grid gap-2">
          <span class="text-sm font-semibold text-slate-600">Tipo</span>
          <select
            v-model="selectedEntry.type"
            class="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
          >
            <option value="holiday">Feriado</option>
            <option value="bridge">Ponte</option>
            <option value="recess">Recesso</option>
          </select>
        </label>
        <label class="grid gap-2 md:col-span-2">
          <span class="text-sm font-semibold text-slate-600">Descricao</span>
          <input
            v-model="selectedEntry.label"
            type="text"
            class="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
          />
        </label>
      </div>
    </section>
  </div>
</template>

<style scoped>
.admin-calendar-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: color-mix(in srgb, var(--color-text) 35%, transparent);
}

.admin-calendar-dialog {
  width: min(100%, 40rem);
  max-height: min(100%, 85vh);
  overflow: auto;
  padding: var(--space-4);
  display: grid;
  gap: var(--space-4);
}

.admin-calendar-dialog__header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: flex-start;
  justify-content: space-between;
}

.admin-calendar-dialog__header h2 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-text);
}

.admin-calendar-dialog__hint {
  margin: var(--space-2) 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}
</style>
