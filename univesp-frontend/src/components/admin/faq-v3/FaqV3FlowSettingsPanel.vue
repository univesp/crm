<script setup>
defineProps({
  open: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: false },
  payload: { type: Object, required: true },
  channelFlags: { type: Object, required: true },
  validity: { type: Object, required: true },
  themes: { type: Array, default: () => [] },
  ownerEmail: { type: String, default: '' },
})

defineEmits(['close', 'sync-channels'])
</script>

<template>
  <div
    v-if="open"
    class="faq-v3-dialog-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="faq-settings-title"
    @click.self="$emit('close')"
  >
    <section class="crm-panel faq-v3-dialog faq-v3-dialog--wide faq-settings">
      <div class="faq-v3-dialog__header">
        <h2 id="faq-settings-title">Configurações do fluxo</h2>
        <button type="button" class="crm-button-secondary" @click="$emit('close')">Fechar</button>
      </div>
      <p class="faq-settings__hint">
        Salvar mantém o rascunho. Enviar para aprovação avisa o grupo gestor deste tema.
      </p>
      <div class="faq-settings__grid">
        <fieldset class="faq-settings__channels">
          <legend>Canais de disponibilidade</legend>
          <label>
            <input
              v-model="channelFlags.availableStudent"
              type="checkbox"
              :disabled="!canEdit"
              @change="$emit('sync-channels')"
            />
            Portal do Aluno
          </label>
          <label>
            <input
              v-model="channelFlags.availablePublic"
              type="checkbox"
              :disabled="!canEdit"
              @change="$emit('sync-channels')"
            />
            Atendimento público
          </label>
        </fieldset>
        <label class="crm-field-label">
          Tema
          <select v-model="payload.theme_key" class="crm-field" :disabled="!canEdit">
            <option v-for="theme in themes" :key="theme.theme_key" :value="theme.theme_key">
              {{ theme.theme_label }}
            </option>
          </select>
        </label>
        <label class="crm-field-label">
          Responsável
          <input class="crm-field" :value="ownerEmail || 'Não definido'" disabled />
        </label>
        <label class="crm-field-label">
          Início da vigência
          <input
            v-model="validity.valid_from"
            type="datetime-local"
            class="crm-field"
            :disabled="!canEdit"
          />
        </label>
        <label class="crm-field-label">
          Fim da vigência
          <input
            v-model="validity.valid_until"
            type="datetime-local"
            class="crm-field"
            :disabled="!canEdit"
          />
        </label>
      </div>
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

.faq-settings__hint {
  margin: 0 0 var(--space-3);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.faq-settings__grid {
  display: grid;
  gap: var(--space-3);
}

.faq-settings__channels {
  display: grid;
  gap: var(--space-2);
  border: 0;
  padding: 0;
}

.faq-settings__channels label {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}
</style>
