<script setup>
import { computed, reactive } from 'vue'
import ActionTile from '@/components/ActionTile.vue'
import MetricCard from '@/components/MetricCard.vue'
import PriorityBadge from '@/components/PriorityBadge.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import SlaBadge from '@/components/SlaBadge.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import {
  buildOperatorQueueFilterOptions,
  buildOperatorQueueMetrics,
  filterOperatorQueueEntries,
} from '@/services/operatorQueueRuntime'
import { useStudentSupportStore } from '@/stores/studentSupport'
import { operatorActionCards } from '../../../mocks/operations'

const studentSupportStore = useStudentSupportStore()

const filters = reactive({
  status: 'todos',
  theme: 'todos',
  criticality: 'todos',
})

const operatorQueueEntries = computed(() => studentSupportStore.operatorQueueEntries)
const filterOptions = computed(() => buildOperatorQueueFilterOptions(operatorQueueEntries.value))
const filteredQueue = computed(() =>
  filterOperatorQueueEntries(operatorQueueEntries.value, filters),
)
const metrics = computed(() => buildOperatorQueueMetrics(operatorQueueEntries.value))
</script>

<template>
  <div class="grid gap-6">
    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        v-for="metric in metrics"
        :key="metric.label"
        :label="metric.label"
        :value="metric.value"
        :hint="metric.hint"
      />
    </section>

    <div class="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
      <SectionPanel
        eyebrow="OP"
        title="Fila operacional do polo"
        description="Fila inicial do OP consumindo protocolos do aluno e casos mockados da operacao. A ordenacao prioriza prioridade, criticidade e ultima movimentacao."
      >
        <template #action>
          <span class="rounded-full bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 ring-1 ring-slate-200">
            {{ filteredQueue.length }} em tela
          </span>
        </template>

        <div class="grid gap-4">
          <div class="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50/75 p-4 md:grid-cols-3">
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
          </div>

          <div class="flex flex-wrap gap-2 text-xs text-slate-600">
            <span class="rounded-full bg-slate-100 px-3 py-1">
              Ordenado por prioridade, criticidade e hora de movimentacao
            </span>
            <span class="rounded-full bg-slate-100 px-3 py-1">
              Fonte oficial da resposta: portal do atendimento
            </span>
          </div>

          <div v-if="filteredQueue.length" class="grid gap-3">
            <article
              v-for="item in filteredQueue"
              :key="item.id"
              class="inner-panel p-5"
            >
              <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      {{ item.id }}
                    </p>
                    <span class="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-primary-dark)]">
                      {{ item.sourceLabel }}
                    </span>
                  </div>
                  <h3 class="mt-3 text-lg font-semibold text-slate-950">{{ item.subject }}</h3>
                  <p class="mt-2 text-sm leading-6 text-slate-600">
                    {{ item.theme }} · {{ item.subsubject }}
                  </p>
                  <p class="mt-2 text-sm leading-6 text-slate-600">
                    {{ item.student }} · Polo {{ item.polo }}
                  </p>
                </div>

                <div class="flex flex-wrap gap-2">
                  <PriorityBadge :priority="item.priority" />
                  <StatusBadge :label="item.criticality" />
                  <StatusBadge :label="item.status" />
                  <SlaBadge :label="item.sla" />
                </div>
              </div>

              <div class="mt-5 grid gap-3 text-sm text-slate-600 md:grid-cols-4">
                <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Fila</p>
                  <p class="mt-2 font-semibold text-slate-900">{{ item.queue }}</p>
                </div>
                <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Tema</p>
                  <p class="mt-2 font-semibold text-slate-900">{{ item.theme }}</p>
                </div>
                <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Subassunto</p>
                  <p class="mt-2 font-semibold text-slate-900">{{ item.subsubject }}</p>
                </div>
                <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Data/hora</p>
                  <p class="mt-2 font-semibold text-slate-900">{{ item.activityAtLabel }}</p>
                </div>
              </div>

              <div class="mt-4 flex flex-wrap gap-3">
                <RouterLink
                  :to="`/op/fila/${item.id}`"
                  class="rounded-[18px] bg-[var(--color-primary)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_28px_rgba(209,50,57,0.18)]"
                >
                  Abrir detalhe operacional
                </RouterLink>
                <span class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  {{ item.pendingLabel }}
                </span>
              </div>
            </article>
          </div>

          <div v-else class="inner-panel p-6">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Nenhum atendimento encontrado
            </p>
            <h3 class="mt-3 text-2xl font-semibold text-slate-950">
              Os filtros atuais nao retornaram itens na fila.
            </h3>
            <p class="mt-3 text-sm leading-7 text-slate-600">
              Ajuste status, tema ou criticidade para retomar a leitura operacional da fila.
            </p>
          </div>
        </div>
      </SectionPanel>

      <div class="grid gap-6">
        <SectionPanel
          eyebrow="Acao"
          title="Acoes esperadas do OP"
          description="A fila do OP precisa responder no portal, solicitar complementacao quando necessario e escalar o caso com briefing pronto."
        >
          <div class="grid gap-3">
            <ActionTile
              v-for="card in operatorActionCards"
              :key="card.title"
              :title="card.title"
              :description="card.description"
              eyebrow="Operacao"
            />
          </div>
        </SectionPanel>

        <SectionPanel
          eyebrow="Leitura"
          title="Como esta fila prioriza"
          description="A base atual ja prepara o comportamento operacional antes da tela de detalhe."
        >
          <div class="grid gap-3">
            <div class="inner-panel p-5">
              <p class="text-sm font-semibold text-slate-950">1. Prioridade</p>
              <p class="mt-2 text-sm leading-6 text-slate-600">
                Casos marcados como maxima e alta sobem primeiro.
              </p>
            </div>
            <div class="inner-panel p-5">
              <p class="text-sm font-semibold text-slate-950">2. Criticidade</p>
              <p class="mt-2 text-sm leading-6 text-slate-600">
                Entre itens equivalentes, criticidade critica e alta recebem destaque visual.
              </p>
            </div>
            <div class="inner-panel p-5">
              <p class="text-sm font-semibold text-slate-950">3. Hora de movimentacao</p>
              <p class="mt-2 text-sm leading-6 text-slate-600">
                Empates sao resolvidos pela hora de entrada ou pela ultima movimentacao mais recente.
              </p>
            </div>
          </div>
        </SectionPanel>
      </div>
    </div>
  </div>
</template>
