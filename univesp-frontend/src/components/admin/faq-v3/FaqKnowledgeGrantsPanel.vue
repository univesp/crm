<script setup>
/* eslint-disable vue/no-mutating-props -- grantForm é estado compartilhado do composable pai */
import { computed, ref } from 'vue'

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
const showGrantForm = ref(false)
const subjectQuery = ref('')

const visibleAssignments = computed(() => {
  if (!props.themeFilter) return props.contributorAssignments
  return props.contributorAssignments.filter((assignment) =>
    (assignment.scopes?.knowledge_themes || []).includes(props.themeFilter),
  )
})

const hasProfiles = computed(() => props.eligibleGrantProfiles.length > 0 || props.readOnly)

const matchingSubjects = computed(() => {
  const query = subjectQuery.value.trim().toLowerCase()
  if (!query) return []
  return props.grantSubjects
    .filter((subject) => String(subject.label || '').toLowerCase().includes(query))
    .slice(0, 20)
})

const selectedSubject = computed(() =>
  props.grantSubjects.find((subject) => subject.value === props.grantForm.subject_id) || null,
)

function selectSubject(subject) {
  props.grantForm.subject_id = subject.value
  subjectQuery.value = ''
  emit('subject-change')
}

function clearSubject() {
  props.grantForm.subject_id = ''
  subjectQuery.value = ''
  emit('subject-change')
}

function subjectLabel(subjectId) {
  return props.grantSubjects.find((subject) => subject.value === subjectId)?.label || subjectId
}

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

    <div v-if="!readOnly" class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="crm-button-primary"
        @click="showGrantForm = !showGrantForm"
      >
        {{ showGrantForm ? 'Fechar cadastro' : 'Conceder acesso de sugestão' }}
      </button>
      <span class="faq-knowledge-grants__hint">As concessões existentes ficam visíveis abaixo.</span>
    </div>

    <form
      v-if="!readOnly && hasProfiles && showGrantForm"
      class="faq-knowledge-grants__form"
      @submit.prevent="emit('submit')"
    >
      <label class="crm-field-label">
        Conceder para
        <select
          v-model="grantForm.subject_type"
          class="crm-field"
          @change="subjectQuery = ''; emit('subject-type-change')"
        >
          <option value="person">Uma pessoa</option>
          <option value="group">Um grupo</option>
        </select>
      </label>
      <label class="crm-field-label">
        Buscar pessoa ou grupo
        <input
          v-model="subjectQuery"
          class="crm-field"
          placeholder="Digite nome ou e-mail"
          autocomplete="off"
          :aria-describedby="grantForm.subject_id ? 'knowledge-selected-subject' : undefined"
        />
      </label>
      <div
        v-if="matchingSubjects.length"
        class="faq-knowledge-grants__subject-results"
        role="listbox"
        aria-label="Pessoas ou grupos encontrados"
      >
        <button
          v-for="subject in matchingSubjects"
          :key="subject.value"
          type="button"
          role="option"
          class="faq-knowledge-grants__subject-result"
          @click="selectSubject(subject)"
        >
          {{ subject.label }}
        </button>
      </div>
      <div
        v-if="grantForm.subject_id"
        id="knowledge-selected-subject"
        class="faq-knowledge-grants__selected-subject"
      >
        <span>Selecionado: {{ selectedSubject?.label || grantForm.subject_id }}</span>
        <button type="button" class="crm-button-secondary" @click="clearSubject">Trocar</button>
      </div>
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
            <td>{{ subjectLabel(assignment.subject_id) }}</td>
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
  max-height: 14rem;
  overflow: auto;
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

.faq-knowledge-grants__subject-results,
.faq-knowledge-grants__selected-subject {
  display: grid;
  gap: var(--space-2);
  grid-column: auto;
}

.faq-knowledge-grants__subject-results {
  max-height: 12rem;
  overflow: auto;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-2);
}

.faq-knowledge-grants__subject-result {
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  text-align: left;
}

.faq-knowledge-grants__subject-result:hover,
.faq-knowledge-grants__subject-result:focus-visible {
  background: var(--color-surface-muted);
}

.faq-knowledge-grants__selected-subject {
  grid-template-columns: 1fr auto;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  font-size: var(--font-size-sm);
  font-weight: 700;
}

@media (min-width: 900px) {
  .faq-knowledge-grants__form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .faq-knowledge-grants__themes,
  .faq-knowledge-grants__reason,
  .faq-knowledge-grants__subject-results,
  .faq-knowledge-grants__selected-subject,
  .faq-knowledge-grants .crm-form-actions {
    grid-column: 1 / -1;
  }
}
</style>
