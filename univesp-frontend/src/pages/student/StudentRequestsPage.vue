<script setup>
import { computed, nextTick, ref } from 'vue'

import StatusBadge from '@/components/StatusBadge.vue'
import StudentStageLayout from '@/components/student/StudentStageLayout.vue'
import { buildStudentRequestSections, buildStudentRequestSummary } from '@/services/studentPortalRuntime'
import { useStudentSupportStore } from '@/stores/studentSupport'

const studentSupportStore = useStudentSupportStore()
const searchQuery = ref('')
const periodFilter = ref('all')
const openSections = ref({
  drafts: false,
  actionRequired: false,
  waiting: false,
  completed: false,
})
const sectionElements = ref({})

const requestSections = computed(() =>
  buildStudentRequestSections({
    protocolDraft: studentSupportStore.protocolDraft,
    records: studentSupportStore.records,
    protocols: studentSupportStore.protocols,
    query: searchQuery.value,
    period: periodFilter.value,
  }),
)
const requestSummary = computed(() => buildStudentRequestSummary(requestSections.value))
const completedSubsections = computed(() => ({
  answered: requestSections.value.completed.filter((item) => item.studentState === 'answered_in_portal'),
  concluded: requestSections.value.completed.filter((item) => item.studentState === 'completed'),
}))

const sections = computed(() => [
  {
    key: 'drafts',
    title: 'Em preenchimento',
    empty: 'Nenhuma solicitação em preenchimento no momento.',
    tone: {
      sectionClass: 'border-slate-200 bg-white',
      countClass: 'bg-slate-100 text-slate-600',
      markerClass: 'bg-slate-400',
      accentClass: 'text-slate-700',
    },
  },
  {
    key: 'actionRequired',
    title: 'Precisa da minha ação',
    empty: 'Nenhum registro aguardando ação sua no momento.',
    tone: {
      sectionClass: 'border-[rgba(209,50,57,0.18)] bg-[rgba(209,50,57,0.04)]',
      countClass: 'bg-[rgba(209,50,57,0.12)] text-[var(--color-danger)]',
      markerClass: 'bg-[var(--color-danger)]',
      accentClass: 'text-[var(--color-danger)]',
    },
  },
  {
    key: 'waiting',
    title: 'Aguardando atendimento',
    empty: 'Nenhum registro aguardando atendimento no momento.',
    tone: {
      sectionClass: 'border-[rgba(154,90,0,0.18)] bg-[rgba(154,90,0,0.04)]',
      countClass: 'bg-[rgba(154,90,0,0.12)] text-[var(--color-warning)]',
      markerClass: 'bg-[var(--color-warning)]',
      accentClass: 'text-[var(--color-warning)]',
    },
  },
  {
    key: 'completed',
    title: 'Atendido / Concluido',
    empty: 'Nenhum registro finalizado no momento.',
    tone: {
      sectionClass: 'border-[rgba(26,111,67,0.18)] bg-[rgba(26,111,67,0.04)]',
      countClass: 'bg-[rgba(26,111,67,0.12)] text-[var(--color-success)]',
      markerClass: 'bg-[var(--color-success)]',
      accentClass: 'text-[var(--color-success)]',
    },
  },
])

const latestVisibleEntry = computed(() =>
  Object.values(requestSections.value)
    .flat()
    .sort((left, right) => (right.timestampMs || 0) - (left.timestampMs || 0))[0] || null,
)

const hasFilteredResults = computed(() => requestSummary.value.hasResults)
const showNoResults = computed(() =>
  Boolean(searchQuery.value.trim().length || periodFilter.value !== 'all') && !hasFilteredResults.value,
)

function toggleSection(sectionKey) {
  openSections.value = {
    ...openSections.value,
    [sectionKey]: !openSections.value[sectionKey],
  }
}

function setSectionElement(sectionKey, element) {
  if (!element) {
    delete sectionElements.value[sectionKey]
    return
  }

  sectionElements.value[sectionKey] = element
}

function openActionRequiredSection() {
  openSections.value = {
    drafts: false,
    actionRequired: true,
    waiting: false,
    completed: false,
  }

  nextTick(() => {
    sectionElements.value.actionRequired?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
    document.getElementById('student-request-trigger-actionRequired')?.focus()
  })
}
</script>

<template>
  <StudentStageLayout
    eyebrow="Minhas solicitações"
    title="Acompanhe seus registros no portal"
    description="Aqui aparecem protocolos enviados e respostas registradas no portal."
    mobile-label="Minhas solicitações"
    aside-title="Resumo"
  >
    <div class="grid gap-4">
      <button
        v-if="requestSummary.actionRequiredCount > 0"
        type="button"
        class="student-focus-ring rounded-[8px] border border-[rgba(209,50,57,0.16)] bg-[rgba(209,50,57,0.06)] p-5 text-left transition hover:bg-[rgba(209,50,57,0.09)]"
        @click="openActionRequiredSection"
      >
        <p class="student-section-label text-[var(--color-primary-dark)]">Pendencia importante</p>
        <p class="mt-3 text-base font-semibold text-slate-950">
          {{
            requestSummary.actionRequiredCount === 1
              ? 'Você tem 1 solicitação que precisa da sua ação.'
              : `Você tem ${requestSummary.actionRequiredCount} solicitações que precisam da sua ação.`
          }}
        </p>
        <p class="mt-2 text-sm leading-6 text-slate-700">
          Abra o grupo correspondente para conferir o que ainda precisa ser enviado ou respondido.
        </p>
      </button>

      <div class="crm-filter-grid rounded-[8px] border border-slate-200 bg-white/88 p-5">
        <label class="grid gap-2">
          <span class="text-sm font-semibold text-slate-900">Buscar por assunto ou protocolo</span>
          <input
            v-model="searchQuery"
            type="search"
            class="student-focus-ring rounded-[8px] border border-slate-200 bg-slate-50/85 px-4 py-3 text-sm text-slate-700 focus:bg-white"
            placeholder="Ex.: rematricula ou UVSP-20260326-173141"
            aria-describedby="student-request-search-help"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm font-semibold text-slate-900">Periodo</span>
          <select
            v-model="periodFilter"
            class="student-focus-ring rounded-[8px] border border-slate-200 bg-slate-50/85 px-4 py-3 text-sm text-slate-700 focus:bg-white"
            aria-describedby="student-request-search-help"
          >
            <option value="all">Todos</option>
            <option value="7d">Ultimos 7 dias</option>
            <option value="30d">Ultimos 30 dias</option>
            <option value="semester">Este semestre</option>
          </select>
        </label>

        <p id="student-request-search-help" class="text-sm leading-6 text-slate-600 md:col-span-2">
          Busque pelo assunto da dúvida ou pelo numero do protocolo. O filtro de periodo funciona como atalho simples.
        </p>
      </div>

      <div
        v-if="showNoResults"
        class="rounded-[8px] border border-slate-200 bg-slate-50/85 px-5 py-4 text-sm leading-6 text-slate-700"
        role="status"
        aria-live="polite"
      >
        Nenhum registro encontrado para a busca ou periodo selecionado.
      </div>

      <section
        v-for="section in sections"
        :key="section.key"
        :ref="(element) => setSectionElement(section.key, element)"
        :class="['rounded-[8px] border transition', section.tone.sectionClass]"
      >
        <button
          :id="`student-request-trigger-${section.key}`"
          type="button"
          class="student-focus-ring flex w-full items-center justify-between gap-4 px-5 py-5 text-left"
          :aria-expanded="openSections[section.key] ? 'true' : 'false'"
          :aria-controls="`student-request-panel-${section.key}`"
          :aria-label="`${openSections[section.key] ? 'Recolher' : 'Expandir'} grupo ${section.title}`"
          @click="toggleSection(section.key)"
        >
          <div class="flex items-center gap-3">
            <span :class="['h-2.5 w-2.5 rounded-full', section.tone.markerClass]"></span>
            <h3 class="text-base font-semibold text-slate-950">{{ section.title }}</h3>
          </div>
          <div class="flex items-center gap-3">
            <span :class="['rounded-full px-3 py-1 text-xs font-semibold', section.tone.countClass]">
              {{ requestSections[section.key].length }}
            </span>
            <span
              aria-hidden="true"
              :class="['text-sm font-semibold', section.tone.accentClass]"
            >
              {{ openSections[section.key] ? '-' : '+' }}
            </span>
          </div>
        </button>

        <div
          v-if="openSections[section.key]"
          :id="`student-request-panel-${section.key}`"
          role="region"
          :aria-labelledby="`student-request-trigger-${section.key}`"
          class="border-t border-slate-200 px-5 py-4"
        >
          <div
            v-if="requestSections[section.key].length"
            class="grid gap-3"
          >
            <template v-if="section.key === 'completed'">
              <div
                v-if="completedSubsections.answered.length"
                class="grid gap-3"
              >
                <p class="student-section-label">Respondidas no portal</p>
                <article
                  v-for="item in completedSubsections.answered"
                  :key="item.id"
                  class="rounded-[8px] border border-[rgba(0,95,153,0.14)] bg-[rgba(0,95,153,0.04)] p-4"
                >
                  <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div class="min-w-0">
                      <h4 class="text-base font-semibold text-slate-950">
                        {{ item.subject }}
                      </h4>
                      <p class="mt-2 text-sm leading-6 text-slate-600">
                        {{ item.statusLabel }} - Atualizado em {{ item.updatedAtLabel }}.
                      </p>
                      <p class="mt-3 text-sm leading-6 text-slate-600">
                        {{ item.id }}
                      </p>
                    </div>

                    <div class="flex flex-wrap items-center gap-3">
                      <StatusBadge :label="item.statusLabel" />
                      <RouterLink
                        v-if="item.route"
                        :to="item.route"
                        class="student-focus-ring inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Ver detalhes
                      </RouterLink>
                    </div>
                  </div>

                  <p class="mt-3 text-sm leading-6 text-slate-600">
                    {{ item.pending }}
                  </p>
                </article>
              </div>

              <div
                v-if="completedSubsections.concluded.length"
                class="grid gap-3"
              >
                <p class="student-section-label">Concluidas</p>
                <article
                  v-for="item in completedSubsections.concluded"
                  :key="item.id"
                  class="rounded-[8px] border border-[rgba(26,111,67,0.14)] bg-[rgba(26,111,67,0.04)] p-4"
                >
                  <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div class="min-w-0">
                      <h4 class="text-base font-semibold text-slate-950">
                        {{ item.subject }}
                      </h4>
                      <p class="mt-2 text-sm leading-6 text-slate-600">
                        {{ item.statusLabel }} - Atualizado em {{ item.updatedAtLabel }}.
                      </p>
                      <p class="mt-3 text-sm leading-6 text-slate-600">
                        {{ item.id }}
                      </p>
                    </div>

                    <div class="flex flex-wrap items-center gap-3">
                      <StatusBadge :label="item.statusLabel" />
                      <RouterLink
                        v-if="item.route"
                        :to="item.route"
                        class="student-focus-ring inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Ver detalhes
                      </RouterLink>
                    </div>
                  </div>

                  <p class="mt-3 text-sm leading-6 text-slate-600">
                    {{ item.pending }}
                  </p>
                </article>
              </div>
            </template>

            <template v-else>
              <article
                v-for="item in requestSections[section.key]"
                :key="item.id"
                class="rounded-[8px] border border-slate-200 bg-slate-50/80 p-4"
              >
                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div class="min-w-0">
                    <h4 class="text-base font-semibold text-slate-950">
                      {{ item.subject }}
                    </h4>
                    <p class="mt-2 text-sm leading-6 text-slate-600">
                      {{ item.statusLabel }} - Atualizado em {{ item.updatedAtLabel }}.
                    </p>
                    <p class="mt-3 text-sm leading-6 text-slate-600">
                      {{ item.id }}
                    </p>
                  </div>

                  <div class="flex flex-wrap items-center gap-3">
                    <StatusBadge :label="item.statusLabel" />
                    <RouterLink
                      v-if="item.route"
                      :to="item.route"
                      class="student-focus-ring inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Ver detalhes
                    </RouterLink>
                  </div>
                </div>

                <p class="mt-3 text-sm leading-6 text-slate-600">
                  {{ item.pending }}
                </p>
              </article>
            </template>
          </div>

          <p v-else class="text-sm leading-6 text-slate-600">
            {{ section.empty }}
          </p>
        </div>
      </section>
    </div>

    <template #aside>
      <div class="grid gap-4">
        <div
          v-if="latestVisibleEntry"
          class="rounded-[8px] border border-slate-200 bg-slate-50/85 p-4"
        >
          <p class="text-sm font-semibold text-slate-900">Registro mais recente</p>
          <p class="mt-2 text-sm font-semibold text-slate-800">
            {{ latestVisibleEntry.subject }}
          </p>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            {{ latestVisibleEntry.id }}
          </p>
        </div>

        <div class="rounded-[8px] border border-slate-200 bg-slate-50/85 p-4">
          <p class="text-sm font-semibold text-slate-900">Como ler esta lista</p>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            O nome da sua dúvida aparece primeiro. O status mostra se você precisa agir, aguardar atendimento, consultar a resposta no portal ou considerar o caso concluido.
          </p>
        </div>
      </div>
    </template>
  </StudentStageLayout>
</template>
