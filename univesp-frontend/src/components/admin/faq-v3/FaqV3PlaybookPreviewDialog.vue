<script setup>
defineProps({
  open: { type: Boolean, default: false },
  stageTitle: { type: String, default: '' },
  layers: { type: Array, default: () => [] },
})

defineEmits(['close'])
</script>

<template>
  <div
    v-if="open"
    class="faq-v3-dialog-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="playbook-preview-title"
    @click.self="$emit('close')"
  >
    <section class="crm-panel faq-v3-dialog faq-v3-dialog--wide">
      <div class="faq-v3-dialog__header">
        <div>
          <h2 id="playbook-preview-title">Playbook da etapa</h2>
          <p class="faq-v3-dialog__context">{{ stageTitle || 'Etapa sem título' }}</p>
        </div>
        <button type="button" class="crm-button-secondary" @click="$emit('close')">Fechar</button>
      </div>
      <article v-for="layer in layers" :key="layer.key" class="crm-card-muted faq-v3-dialog__article">
        <h3>{{ layer.label }}</h3>
        <p v-if="layer.inherited" class="crm-chip">Herdado do OP</p>
        <p>
          <strong>Objetivo:</strong>
          {{ layer.objective || 'Não definido' }}
        </p>
        <p v-if="layer.suggestedReply">
          <strong>Resposta sugerida:</strong>
          {{ layer.suggestedReply }}
        </p>
        <ol v-if="layer.checklist.length">
          <li v-for="item in layer.checklist" :key="item">{{ item }}</li>
        </ol>
      </article>
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
  align-items: start;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.faq-v3-dialog__context {
  margin: var(--space-1) 0 0;
  color: var(--color-text-muted);
}

.faq-v3-dialog__article {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  margin-bottom: var(--space-3);
}
</style>
