<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import {
  incorporateKnowledgeSuggestion,
  listKnowledgeSuggestions,
  rejectKnowledgeSuggestion,
  startKnowledgeSuggestionReview,
} from '@/services/appApi'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(true)
const busyId = ref('')
const stateFilter = ref('')
const suggestions = ref([])
const errorMessage = ref('')
const successMessage = ref('')
const rejectionNotes = ref({})
const canReview = computed(() => auth.mockContext.profileKey !== 'analista_area')

const stateLabels = {
  received: 'Recebida',
  in_review: 'Em análise',
  incorporated: 'Incorporada ao rascunho',
  rejected: 'Recusada',
}

const filtered = computed(() =>
  stateFilter.value
    ? suggestions.value.filter((item) => item.state === stateFilter.value)
    : suggestions.value,
)

const summary = computed(() => ({
  received: suggestions.value.filter((item) => item.state === 'received').length,
  inReview: suggestions.value.filter((item) => item.state === 'in_review').length,
  overdue: suggestions.value.filter((item) => item.sla_overdue && ['received', 'in_review'].includes(item.state)).length,
}))

onMounted(loadSuggestions)

async function loadSuggestions() {
  loading.value = true
  errorMessage.value = ''
  try {
    suggestions.value = (await listKnowledgeSuggestions({ page_size: 100 })).data || []
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível carregar as sugestões.'
  } finally {
    loading.value = false
  }
}

async function startReview(item) {
  await runAction(item, () => startKnowledgeSuggestionReview(item.suggestion_id), 'Sugestão reservada para sua análise.')
}

async function incorporate(item) {
  await runAction(
    item,
    () =>
      incorporateKnowledgeSuggestion(item.suggestion_id, {
        change_summary: `Sugestão ${item.suggestion_id} incorporada após revisão editorial.`,
      }),
    'Sugestão incorporada ao rascunho. Revise o fluxo antes de enviá-lo para aprovação.',
  )
}

async function reject(item) {
  const reason = String(rejectionNotes.value[item.suggestion_id] || '').trim()
  if (reason.length < 10) {
    errorMessage.value = 'Explique a recusa em pelo menos 10 caracteres.'
    return
  }
  await runAction(
    item,
    () => rejectKnowledgeSuggestion(item.suggestion_id, { reason }),
    'Sugestão recusada e autor notificado.',
  )
}

async function runAction(item, action, message) {
  busyId.value = item.suggestion_id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await action()
    successMessage.value = message
    await loadSuggestions()
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível concluir a revisão.'
  } finally {
    busyId.value = ''
  }
}

function openDraft(item) {
  return router.push({
    name: 'area-faq-editor',
    params: { bundleId: item.bundle_key },
  })
}

function valueText(value) {
  if (typeof value === 'string') return value || 'Vazio'
  return JSON.stringify(value, null, 2)
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}
</script>

<template>
  <main class="crm-page-wide crm-content-stack" aria-labelledby="suggestions-title">
    <header class="crm-page-header">
      <div>
        <p class="suggestions-kicker">FAQs e orientações</p>
        <h1 id="suggestions-title" class="crm-page-title">Sugestões de melhoria</h1>
        <p class="crm-page-description">
          Compare a proposta com o publicado. Incorporar cria ou atualiza um rascunho;
          nunca muda a versão vigente.
        </p>
      </div>
    </header>

    <p v-if="errorMessage" class="crm-alert crm-alert--danger" role="alert">{{ errorMessage }}</p>
    <p v-if="successMessage" class="crm-alert crm-alert--success" role="status">{{ successMessage }}</p>

    <section class="crm-panel suggestions-overview" aria-label="Resumo das sugestões">
      <div><strong>{{ summary.received }}</strong><span>Recebidas</span></div>
      <div><strong>{{ summary.inReview }}</strong><span>Em análise</span></div>
      <div><strong>{{ summary.overdue }}</strong><span>Fora do prazo</span></div>
      <label class="crm-field-label">
        Situação
        <select v-model="stateFilter" class="crm-field">
          <option value="">Todas</option>
          <option v-for="(label, value) in stateLabels" :key="value" :value="value">
            {{ label }}
          </option>
        </select>
      </label>
    </section>

    <p v-if="loading" role="status">Carregando sugestões…</p>
    <section v-else class="suggestions-list" aria-label="Fila de sugestões">
      <article v-for="item in filtered" :key="item.suggestion_id" class="crm-panel suggestion-card">
        <header class="suggestion-card__header">
          <div>
            <h2>{{ item.bundle_title }}</h2>
            <p>{{ item.theme_key }} · etapa {{ item.node_id }} · camada {{ item.audience_layer }}</p>
          </div>
          <div class="suggestion-card__status">
            <span class="crm-chip">{{ stateLabels[item.state] || item.state }}</span>
            <span v-if="item.sla_overdue" class="crm-chip suggestion-card__overdue">Fora do prazo</span>
          </div>
        </header>

        <p><strong>Motivo:</strong> {{ item.reason }}</p>
        <div class="suggestion-card__comparison">
          <div>
            <h3>Publicado quando foi sugerido</h3>
            <pre>{{ valueText(item.current_value) }}</pre>
          </div>
          <div>
            <h3>Proposta</h3>
            <pre>{{ valueText(item.proposed_value) }}</pre>
          </div>
        </div>
        <p class="suggestion-card__meta">
          Enviada por {{ item.author_name || item.author_email || 'Usuário da área' }} · prazo {{ formatDate(item.sla_due_at) }}
        </p>

        <div v-if="canReview && ['received', 'in_review'].includes(item.state)" class="suggestion-card__actions">
          <button
            v-if="item.state === 'received'"
            type="button"
            class="crm-button-secondary"
            :disabled="busyId === item.suggestion_id"
            @click="startReview(item)"
          >
            Iniciar análise
          </button>
          <button
            type="button"
            class="crm-button-primary"
            :disabled="busyId === item.suggestion_id"
            @click="incorporate(item)"
          >
            Incorporar ao rascunho
          </button>
          <label class="crm-field-label suggestion-card__rejection">
            Motivo para recusar
            <input
              v-model="rejectionNotes[item.suggestion_id]"
              class="crm-field"
              placeholder="Explique a decisão ao autor"
            />
          </label>
          <button
            type="button"
            class="crm-button-secondary"
            :disabled="busyId === item.suggestion_id"
            @click="reject(item)"
          >
            Recusar
          </button>
        </div>
        <button
          v-if="canReview && item.state === 'incorporated'"
          type="button"
          class="crm-button-secondary"
          @click="openDraft(item)"
        >
          Abrir rascunho
        </button>
      </article>
      <div v-if="!filtered.length" class="crm-panel suggestion-card">
        Nenhuma sugestão nesta situação.
      </div>
    </section>
  </main>
</template>

<style scoped>
.crm-panel,
.crm-alert {
  padding: var(--space-4);
}

.suggestions-kicker {
  color: var(--color-primary-dark);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.crm-alert {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
}

.crm-alert--danger,
.suggestion-card__overdue {
  color: var(--color-danger);
}

.crm-alert--success {
  color: var(--color-success);
}

.suggestions-overview,
.suggestion-card__header,
.suggestion-card__status,
.suggestion-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
}

.suggestions-overview > div {
  display: grid;
  min-width: 8rem;
}

.suggestions-overview strong {
  font-size: var(--font-size-xl);
}

.suggestions-overview span,
.suggestion-card__header p,
.suggestion-card__meta {
  color: var(--color-text-muted);
}

.suggestions-list {
  display: grid;
  gap: var(--space-4);
}

.suggestion-card {
  display: grid;
  gap: var(--space-3);
}

.suggestion-card__comparison {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.suggestion-card__comparison > div {
  min-width: 0;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.suggestion-card__comparison pre {
  overflow: auto;
  margin-top: var(--space-2);
  white-space: pre-wrap;
  font: inherit;
}

.suggestion-card__rejection {
  flex: 1 1 20rem;
}

@media (max-width: 48rem) {
  .suggestion-card__comparison {
    grid-template-columns: 1fr;
  }
}
</style>
