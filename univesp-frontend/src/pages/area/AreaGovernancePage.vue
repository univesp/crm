<script setup>
import { computed, reactive, watch } from 'vue'

import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()

const governanceRows = computed(() => studentSupportStore.areaGovernanceRows(auth.mockContext))
const areaTeamMembers = computed(() => studentSupportStore.areaTeamMembers(auth.mockContext.currentArea))
const availabilityRows = computed(() =>
  studentSupportStore.userAvailabilityCatalog
    .filter(
      (record) =>
        areaTeamMembers.value.includes(record.userName) &&
        (!record.areaLabel || record.areaLabel === auth.mockContext.currentArea),
    )
    .sort((left, right) => new Date(right.startsAt || 0).getTime() - new Date(left.startsAt || 0).getTime()),
)

const scopeDrafts = reactive({})
const feedback = reactive({
  scope: { type: '', message: '' },
  availability: { type: '', message: '' },
})
const availabilityForm = reactive({
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
    accessMode: row.accessMode || 'team',
    allowedAnalysts: [...(row.allowedAnalysts || [])],
  }
}

function draftFor(row) {
  ensureScopeDraft(row)
  return scopeDrafts[row.id]
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
    }
  },
  { immediate: true },
)

function toggleAnalyst(rowId, analystName) {
  const draft = scopeDrafts[rowId]
  if (!draft) {
    return
  }

  const exists = draft.allowedAnalysts.includes(analystName)
  draft.allowedAnalysts = exists
    ? draft.allowedAnalysts.filter((item) => item !== analystName)
    : [...draft.allowedAnalysts, analystName]
}

function saveScopeRule(row) {
  const draft = scopeDrafts[row.id]
  if (!draft) {
    return
  }

  studentSupportStore.upsertAreaSubjectRule({
    areaLabel: auth.mockContext.currentArea,
    themeKey: row.themeKey,
    subsubjectKey: row.subsubjectKey,
    subjectLabel: row.subjectLabel,
    accessMode: draft.accessMode,
    allowedAnalysts: draft.accessMode === 'restricted' ? draft.allowedAnalysts : [],
    actorName: auth.mockContext.userName,
  })

  feedback.scope.type = 'success'
  feedback.scope.message = `Regra de escopo atualizada para ${row.subjectLabel}.`
}

function statusLabel(statusCode = '') {
  if (statusCode === 'reduced_capacity') {
    return 'Capacidade reduzida'
  }

  if (statusCode === 'unavailable') {
    return 'Indisponivel'
  }

  return 'Disponivel'
}

function reasonLabel(reasonType = '') {
  if (reasonType === 'vacation') {
    return 'Ferias'
  }

  if (reasonType === 'leave') {
    return 'Licenca'
  }

  if (reasonType === 'temporary_unavailable') {
    return 'Indisponibilidade temporaria'
  }

  return 'Outro motivo'
}

function formatScopeLabel(record) {
  return record.areaLabel ? `Somente ${record.areaLabel}` : 'Todas as areas do usuario'
}

function resetAvailabilityForm() {
  availabilityForm.scope = 'current_area'
  availabilityForm.statusCode = 'unavailable'
  availabilityForm.reasonType = 'vacation'
  availabilityForm.capacityFactor = '0.5'
  availabilityForm.startsAt = ''
  availabilityForm.endsAt = ''
  availabilityForm.notes = ''
}

function saveAvailability() {
  if (!availabilityForm.userName || !availabilityForm.startsAt || !availabilityForm.endsAt) {
    feedback.availability.type = 'error'
    feedback.availability.message = 'Preencha pessoa, inicio e fim para registrar a disponibilidade.'
    return
  }

  studentSupportStore.upsertUserAvailability({
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

  feedback.availability.type = 'success'
  feedback.availability.message = `Disponibilidade registrada para ${availabilityForm.userName}.`
  resetAvailabilityForm()
}
</script>

<template>
  <div class="grid gap-4">
    <section class="rounded-[16px] border border-slate-200 bg-white px-5 py-5">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div class="max-w-[760px]">
          <p class="text-sm font-semibold text-slate-900">
            Use esta camada para definir quem pode tratar cada assunto e quem esta disponivel para receber novos casos. Aqui ficam as regras operacionais da area, sem misturar aprovacao de conteudo.
          </p>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            Conteudo vigente fica em outra camada. Mudancas pendentes e aprovacao tambem. Esta pagina deve servir para segurar distribuicao, ownership e excecao operacional do time.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <RouterLink
            to="/area/orientacao"
            class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Conteudo vigente
          </RouterLink>
          <RouterLink
            to="/area/mudancas"
            class="rounded-[14px] bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Mudancas pendentes
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="rounded-[16px] border border-slate-200 bg-white">
      <div class="border-b border-slate-200 px-5 py-4">
        <p class="text-base font-semibold text-slate-950">Escopo e visibilidade por assunto</p>
        <p class="mt-1 text-sm leading-6 text-slate-600">
          Defina se o subassunto fica aberto para todo o time ou restrito a analistas especificos. Essa regra afeta visibilidade e distribuicao, nao so filtro visual.
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
          class="grid gap-4 px-5 py-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)]"
        >
          <div>
            <p class="text-sm font-semibold text-slate-950">{{ row.subjectLabel }}</p>
            <p class="mt-1 text-xs text-slate-500">
              Atualizado por {{ row.updatedBy || 'Gestao da area' }}<span v-if="row.updatedAtLabel"> | {{ row.updatedAtLabel }}</span>
            </p>

            <div class="mt-4 grid gap-3 sm:grid-cols-3">
              <div class="rounded-[12px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Backlog</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ row.openCases }}</p>
              </div>
              <div class="rounded-[12px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Vencidos</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ row.overdueCases }}</p>
              </div>
              <div class="rounded-[12px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Em risco</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ row.riskCases }}</p>
              </div>
            </div>
          </div>

          <div class="rounded-[14px] border border-slate-200 bg-slate-50/70 px-4 py-4">
            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">Regra de visibilidade</span>
              <select
                v-model="draftFor(row).accessMode"
                class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
              >
                <option value="team">Todo o time ve este assunto</option>
                <option value="restricted">Somente analistas selecionados</option>
              </select>
            </label>

            <div v-if="draftFor(row).accessMode === 'restricted'" class="mt-4 grid gap-2">
              <p class="text-sm font-semibold text-slate-700">Analistas autorizados</p>
              <label
                v-for="analyst in areaTeamMembers"
                :key="`${row.id}-${analyst}`"
                class="flex items-center gap-3 rounded-[12px] border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
              >
                <input
                  :checked="draftFor(row).allowedAnalysts.includes(analyst)"
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300"
                  @change="toggleAnalyst(row.id, analyst)"
                />
                <span>{{ analyst }}</span>
              </label>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-[14px] bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                @click="saveScopeRule(row)"
              >
                Salvar regra
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section class="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <article class="rounded-[16px] border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-5 py-4">
          <p class="text-base font-semibold text-slate-950">Disponibilidade do time</p>
          <p class="mt-1 text-sm leading-6 text-slate-600">
            Registre ferias, licenca, ausencia ou capacidade reduzida. Isso muda a distribuicao automatica sem exigir redistribuicao manual caso a caso.
          </p>
        </div>

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
              v-model="availabilityForm.userName"
              class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
            >
              <option value="">Selecione</option>
              <option v-for="analyst in areaTeamMembers" :key="analyst" :value="analyst">
                {{ analyst }}
              </option>
            </select>
          </label>

          <div class="grid gap-3 md:grid-cols-2">
            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">Recorte</span>
              <select
                v-model="availabilityForm.scope"
                class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
              >
                <option value="current_area">Somente esta area</option>
                <option value="global">Todas as areas do usuario</option>
              </select>
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">Estado</span>
              <select
                v-model="availabilityForm.statusCode"
                class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
              >
                <option value="unavailable">Indisponivel</option>
                <option value="reduced_capacity">Capacidade reduzida</option>
                <option value="available">Disponivel</option>
              </select>
            </label>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">Motivo</span>
              <select
                v-model="availabilityForm.reasonType"
                class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
              >
                <option value="vacation">Ferias</option>
                <option value="leave">Licenca</option>
                <option value="temporary_unavailable">Indisponibilidade temporaria</option>
                <option value="other">Outro motivo</option>
              </select>
            </label>

            <label v-if="availabilityForm.statusCode === 'reduced_capacity'" class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">Fator de capacidade</span>
              <select
                v-model="availabilityForm.capacityFactor"
                class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
              >
                <option value="0.25">25%</option>
                <option value="0.5">50%</option>
                <option value="0.75">75%</option>
              </select>
            </label>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">Inicio</span>
              <input
                v-model="availabilityForm.startsAt"
                type="datetime-local"
                class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
              />
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">Fim</span>
              <input
                v-model="availabilityForm.endsAt"
                type="datetime-local"
                class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
              />
            </label>
          </div>

          <label class="grid gap-2">
            <span class="text-sm font-semibold text-slate-700">Observacao operacional</span>
            <textarea
              v-model="availabilityForm.notes"
              rows="3"
              class="rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
              placeholder="Explique o motivo ou a restricao relevante para a distribuicao."
            ></textarea>
          </label>

          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-[14px] bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              @click="saveAvailability"
            >
              Registrar disponibilidade
            </button>
          </div>
        </div>
      </article>

      <article class="rounded-[16px] border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-5 py-4">
          <p class="text-base font-semibold text-slate-950">Janelas ativas do time</p>
          <p class="mt-1 text-sm leading-6 text-slate-600">
            Leitura rapida das regras que hoje impactam distribuicao, reatribuicao e capacidade do time.
          </p>
        </div>

        <div v-if="availabilityRows.length" class="grid gap-3 px-5 py-5">
          <div
            v-for="record in availabilityRows"
            :key="record.id"
            class="rounded-[14px] border border-slate-200 bg-slate-50/70 px-4 py-4"
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
              <p><span class="font-semibold text-slate-900">Janela:</span> {{ record.startsAt }} ate {{ record.endsAt }}</p>
              <p v-if="record.statusCode === 'reduced_capacity'">
                <span class="font-semibold text-slate-900">Capacidade:</span> {{ Math.round((record.capacityFactor || 0) * 100) }}%
              </p>
              <p v-if="record.notes"><span class="font-semibold text-slate-900">Observacao:</span> {{ record.notes }}</p>
            </div>
          </div>
        </div>

        <div v-else class="px-5 py-5 text-sm leading-6 text-slate-600">
          Nenhuma janela de disponibilidade foi registrada para este time ainda.
        </div>
      </article>
    </section>
  </div>
</template>
