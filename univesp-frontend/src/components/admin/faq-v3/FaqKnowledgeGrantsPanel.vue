<script setup>
/* eslint-disable vue/no-mutating-props -- grantForm é estado compartilhado do composable pai */
import { computed } from 'vue'

const props = defineProps({
  readOnly: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  errorMessage: { type: String, default: '' },
  successMessage: { type: String, default: '' },
  grantForm: { type: Object, required: true },
  grantSubjects: { type: Array, default: () => [] },
  eligibleGrantProfiles: { type: Array, default: () => [] },
  contributorAssignments: { type: Array, default: () => [] },
  themes: { type: Array, default: () => [] },
  themeFilter: { type: String, default: '' },
})

const emit = defineEmits(['submit', 'revoke', 'subject-type-change', 'subject-change'])

const visibleAssignments = computed(() => {
  if (!props.themeFilter) return props.contributorAssignments
  return props.contributorAssignments.filter((assignment) =>
    (assignment.scopes?.knowledge_themes || []).includes(props.themeFilter),
  )
})

const hasProfiles = computed(() => props.eligibleGrantProfiles.length > 0 || props.readOnly)

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('pt-BR').format(date)
}

function themeLabels(themeKeys = []) {
  if (!themeKeys.length) return '—'
  return themeKeys
    .map((key) => props.themes.find((theme) => theme.theme_key === key)?.theme_label || key)
    .join(', ')
}
</script>

<template>
  <div class="faq-knowledge-grants">
    <p v-if="errorMessage" class="crm-alert crm-alert--danger" role="alert">{{ errorMessage }}</p>
    <p v-if="successMessage" class="crm-alert crm-alert--success" role="status">
      {{ successMessage }}
    </p>

    <p v-if="readOnly" class="faq-knowledge-grants__hint">
      Concessões ativas de sugestão por tema. Para alterar, use Pessoas e acessos.
    </p>
    <p v-else class="faq-knowledge-grants__hint">
      OP e BPO só veem o botão de sugestão quando recebem esta permissão para os temas e o
      período definidos.
    </p>

    <form
      v-if="!readOnly && hasProfiles"
      class="faq-knowledge-grants__form"
      @submit.prevent="emit('submit')"
    >
      <label class="crm-field-label">
        Conceder para
        <select
          v-model="grantForm.subject_type"
          class="crm-field"
          @change="emit('subject-type-change')"
        >
          <option value="person">Uma pessoa</option>
          <option value="group">Um grupo</option>
        </select>
      </label>
      <label class="crm-field-label">
        Pessoa ou grupo
        <select
          v-model="grantForm.subject_id"
          class="crm-field"
          required
          @change="emit('subject-change')"
        >
          <option value="">Selecione</option>
          <option v-for="subject in grantSubjects" :key="subject.value" :value="subject.value">
            {{ subject.label }}
          </option>
        </select>
      </label>
      <label class="crm-field-label">
        Perfil
        <select v-model="grantForm.permission_profile" class="crm-field" required>
          <option v-for="profile in eligibleGrantProfiles" :key="profile.id" :value="profile.id">
            {{ profile.label }}
          </option>
        </select>
      </label>
      <fieldset class="faq-knowledge-grants__themes">
        <legend>Temas permitidos</legend>
        <label v-for="theme in themes" :key="theme.theme_key">
          <input v-model="grantForm.theme_keys" type="checkbox" :value="theme.theme_key" />
          {{ theme.theme_label }}
        </label>
      </fieldset>
      <label class="crm-field-label">
        Válido a partir de
        <input v-model="grantForm.valid_from" type="datetime-local" class="crm-field" />
      </label>
      <label class="crm-field-label">
        Válido até
        <input v-model="grantForm.valid_until" type="datetime-local" class="crm-field" />
      </label>
      <label class="crm-field-label faq-knowledge-grants__reason">
        Justificativa
        <input
          v-model="grantForm.justification"
          class="crm-field"
          placeholder="Por que esta pessoa ou grupo deve sugerir?"
          required
        />
      </label>
      <div class="crm-form-actions">
        <button type="submit" class="crm-button-primary" :disabled="saving">
          Conceder permissão
        </button>
      </div>
    </form>
    <p v-else-if="!readOnly && !hasProfiles">
      Os perfis de contribuição ainda não foram sincronizados neste ambiente.
    </p>

    <p v-if="loading" role="status">Carregando permissões…</p>

    <div v-else-if="visibleAssignments.length" class="crm-table-scroll">
      <table>
        <thead>
          <tr>
            <th>Pessoa ou grupo</th>
            <th>Temas</th>
            <th>Validade</th>
            <th>Situação</th>
            <th v-if="!readOnly">Ação</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="assignment in visibleAssignments" :key="assignment.id">
            <td>{{ assignment.subject_id }}</td>
            <td>{{ themeLabels(assignment.scopes?.knowledge_themes) }}</td>
            <td>
              {{ assignment.valid_from ? formatDate(assignment.valid_from) : 'Agora' }}
              a
              {{ assignment.valid_until ? formatDate(assignment.valid_until) : 'Sem prazo final' }}
            </td>
            <td>{{ assignment.active === false ? 'Revogada' : 'Ativa' }}</td>
            <td v-if="!readOnly">
              <button
                v-if="assignment.active !== false"
                type="button"
                class="crm-button-secondary"
                @click="emit('revoke', assignment)"
              >
                Revogar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="faq-knowledge-grants__empty">
      Nenhuma permissão de sugestão{{ themeFilter ? ' para este tema' : '' }} cadastrada.
    </p>
  </div>
</template>

<style scoped>
.faq-knowledge-grants {
  display: grid;
  gap: var(--space-3);
}

.faq-knowledge-grants__hint,
.faq-knowledge-grants__empty {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.faq-knowledge-grants__form {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: minmax(0, 1fr);
}

.faq-knowledge-grants__themes {
  display: grid;
  gap: var(--space-2);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.faq-knowledge-grants__themes legend {
  padding-inline: var(--space-1);
  font-weight: 700;
}

.faq-knowledge-grants__themes label {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.faq-knowledge-grants__reason {
  grid-column: auto;
}
</style>
