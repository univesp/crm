<script setup>
import { ref, toRef } from 'vue'
import { RouterLink } from 'vue-router'

import { useDialogA11y } from '@/composables/useDialogA11y'

const props = defineProps({
  open: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: false },
  themeKey: { type: String, default: '' },
  patternKey: { type: String, default: '' },
  routingPatterns: { type: Array, default: () => [] },
  selectedPattern: { type: Object, default: null },
  availableStudent: { type: Boolean, default: true },
  availablePublic: { type: Boolean, default: false },
  validFrom: { type: String, default: '' },
  validUntil: { type: String, default: '' },
  themes: { type: Array, default: () => [] },
  ownerEmail: { type: String, default: '' },
  criticidadeDefaultKey: { type: String, default: '' },
  slaPolicyKey: { type: String, default: '' },
  criticalityLevels: { type: Array, default: () => [] },
  slaLevels: { type: Array, default: () => [] },
})

const emit = defineEmits([
  'close',
  'sync-channels',
  'update:themeKey',
  'update:patternKey',
  'update:criticidadeDefaultKey',
  'update:slaPolicyKey',
  'update:availableStudent',
  'update:availablePublic',
  'update:validFrom',
  'update:validUntil',
])

function onStudentChange(event) {
  emit('update:availableStudent', event.target.checked)
  emit('sync-channels')
}

function onPublicChange(event) {
  emit('update:availablePublic', event.target.checked)
  emit('sync-channels')
}

const panelRef = ref(null)

useDialogA11y(toRef(props, 'open'), panelRef, () => emit('close'))
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
    <section ref="panelRef" class="crm-panel faq-v3-dialog faq-v3-dialog--wide faq-settings" tabindex="-1">
      <div class="faq-v3-dialog__header">
        <h2 id="faq-settings-title">Configurações do assunto</h2>
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
              id="faq-field-channel-student"
              :checked="availableStudent"
              type="checkbox"
              :disabled="!canEdit"
              @change="onStudentChange"
            />
            Portal do Aluno
          </label>
          <label>
            <input
              :checked="availablePublic"
              type="checkbox"
              :disabled="!canEdit"
              @change="onPublicChange"
            />
            Atendimento público
          </label>
        </fieldset>
        <label class="crm-field-label">
          Caminho operacional do fluxo
          <select
            id="faq-field-pattern-key"
            class="crm-field"
            :value="patternKey"
            :disabled="!canEdit"
            @change="$emit('update:patternKey', $event.target.value)"
          >
            <option
              v-for="pattern in routingPatterns"
              :key="pattern.pattern_key"
              :value="pattern.pattern_key"
            >
              {{ pattern.label }}
            </option>
          </select>
        </label>
        <p class="faq-settings__hint">
          {{ selectedPattern?.steps?.join(' → ') || 'Selecione um caminho operacional.' }}
          Esta escolha vale para todo o fluxo.
        </p>
        <label class="crm-field-label">
          Criticidade padrão do assunto
          <select
            class="crm-field"
            :value="criticidadeDefaultKey"
            :disabled="!canEdit"
            @change="$emit('update:criticidadeDefaultKey', $event.target.value)"
          >
            <option value="">Selecione</option>
            <option v-for="level in criticalityLevels" :key="level.key" :value="level.key">
              {{ level.label }}
            </option>
          </select>
        </label>
        <label class="crm-field-label">
          Prazo padrão (SLA) do assunto
          <select
            class="crm-field"
            :value="slaPolicyKey"
            :disabled="!canEdit"
            @change="$emit('update:slaPolicyKey', $event.target.value)"
          >
            <option value="">Selecione</option>
            <option v-for="level in slaLevels" :key="level.key" :value="level.key">
              {{ level.label }}
            </option>
          </select>
        </label>
        <p class="faq-settings__hint">
          Vale como padrão do assunto para respostas finais sem regra própria no nó.
          Um nó pode sobrescrever criticidade e prazo na aba Encaminhamento.
          Catálogo institucional em
          <RouterLink to="/admin/parametros">Regras e prazos</RouterLink>.
        </p>
        <label class="crm-field-label">
          Tema
          <select
            class="crm-field"
            :value="themeKey"
            :disabled="!canEdit"
            @change="$emit('update:themeKey', $event.target.value)"
          >
            <option v-for="theme in themes" :key="theme.theme_key" :value="theme.theme_key">
              {{ theme.theme_label }}
            </option>
          </select>
        </label>
        <label class="crm-field-label">
          Responsável pelo conteúdo
          <input class="crm-field" :value="ownerEmail || 'Não definido'" disabled />
        </label>
        <label class="crm-field-label">
          Início da vigência
          <input
            :value="validFrom"
            type="datetime-local"
            class="crm-field"
            :disabled="!canEdit"
            @input="$emit('update:validFrom', $event.target.value)"
          />
        </label>
        <label class="crm-field-label">
          Fim da vigência
          <input
            :value="validUntil"
            type="datetime-local"
            class="crm-field"
            :disabled="!canEdit"
            @input="$emit('update:validUntil', $event.target.value)"
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
