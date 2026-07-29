<script setup>
import { computed } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  intent: { type: String, default: 'review' },
  blockers: { type: Array, default: () => [] },
  changeSummary: { type: String, default: '' },
  saving: { type: Boolean, default: false },
})

defineEmits(['close', 'confirm', 'update:changeSummary'])

const title = computed(() => {
  if (props.intent === 'publish') return 'Resumo antes da publicação'
  if (props.intent === 'approval') return 'Enviar para aprovação'
  return 'Enviar para revisão'
})

const confirmLabel = computed(() => {
  if (props.intent === 'publish') return 'Continuar para publicação'
  if (props.intent === 'approval') return 'Enviar para aprovação'
  return 'Enviar para revisão'
})

const summaryTooShort = computed(() => props.changeSummary.trim().length < 20)

const canConfirm = computed(() => {
  if (summaryTooShort.value || props.saving) return false
  if (props.intent === 'publish') return true
  return props.blockers.length === 0
})
</script>

<template>
  <div
    v-if="open"
    class="faq-v3-dialog-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="submit-review-title"
    @click.self="$emit('close')"
  >
    <section class="crm-panel faq-v3-dialog faq-v3-dialog--wide">
      <div class="faq-v3-dialog__header">
        <h2 id="submit-review-title">{{ title }}</h2>
        <button type="button" class="crm-button-secondary" @click="$emit('close')">Cancelar</button>
      </div>

      <div v-if="intent !== 'publish'" class="faq-submit-dialog__blockers">
        <h3>Pendências</h3>
        <p v-if="!blockers.length" class="faq-ok" role="status">Nenhum bloqueio encontrado.</p>
        <ul v-else>
          <li v-for="issue in blockers" :key="issue">{{ issue }}</li>
        </ul>
      </div>

      <label class="crm-field-label">
        Resumo das mudanças
        <textarea
          class="crm-field faq-textarea"
          :value="changeSummary"
          :disabled="saving"
          placeholder="Explique o que mudou e por quê."
          @input="$emit('update:changeSummary', $event.target.value)"
        />
      </label>
      <small>Mínimo de 20 caracteres para enviar à aprovação.</small>

      <div class="faq-submit-dialog__actions">
        <button type="button" class="crm-button-secondary" :disabled="saving" @click="$emit('close')">
          Cancelar
        </button>
        <button
          type="button"
          class="crm-button-primary"
          :disabled="!canConfirm"
          @click="$emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
      <p v-if="summaryTooShort" class="faq-submit-dialog__hint" role="status">
        Informe pelo menos 20 caracteres no resumo.
      </p>
      <p v-else-if="intent !== 'publish' && blockers.length" class="faq-submit-dialog__hint" role="status">
        Corrija as pendências antes de enviar.
      </p>
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
}

.faq-v3-dialog--wide {
  width: min(100%, 40rem);
}

.faq-v3-dialog__header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.faq-submit-dialog__blockers {
  margin-bottom: var(--space-3);
}

.faq-submit-dialog__blockers h3 {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-sm);
}

.faq-submit-dialog__blockers ul {
  margin: 0;
  padding-left: var(--space-4);
}

.faq-textarea {
  min-height: 6rem;
}

.faq-ok {
  color: var(--color-success);
}

.faq-submit-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: flex-end;
  margin-top: var(--space-4);
}

.faq-submit-dialog__hint {
  margin-top: var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
