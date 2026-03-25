<script setup>
import { computed, reactive } from 'vue'
import ActionTile from '@/components/ActionTile.vue'
import MetricCard from '@/components/MetricCard.vue'
import PriorityBadge from '@/components/PriorityBadge.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import SlaBadge from '@/components/SlaBadge.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { buildAdminDashboardView } from '@/services/adminDashboardRuntime'
import { useStudentSupportStore } from '@/stores/studentSupport'

const studentSupportStore = useStudentSupportStore()

const filters = reactive({
  queue: 'todos',
  status: 'todos',
  criticality: 'todos',
  theme: 'todos',
})

const dashboardBase = computed(() => studentSupportStore.adminDashboardData)
const dashboardView = computed(() => buildAdminDashboardView(dashboardBase.value, filters))
const filterOptions = computed(() => dashboardBase.value.filterOptions)
const metrics = computed(() => dashboardView.value.kpis)
const queueSummary = computed(() => dashboardView.value.queueSummary)
const auditEntries = computed(() => dashboardView.value.auditEntries)
const activeCases = computed(() => dashboardView.value.activeCases.slice(0, 4))
const governanceCards = computed(() => dashboardView.value.governanceCards)
</script>

<template>
  <div class="grid gap-6">
    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
      <MetricCard
        v-for="metric in metrics"
        :key="metric.label"
        :label="metric.label"
        :value="metric.value"
        :hint="metric.hint"
      />
    </section>

    <div class="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <SectionPanel
        eyebrow="Gestao"
        title="Leitura executiva por fila"
        description="O dashboard administrativo consolida fila ativa do OP, protocolos do aluno, resolvidos pela FAQ e auditoria operacional na mesma base mockada."
      >
        <template #action>
          <span class="rounded-full bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 ring-1 ring-slate-200">
            {{ dashboardView.activeCases.length }} casos ativos em tela
          </span>
        </template>

        <div class="grid gap-4">
          <div class="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50/75 p-4 md:grid-cols-2 xl:grid-cols-4">
            <label class="grid gap-2">
              <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Area / fila</span>
              <select
                v-model="filters.queue"
                class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              >
                <option
                  v-for="option in filterOptions.queue"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>

            <label class="grid gap-2">
              <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</span>
              <select
                v-model="filters.status"
                class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              >
                <option
                  v-for="option in filterOptions.status"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>

            <label class="grid gap-2">
              <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Criticidade</span>
              <select
                v-model="filters.criticality"
                class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              >
                <option
                  v-for="option in filterOptions.criticality"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>

            <label class="grid gap-2">
              <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tema</span>
              <select
                v-model="filters.theme"
                class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              >
                <option
                  v-for="option in filterOptions.theme"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>
          </div>

          <div class="flex flex-wrap gap-2 text-xs text-slate-600">
            <span class="rounded-full bg-slate-100 px-3 py-1">
              Fonte da auditoria: operatorActionLogs locais + seeds mockados
            </span>
            <span class="rounded-full bg-slate-100 px-3 py-1">
              Base canonica compartilhada com a fila e o detalhe operacional
            </span>
          </div>

          <div v-if="queueSummary.length" class="grid gap-3">
            <article
              v-for="area in queueSummary"
              :key="area.queue"
              class="inner-panel p-5"
            >
              <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {{ area.queue }}
                  </p>
                  <h3 class="mt-3 text-xl font-semibold text-slate-950">
                    {{ area.volume }} caso(s) na leitura atual
                  </h3>
                  <p class="mt-2 text-sm leading-6 text-slate-600">
                    Tema dominante: {{ area.dominantTheme }}
                  </p>
                </div>

                <div class="flex flex-wrap gap-2">
                  <StatusBadge :label="area.criticalityLabel" />
                  <SlaBadge :label="area.slaLabel" />
                  <StatusBadge :label="`${area.escalationsCount} escalonamento(s)`" />
                </div>
              </div>

              <div class="mt-5 grid gap-3 text-sm text-slate-600 md:grid-cols-4">
                <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Volume</p>
                  <p class="mt-2 font-semibold text-slate-900">{{ area.volume }}</p>
                </div>
                <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Criticidade</p>
                  <p class="mt-2 font-semibold text-slate-900">{{ area.highCriticalityCount }}</p>
                </div>
                <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">SLA vencido</p>
                  <p class="mt-2 font-semibold text-slate-900">{{ area.slaOverdueCount }}</p>
                </div>
                <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Escalonados</p>
                  <p class="mt-2 font-semibold text-slate-900">{{ area.escalationsCount }}</p>
                </div>
              </div>
            </article>
          </div>

          <div v-else class="inner-panel p-6">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Nenhuma fila encontrada
            </p>
            <h3 class="mt-3 text-2xl font-semibold text-slate-950">
              Os filtros atuais nao retornaram leitura executiva por area.
            </h3>
            <p class="mt-3 text-sm leading-7 text-slate-600">
              Ajuste fila, status, criticidade ou tema para retomar a visao administrativa.
            </p>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Auditoria"
        title="Acoes do OP e escalonamentos"
        description="Toda movimentacao relevante do OP fica auditavel com ator, caso, fila e transicao de status na mesma base mockada."
      >
        <template #action>
          <span class="rounded-full bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 ring-1 ring-slate-200">
            {{ auditEntries.length }} evento(s)
          </span>
        </template>

        <div v-if="auditEntries.length" class="grid gap-3">
          <article
            v-for="entry in auditEntries"
            :key="entry.id"
            class="inner-panel p-5"
          >
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {{ entry.caseId }}
                  </p>
                  <StatusBadge :label="entry.actionLabel" />
                </div>
                <h3 class="mt-3 text-lg font-semibold text-slate-950">{{ entry.subject }}</h3>
                <p class="mt-2 text-sm leading-6 text-slate-600">
                  {{ entry.actor }} Â· {{ entry.occurredAtLabel }}
                </p>
                <p class="mt-2 text-sm leading-6 text-slate-600">
                  {{ entry.student }} Â· Polo {{ entry.polo }} Â· {{ entry.theme }}
                </p>
              </div>

              <div class="flex flex-wrap gap-2">
                <StatusBadge :label="entry.criticality" />
                <StatusBadge :label="entry.queueAfter" />
              </div>
            </div>

            <div class="mt-5 grid gap-3 md:grid-cols-2">
              <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Antes</p>
                <p class="mt-2 font-semibold text-slate-900">{{ entry.statusBefore }}</p>
                <p class="mt-2 text-sm text-slate-600">{{ entry.queueBefore }}</p>
              </div>
              <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Depois</p>
                <p class="mt-2 font-semibold text-slate-900">{{ entry.statusAfter }}</p>
                <p class="mt-2 text-sm text-slate-600">{{ entry.queueAfter }}</p>
              </div>
            </div>

            <p class="mt-4 text-sm leading-6 text-slate-600">{{ entry.note }}</p>

            <div class="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
              <span
                v-if="entry.escalationReason"
                class="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 font-semibold uppercase tracking-[0.18em] text-[var(--color-primary-dark)]"
              >
                Motivo: {{ entry.escalationReason }}
              </span>
              <span class="rounded-full bg-slate-100 px-3 py-1">
                Status atual: {{ entry.status }}
              </span>
            </div>
          </article>
        </div>

        <div v-else class="inner-panel p-6">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Nenhum evento auditavel
          </p>
          <h3 class="mt-3 text-2xl font-semibold text-slate-950">
            A leitura atual nao encontrou movimentos do OP.
          </h3>
          <p class="mt-3 text-sm leading-7 text-slate-600">
            Ajuste os filtros ou gere novas acoes operacionais para alimentar a trilha de auditoria.
          </p>
        </div>
      </SectionPanel>
    </div>

    <div class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <SectionPanel
        eyebrow="Observacao"
        title="Casos que merecem leitura de gestao"
        description="Amostra dos casos ativos mais sensiveis na leitura atual, herdando prioridade, criticidade e sinais de recorrencia."
      >
        <div v-if="activeCases.length" class="grid gap-3">
          <article
            v-for="item in activeCases"
            :key="item.id"
            class="inner-panel p-5"
          >
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {{ item.id }}
                </p>
                <h3 class="mt-3 text-lg font-semibold text-slate-950">{{ item.subject }}</h3>
                <p class="mt-2 text-sm leading-6 text-slate-600">
                  {{ item.student }} Â· Polo {{ item.polo }}
                </p>
                <p class="mt-2 text-sm leading-6 text-slate-600">
                  {{ item.theme }} Â· {{ item.subsubject }}
                </p>
              </div>

              <div class="flex flex-wrap gap-2">
                <PriorityBadge :priority="item.priority" />
                <StatusBadge :label="item.criticality" />
                <StatusBadge :label="item.status" />
                <SlaBadge :label="item.sla" />
              </div>
            </div>

            <div class="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
              <span
                v-if="item.recurrenceSignals?.repeatedTheme"
                class="rounded-full bg-slate-100 px-3 py-1"
              >
                Repeticao no mesmo tema
              </span>
              <span
                v-if="item.recurrenceSignals?.repeatedSubsubject"
                class="rounded-full bg-slate-100 px-3 py-1"
              >
                Repeticao no mesmo subtema
              </span>
              <span
                v-if="item.recurrenceSignals?.priorSelfServiceRelated"
                class="rounded-full bg-slate-100 px-3 py-1"
              >
                Autoatendimento previo relacionado
              </span>
              <span class="rounded-full bg-slate-100 px-3 py-1">
                {{ item.queue }}
              </span>
            </div>
          </article>
        </div>

        <div v-else class="inner-panel p-6">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Nenhum caso ativo
          </p>
          <h3 class="mt-3 text-2xl font-semibold text-slate-950">
            Nao ha casos ativos para observacao com os filtros atuais.
          </h3>
          <p class="mt-3 text-sm leading-7 text-slate-600">
            Ajuste a leitura executiva para recuperar uma amostra operacional relevante.
          </p>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Governanca"
        title="Leituras imediatas para a gestao"
        description="Cards executivos para a proxima camada de governanca sobre FAQ, SLA, criticidade e auditoria."
      >
        <div class="grid gap-3 md:grid-cols-2">
          <ActionTile
            v-for="card in governanceCards"
            :key="card.title"
            :title="card.title"
            :description="card.description"
            :eyebrow="card.eyebrow"
          />
        </div>
      </SectionPanel>
    </div>
  </div>
</template>
