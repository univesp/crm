<script setup>
import { computed, reactive, ref, watch } from 'vue'

import { AREA_MANAGER_OPERATIONAL_SERVER_PARITY_NOTE } from '@/contracts/areaManagerOperationalContract'
import {
  getAreaGovernance,
  isMockRuntimeEnabled,
  listAreaMembers,
  listTickets,
  updateAreaGovernance,
} from '@/services/appApi'
import { mapApiTicketToOperationalProtocol } from '@/services/ticketMapper'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()
const liveTeamMembers = ref([])
const governanceState = reactive({
  loading: false,
  error: '',
  version: '',
})

async function loadInstitutionalGovernance() {
  if (isMockRuntimeEnabled()) return
  const area = auth.mockContext.currentArea
  if (!area) return
  governanceState.loading = true
  governanceState.error = ''
  try {
    const [stateResponse, membersResponse, ticketsResponse] = await Promise.all([
      getAreaGovernance(area),
      listAreaMembers(area),
      listTickets({ page: 1, page_size: 100 }),
    ])
    studentSupportStore.areaSubjectRules = Array.isArray(stateResponse.data?.rules)
      ? stateResponse.data.rules
      : []
    studentSupportStore.userAvailability = Array.isArray(stateResponse.data?.availability)
      ? stateResponse.data.availability
      : []
    governanceState.version = String(stateResponse.data?.version || '')
    liveTeamMembers.value = (membersResponse.data || [])
      .filter((member) => member.profile_id && member.display_name)
      .map((member) => ({
        profileId: member.profile_id,
        displayName: member.display_name,
        profileKey: member.profile_key || '',
      }))
    studentSupportStore.replaceLiveTickets(
      (ticketsResponse.data || []).map(mapApiTicketToOperationalProtocol),
    )
  } catch (error) {
    governanceState.error = error?.message || 'Falha ao carregar a governança institucional da área.'
    liveTeamMembers.value = []
  } finally {
    governanceState.loading = false
  }
}

async function persistInstitutionalGovernance(reason) {
  if (isMockRuntimeEnabled()) return
  const area = auth.mockContext.currentArea
  const response = await updateAreaGovernance(area, {
    rules: studentSupportStore.areaSubjectRules.filter((rule) => rule.areaLabel === area),
    availability: studentSupportStore.userAvailabilityCatalog.filter(
      (record) => !record.areaLabel || record.areaLabel === area,
    ),
    version: governanceState.version,
    reason,
  })
  governanceState.version = String(response.data?.version || governanceState.version)
  if (Array.isArray(response.data?.rules)) {
    studentSupportStore.areaSubjectRules = response.data.rules
  }
  if (Array.isArray(response.data?.availability)) {
    studentSupportStore.userAvailability = response.data.availability
  }
}

watch(
  () => auth.mockContext.currentArea,
  () => loadInstitutionalGovernance(),
  { immediate: true },
)

const governanceRows = computed(() => studentSupportStore.areaGovernanceRows(auth.mockContext))
const managerOverview = computed(
  () =>
    studentSupportStore.areaManagerOverview(auth.mockContext) || {
      kpis: {
        unassigned: 0,
        overdue: 0,
        stalledCases: 0,
        distributionImbalance: 0,
      },
      ruleImpactHints: [],
    },
)
const areaTeamMembers = computed(() =>
  isMockRuntimeEnabled()
    ? studentSupportStore.areaTeamMembers(auth.mockContext.currentArea)
    : liveTeamMembers.value.map((member) => member.displayName),
)
const areaMemberOptions = computed(() =>
  isMockRuntimeEnabled()
    ? areaTeamMembers.value.map((displayName) => ({
        profileId: displayName,
        displayName,
        profileKey: 'analista_area',
      }))
    : liveTeamMembers.value,
)
const availabilityRows = computed(() =>
  studentSupportStore.userAvailabilityCatalog
    .filter(
      (record) =>
        areaTeamMembers.value.includes(record.userName) &&
        (!record.areaLabel || record.areaLabel === auth.mockContext.currentArea),
    )
    .sort((left, right) => new Date(right.startsAt || 0).getTime() - new Date(left.startsAt || 0).getTime()),
)
const operationalImpactCards = computed(() => [
  {
    id: 'unassigned',
    label: 'Sem responsável',
    value: managerOverview.value.kpis.unassigned,
    helper: 'Casos sem pessoa responsável.',
  },
  {
    id: 'overdue',
    label: 'Vencidos',
    value: managerOverview.value.kpis.overdue,
    helper: 'Casos com SLA estourado.',
  },
  {
    id: 'stalled',
    label: 'Parados',
    value: managerOverview.value.kpis.stalledCases,
    helper: 'Aguardando complemento por mais tempo.',
  },
  {
    id: 'imbalance',
    label: 'Gap de carga',
    value: managerOverview.value.kpis.distributionImbalance,
    helper: 'Diferença entre maior e menor carga.',
  },
])

const scopeDrafts = reactive({})
const openRuleId = ref('')
const feedback = reactive({
  scope: { type: '', message: '' },
  availability: { type: '', message: '' },
})
const availabilityForm = reactive({
  userId: '',
  userName: '',
  scope: 'current_area',
  statusCode: 'unavailable',
  reasonType: 'vacation',
  capacityFactor: '0.5',
  startsAt: '',
  endsAt: '',
  notes: '',
})

function ensureScopeDraft(row) {
  if (!row || scopeDrafts[row.id]) {
    return
  }

  scopeDrafts[row.id] = {
    visibilityMode: row.visibilityMode || row.accessMode || 'team',
    visibilityUsers: [...(row.visibilityUsers || row.allowedAnalysts || [])],
    distributionMode:
      row.distributionMode || (row.accessMode === 'restricted' ? 'restricted' : 'automatic'),
    distributionUsers: [
      ...(row.distributionUsers || row.eligibleUsers || row.allowedAnalysts || []),
    ],
  }
}

function draftFor(row) {
  ensureScopeDraft(row)
  return scopeDrafts[row.id]
}

function toggleRule(rowId) {
  openRuleId.value = openRuleId.value === rowId ? '' : rowId
}

function isRuleOpen(row) {
  return openRuleId.value === row?.id
}

watch(
  governanceRows,
  (rows) => {
    rows.forEach((row) => ensureScopeDraft(row))
  },
  { immediate: true },
)

watch(
  areaTeamMembers,
  (members) => {
    if (!availabilityForm.userName && members[0]) {
      availabilityForm.userName = members[0]
      availabilityForm.userId = areaMemberOptions.value[0]?.profileId || members[0]
    }
  },
  { immediate: true },
)

function containsMember(values = [], member) {
  return values.some(
    (value) => String(value) === String(member.profileId) || String(value) === String(member.displayName),
  )
}

function toggleMember(rowId, field, member) {
  const draft = scopeDrafts[rowId]
  if (!draft) {
    return
  }

  const values = draft[field] || []
  draft[field] = containsMember(values, member)
    ? values.filter(
        (item) => String(item) !== String(member.profileId) && String(item) !== String(member.displayName),
      )
    : [...values, member.profileId]
}

async function saveScopeRule(row) {
  const draft = scopeDrafts[row.id]
  if (!draft) {
    return
  }

  studentSupportStore.upsertAreaSubjectRule({
    areaLabel: auth.mockContext.currentArea,
    themeKey: row.themeKey,
    subsubjectKey: row.subsubjectKey,
    subjectLabel: row.subjectLabel,
    accessMode: draft.visibilityMode,
    allowedAnalysts: draft.visibilityMode === 'restricted' ? draft.visibilityUsers : [],
    visibilityMode: draft.visibilityMode,
    visibilityUsers: draft.visibilityMode === 'restricted' ? draft.visibilityUsers : [],
    distributionMode: draft.distributionMode,
    distributionUsers: draft.distributionMode === 'restricted' ? draft.distributionUsers : [],
    actorName: auth.mockContext.userName,
  })

  try {
    await persistInstitutionalGovernance(`Atualização da regra de escopo: ${row.subjectLabel}`)
    feedback.scope.type = 'success'
    feedback.scope.message = `Regra operacional atualizada para ${row.subjectLabel}.`
  } catch (error) {
    feedback.scope.type = 'error'
    feedback.scope.message = error?.message || 'Falha ao persistir a regra de escopo.'
  }
}

function statusLabel(statusCode = '') {
  if (statusCode === 'reduced_capacity') {
    return 'Capacidade reduzida'
  }

  if (statusCode === 'unavailable') {
    return 'Indisponível'
  }

  return 'Disponível'
}

function reasonLabel(reasonType = '') {
  if (reasonType === 'vacation') {
    return 'Férias'
  }

  if (reasonType === 'leave') {
    return 'Licença'
  }

  if (reasonType === 'temporary_unavailable') {
    return 'Indisponibilidade temporária'
  }

    return 'Outro motivo'
}

function formatScopeLabel(record) {
  return record.areaLabel ? `Somente ${record.areaLabel}` : 'Todas as áreas do usuário'
}

function buildRuleQueueRoute(row = {}) {
  return {
    path: '/area/fila',
    query: {
      subject: row.subjectLabel,
      bucket: 'all',
      sortField: 'sla',
      sortDirection: 'asc',
    },
  }
}

function rowRiskState(row = {}) {
  const restricted = row.distributionMode === 'restricted'
  const allowedCount = Array.isArray(row.distributionUsers)
    ? row.distributionUsers.length
    : Array.isArray(row.eligibleUsers)
      ? row.eligibleUsers.length
      : 0

  if (restricted && allowedCount === 0) {
    return {
      label: 'Risco alto',
      helper: 'Regra restrita sem pessoa selecionada deixa novos casos sem responsável e exige ação do gestor.',
      toneClass: 'border-[rgba(166,31,40,0.18)] bg-[rgba(253,236,237,0.72)] text-[var(--color-danger)]',
    }
  }

  if (restricted && allowedCount === 1 && row.openCases > 0) {
    return {
      label: 'Atenção',
      helper: 'Apenas 1 pessoa recebe novos casos deste assunto.',
      toneClass: 'border-[rgba(202,138,4,0.2)] bg-[rgba(254,243,199,0.72)] text-[#8a5200]',
    }
  }

  if (row.overdueCases > 0 || row.riskCases > 0) {
    return {
      label: 'Acompanhar',
      helper: 'Este assunto já aparece com risco de SLA na fila.',
      toneClass: 'border-[rgba(8,115,145,0.16)] bg-[rgba(224,242,254,0.65)] text-[#0b6e8c]',
    }
  }

  return {
    label: 'Estável',
    helper: 'Sem sinal forte de gargalo neste recorte.',
    toneClass: 'border-slate-200 bg-slate-100 text-slate-700',
  }
}

function impactHintToneClass(tone = '') {
  if (tone === 'warning') {
    return 'border-[rgba(202,138,4,0.2)] bg-[rgba(254,243,199,0.72)]'
  }

  if (tone === 'danger') {
    return 'border-[rgba(166,31,40,0.18)] bg-[rgba(253,236,237,0.72)]'
  }

  return 'border-[rgba(8,115,145,0.16)] bg-[rgba(224,242,254,0.62)]'
}

function resetAvailabilityForm() {
  availabilityForm.userId = areaMemberOptions.value[0]?.profileId || ''
  availabilityForm.userName = areaMemberOptions.value[0]?.displayName || areaTeamMembers.value[0] || ''
  availabilityForm.scope = 'current_area'
  availabilityForm.statusCode = 'unavailable'
  availabilityForm.reasonType = 'vacation'
  availabilityForm.capacityFactor = '0.5'
  availabilityForm.startsAt = ''
  availabilityForm.endsAt = ''
  availabilityForm.notes = ''
}

async function saveAvailability() {
  if (!availabilityForm.userId || !availabilityForm.startsAt || !availabilityForm.endsAt) {
    feedback.availability.type = 'error'
    feedback.availability.message = 'Preencha pessoa, início e fim para registrar a disponibilidade.'
    return
  }

  studentSupportStore.upsertUserAvailability({
    userId: availabilityForm.userId,
    userName: availabilityForm.userName,
    areaLabel: availabilityForm.scope === 'global' ? '' : auth.mockContext.currentArea,
    statusCode: availabilityForm.statusCode,
    reasonType: availabilityForm.reasonType,
    capacityFactor:
      availabilityForm.statusCode === 'reduced_capacity'
        ? Number(availabilityForm.capacityFactor || 0.5)
        : availabilityForm.statusCode === 'unavailable'
          ? 0
          : 1,
    startsAt: availabilityForm.startsAt,
    endsAt: availabilityForm.endsAt,
    notes: availabilityForm.notes,
  })

  try {
    await persistInstitutionalGovernance(`Atualização de disponibilidade: ${availabilityForm.userName}`)
    feedback.availability.type = 'success'
    feedback.availability.message = `Disponibilidade registrada para ${availabilityForm.userName}.`
    resetAvailabilityForm()
  } catch (error) {
    feedback.availability.type = 'error'
    feedback.availability.message = error?.message || 'Falha ao persistir a disponibilidade.'
  }
}
</script>

<template>
  <div class="grid gap-4">
    <section class="crm-panel px-5 py-5">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="max-w-[760px]">
          <h1 class="crm-page-title text-xl">Regras operacionais</h1>
          <p class="crm-page-description">
            Defina quem consulta cada assunto e quem recebe novos casos.
          </p>
        </div>

        <RouterLink to="/area/operacao" class="crm-button-secondary shrink-0">
          Voltar para Operação
        </RouterLink>
      </div>

      <details class="mt-4 rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-3">
        <summary class="cursor-pointer list-none text-sm font-semibold text-slate-700">
          Como funciona a distribuição
        </summary>
        <p class="mt-3 text-sm leading-6 text-slate-600">{{ AREA_MANAGER_OPERATIONAL_SERVER_PARITY_NOTE }}</p>
      </details>
    </section>

    <section class="grid gap-3 lg:grid-cols-4">
      <article
        v-for="item in operationalImpactCards"
        :key="item.id"
        class="rounded-[8px] border border-slate-200 bg-white px-5 py-4"
      >
        <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">{{ item.label }}</p>
        <p class="mt-3 text-[1.8rem] font-semibold leading-none text-slate-950">{{ item.value }}</p>
        <p class="mt-2 text-xs leading-5 text-slate-600">{{ item.helper }}</p>
      </article>
    </section>

    <details
      class="crm-panel overflow-hidden"
      :open="managerOverview.ruleImpactHints.length > 0"
    >
      <summary class="cursor-pointer list-none px-5 py-4 text-base font-semibold text-slate-950">
        Alertas da área
        <span class="ml-2 text-sm font-normal text-slate-600">
          {{ managerOverview.ruleImpactHints.length ? `${managerOverview.ruleImpactHints.length} alerta(s)` : 'nenhum alerta forte' }}
        </span>
      </summary>
      <div class="grid gap-3 border-t border-slate-200 px-5 py-4">
        <article
          v-for="hint in managerOverview.ruleImpactHints"
          :key="hint.id"
          :class="['rounded-[8px] border px-4 py-3', impactHintToneClass(hint.tone)]"
        >
          <p class="text-sm font-semibold text-slate-950">{{ hint.title }}</p>
          <p class="mt-1 text-sm leading-6 text-slate-700">{{ hint.description }}</p>
        </article>
        <p v-if="!managerOverview.ruleImpactHints.length" class="text-sm leading-6 text-slate-600">
          Sem alerta forte de regra no recorte atual.
        </p>
      </div>
    </details>

    <section class="rounded-[8px] border border-slate-200 bg-white">
      <div class="border-b border-slate-200 px-5 py-4">
        <p class="text-base font-semibold text-slate-950">Distribuição por assunto</p>
        <p class="mt-1 text-sm leading-6 text-slate-600">
          Defina quem pode consultar o assunto e quem recebe novos casos. A distribuição automática é o padrão e considera carga, disponibilidade e capacidade.
        </p>
      </div>

      <div
        v-if="feedback.scope.message"
        :class="[
          'border-b border-slate-200 px-5 py-3 text-sm font-medium',
          feedback.scope.type === 'error'
            ? 'bg-[rgba(166,31,40,0.06)] text-[var(--color-danger)]'
            : 'bg-[rgba(26,111,67,0.06)] text-[var(--color-success)]',
        ]"
      >
        {{ feedback.scope.message }}
      </div>

      <div class="divide-y divide-slate-200">
        <article
          v-for="row in governanceRows"
          :key="row.id"
          :class="[
            isRuleOpen(row) ? 'crm-split-grid items-start gap-4' : 'block',
            'px-5 py-4',
          ]"
        >
          <button
            type="button"
            class="w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            :aria-expanded="isRuleOpen(row) ? 'true' : 'false'"
            :aria-controls="`area-rule-editor-${row.id}`"
            @click="toggleRule(row.id)"
          >
            <p class="text-sm font-semibold text-slate-950">{{ row.subjectLabel }}</p>
            <p class="mt-1 text-xs text-slate-500">
              Atualizado por {{ row.updatedBy || 'Gestão da área' }}<span v-if="row.updatedAtLabel"> | {{ row.updatedAtLabel }}</span>
            </p>

            <div class="mt-4 grid gap-3 sm:grid-cols-3">
              <span class="block rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                <span class="block text-xs font-semibold uppercase tracking-normal text-slate-500">Backlog</span>
                <span class="mt-2 block text-sm font-semibold text-slate-900">{{ row.openCases }}</span>
              </span>
              <span class="block rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                <span class="block text-xs font-semibold uppercase tracking-normal text-slate-500">Vencidos</span>
                <span class="mt-2 block text-sm font-semibold text-slate-900">{{ row.overdueCases }}</span>
              </span>
              <span class="block rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                <span class="block text-xs font-semibold uppercase tracking-normal text-slate-500">Em risco</span>
                <span class="mt-2 block text-sm font-semibold text-slate-900">{{ row.riskCases }}</span>
              </span>
            </div>
            <span class="mt-3 inline-flex text-xs font-semibold text-[#0b6e8c]">
              {{ isRuleOpen(row) ? 'Fechar configuração' : 'Configurar este assunto' }}
            </span>
          </button>

          <div
            v-if="isRuleOpen(row)"
            :id="`area-rule-editor-${row.id}`"
            class="rounded-[8px] border border-slate-200 bg-slate-50/70 px-4 py-4"
          >
            <div :class="['mb-4 rounded-[8px] border px-3 py-2 text-xs leading-5', rowRiskState(row).toneClass]">
              <p class="font-semibold">{{ rowRiskState(row).label }}</p>
              <p class="mt-1">{{ rowRiskState(row).helper }}</p>
              <RouterLink
                :to="buildRuleQueueRoute(row)"
                class="mt-2 inline-flex items-center font-semibold transition hover:underline"
              >
                Abrir fila deste assunto
              </RouterLink>
            </div>

            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">Quem pode consultar</span>
              <select
                v-model="draftFor(row).visibilityMode"
                class="rounded-[8px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
              >
                <option value="team">Todo o time da área</option>
                <option value="restricted">Pessoas selecionadas</option>
              </select>
            </label>

            <div v-if="draftFor(row).visibilityMode === 'restricted'" class="mt-4 grid gap-2">
              <p class="text-sm font-semibold text-slate-700">Pessoas que podem consultar</p>
              <label
                v-for="member in areaMemberOptions"
                :key="`${row.id}-visibility-${member.profileId}`"
                class="flex items-center gap-3 rounded-[8px] border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
              >
                <input
                  :checked="containsMember(draftFor(row).visibilityUsers, member)"
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300"
                  @change="toggleMember(row.id, 'visibilityUsers', member)"
                />
                <span>{{ member.displayName }}</span>
              </label>
            </div>

            <label class="mt-4 grid gap-2">
              <span class="text-sm font-semibold text-slate-700">Quem recebe novos casos</span>
              <select
                v-model="draftFor(row).distributionMode"
                class="rounded-[8px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
              >
                <option value="automatic">Distribuição automática</option>
                <option value="restricted">Pessoas selecionadas</option>
              </select>
              <span class="text-xs leading-5 text-slate-500">
                Automática escolhe analistas ativos pela menor carga ponderada e usa o gestor como fallback.
              </span>
            </label>

            <div v-if="draftFor(row).distributionMode === 'restricted'" class="mt-4 grid gap-2">
              <p class="text-sm font-semibold text-slate-700">Pessoas que recebem</p>
              <label
                v-for="member in areaMemberOptions"
                :key="`${row.id}-distribution-${member.profileId}`"
                class="flex items-center gap-3 rounded-[8px] border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
              >
                <input
                  :checked="containsMember(draftFor(row).distributionUsers, member)"
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300"
                  @change="toggleMember(row.id, 'distributionUsers', member)"
                />
                <span>{{ member.displayName }}</span>
              </label>
              <p class="text-xs leading-5 text-slate-500">
                Se todas estiverem indisponíveis, o caso fica sem responsável e o gestor será sinalizado.
              </p>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-[8px] bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                @click="saveScopeRule(row)"
              >
                Salvar regra
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>

    <details class="crm-panel overflow-hidden">
      <summary class="cursor-pointer list-none px-5 py-4 text-base font-semibold text-slate-950">
        Disponibilidade da equipe
        <span class="ml-2 text-sm font-normal text-slate-600">indisponibilidade e capacidade reduzida</span>
      </summary>

      <div class="grid gap-4 border-t border-slate-200 p-5 xl:grid-cols-2">
        <article class="rounded-[8px] border border-slate-200 bg-white">
          <div
            v-if="feedback.availability.message"
            :class="[
              'border-b border-slate-200 px-5 py-3 text-sm font-medium',
              feedback.availability.type === 'error'
                ? 'bg-[rgba(166,31,40,0.06)] text-[var(--color-danger)]'
                : 'bg-[rgba(26,111,67,0.06)] text-[var(--color-success)]',
            ]"
          >
            {{ feedback.availability.message }}
          </div>

          <div class="grid gap-3 px-5 py-5">
            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">Pessoa</span>
              <select
                v-model="availabilityForm.userId"
                class="rounded-[8px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
                @change="availabilityForm.userName = areaMemberOptions.find((member) => member.profileId === availabilityForm.userId)?.displayName || ''"
              >
                <option value="">Selecione</option>
                <option v-for="member in areaMemberOptions" :key="member.profileId" :value="member.profileId">
                  {{ member.displayName }}
                </option>
              </select>
            </label>

            <div class="grid gap-3 md:grid-cols-2">
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-700">Recorte</span>
                <select
                  v-model="availabilityForm.scope"
                  class="rounded-[8px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
                >
                  <option value="current_area">Somente esta área</option>
                  <option value="global">Todas as áreas do usuário</option>
                </select>
              </label>

              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-700">Estado</span>
                <select
                  v-model="availabilityForm.statusCode"
                  class="rounded-[8px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
                >
                  <option value="unavailable">Indisponível</option>
                  <option value="reduced_capacity">Capacidade reduzida</option>
                  <option value="available">Disponível</option>
                </select>
              </label>
            </div>

            <div class="grid gap-3 md:grid-cols-2">
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-700">Motivo</span>
                <select
                  v-model="availabilityForm.reasonType"
                  class="rounded-[8px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
                >
                  <option value="vacation">Férias</option>
                  <option value="leave">Licença</option>
                  <option value="temporary_unavailable">Indisponibilidade temporária</option>
                  <option value="other">Outro motivo</option>
                </select>
              </label>

              <label v-if="availabilityForm.statusCode === 'reduced_capacity'" class="grid gap-2">
                <span class="text-sm font-semibold text-slate-700">Fator de capacidade</span>
                <select
                  v-model="availabilityForm.capacityFactor"
                  class="rounded-[8px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
                >
                  <option value="0.25">25%</option>
                  <option value="0.5">50%</option>
                  <option value="0.75">75%</option>
                </select>
              </label>
            </div>

            <div class="grid gap-3 md:grid-cols-2">
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-700">Início</span>
                <input
                  v-model="availabilityForm.startsAt"
                  type="datetime-local"
                  class="rounded-[8px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
                />
              </label>

              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-700">Fim</span>
                <input
                  v-model="availabilityForm.endsAt"
                  type="datetime-local"
                  class="rounded-[8px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
                />
              </label>
            </div>

            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">Observação operacional</span>
              <textarea
                v-model="availabilityForm.notes"
                rows="3"
                class="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
                placeholder="Explique o motivo ou a restrição relevante para a distribuição."
              ></textarea>
            </label>

            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-[8px] bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                @click="saveAvailability"
              >
                Registrar disponibilidade
              </button>
            </div>
          </div>
        </article>

        <article class="rounded-[8px] border border-slate-200 bg-white">
          <div class="border-b border-slate-200 px-5 py-4">
            <p class="text-base font-semibold text-slate-950">Registros ativos</p>
            <p class="mt-1 text-sm leading-6 text-slate-600">
              Janelas que hoje alteram a distribuição e a capacidade da equipe.
            </p>
          </div>

          <details class="m-4 rounded-[8px] border border-slate-200 bg-slate-50">
            <summary class="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-700">
              Ver registros ativos ({{ availabilityRows.length }})
            </summary>

            <div v-if="availabilityRows.length" class="grid gap-3 border-t border-slate-200 px-5 py-5">
              <div
                v-for="record in availabilityRows"
                :key="record.id"
                class="rounded-[8px] border border-slate-200 bg-slate-50/70 px-4 py-4"
              >
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold text-slate-950">{{ record.userName }}</p>
                    <p class="mt-1 text-xs text-slate-500">{{ formatScopeLabel(record) }}</p>
                  </div>
                  <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {{ statusLabel(record.statusCode) }}
                  </span>
                </div>

                <div class="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                  <p><span class="font-semibold text-slate-900">Motivo:</span> {{ reasonLabel(record.reasonType) }}</p>
                  <p><span class="font-semibold text-slate-900">Janela:</span> {{ record.startsAt }} até {{ record.endsAt }}</p>
                  <p v-if="record.statusCode === 'reduced_capacity'">
                    <span class="font-semibold text-slate-900">Capacidade:</span> {{ Math.round((record.capacityFactor || 0) * 100) }}%
                  </p>
                  <p v-if="record.notes"><span class="font-semibold text-slate-900">Observação:</span> {{ record.notes }}</p>
                </div>
              </div>
            </div>

            <div v-else class="border-t border-slate-200 px-5 py-5 text-sm leading-6 text-slate-600">
              Nenhuma janela de disponibilidade foi registrada para este time ainda.
            </div>
          </details>
        </article>
      </div>
    </details>
  </div>
</template>
