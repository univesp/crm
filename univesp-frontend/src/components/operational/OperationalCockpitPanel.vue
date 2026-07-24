<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import PriorityBadge from '@/components/PriorityBadge.vue'
import SlaBadge from '@/components/SlaBadge.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { buildOperationalCockpitSubtitle } from '@/services/operationalCockpitRuntime'

const props = defineProps({
  cockpit: {
    type: Object,
    required: true,
  },
  compact: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: 'Cockpit operacional',
  },
})

const subtitle = computed(() => buildOperationalCockpitSubtitle(props.cockpit?.profileKey))
const overdueCases = computed(() => props.cockpit?.overdueCases || [])
const atRiskCases = computed(() => props.cockpit?.atRiskCases || [])
const kpis = computed(() => props.cockpit?.kpis || { overdue: 0, atRisk: 0, active: 0 })
const scopeLabel = computed(() => props.cockpit?.scopeLabel || '')
const hasCases = computed(() => overdueCases.value.length || atRiskCases.value.length)
</script>

<template>
  <section class="rounded-[8px] border border-slate-200 bg-white">
    <div class="border-b border-slate-200 px-5 py-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div class="max-w-3xl">
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">{{ title }}</p>
          <h2 class="mt-1 text-lg font-semibold text-slate-950">
            SLAs atrasados e prestes a estourar
            <span v-if="scopeLabel" class="text-base font-medium text-slate-500">· {{ scopeLabel }}</span>
          </h2>
          <p class="mt-2 text-sm leading-6 text-slate-600">{{ subtitle }}</p>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div class="rounded-[8px] border border-[rgba(166,31,40,0.16)] bg-[rgba(253,236,237,0.72)] px-3 py-2 text-center">
            <p class="text-[1.35rem] font-semibold leading-none text-slate-950">{{ kpis.overdue }}</p>
            <p class="mt-1 text-[11px] font-semibold text-slate-600">Atrasados</p>
          </div>
          <div class="rounded-[8px] border border-[rgba(202,138,4,0.16)] bg-[rgba(254,243,199,0.72)] px-3 py-2 text-center">
            <p class="text-[1.35rem] font-semibold leading-none text-slate-950">{{ kpis.atRisk }}</p>
            <p class="mt-1 text-[11px] font-semibold text-slate-600">Em risco</p>
          </div>
          <div class="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-center">
            <p class="text-[1.35rem] font-semibold leading-none text-slate-950">{{ kpis.active }}</p>
            <p class="mt-1 text-[11px] font-semibold text-slate-600">Ativos</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="hasCases" class="grid gap-4 px-5 py-4 xl:grid-cols-2">
      <section>
        <div class="mb-3 flex items-center justify-between gap-2">
          <p class="text-sm font-semibold text-slate-950">Atrasados agora</p>
          <span class="rounded-full bg-[rgba(253,236,237,0.9)] px-2.5 py-1 text-[11px] font-semibold text-[#8f1d24]">
            Acao imediata
          </span>
        </div>

        <div v-if="overdueCases.length" class="grid gap-3">
          <article
            v-for="item in overdueCases"
            :key="`overdue-${item.id}`"
            class="rounded-[8px] border border-[rgba(166,31,40,0.14)] bg-[rgba(253,236,237,0.35)] p-4"
          >
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div class="min-w-0">
                <p class="text-xs font-semibold text-slate-500">{{ item.id }}</p>
                <h3 class="mt-1 text-sm font-semibold text-slate-950">{{ item.subject }}</h3>
                <p class="mt-1 text-xs text-slate-600">
                  {{ item.student }} · Polo {{ item.polo }} · {{ item.theme }}
                </p>
                <p class="mt-1 text-xs text-slate-500">
                  {{ item.queue }} · {{ item.assignedOperator }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <PriorityBadge :priority="item.criticality" />
                <StatusBadge :label="item.status" />
                <SlaBadge :label="item.sla" />
              </div>
            </div>

            <div class="mt-3 flex flex-wrap gap-2">
              <RouterLink
                :to="item.caseRoute"
                class="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Abrir caso
              </RouterLink>
              <RouterLink
                :to="item.interveneRoute"
                class="rounded-[8px] bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                Assumir / acelerar
              </RouterLink>
            </div>
          </article>
        </div>

        <p v-else class="rounded-[8px] border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Nenhum SLA atrasado no recorte atual.
        </p>
      </section>

      <section>
        <div class="mb-3 flex items-center justify-between gap-2">
          <p class="text-sm font-semibold text-slate-950">Prestes a estourar</p>
          <span class="rounded-full bg-[rgba(254,243,199,0.9)] px-2.5 py-1 text-[11px] font-semibold text-[#92600a]">
            Antecipar acao
          </span>
        </div>

        <div v-if="atRiskCases.length" class="grid gap-3">
          <article
            v-for="item in atRiskCases"
            :key="`risk-${item.id}`"
            class="rounded-[8px] border border-[rgba(202,138,4,0.14)] bg-[rgba(254,243,199,0.35)] p-4"
          >
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div class="min-w-0">
                <p class="text-xs font-semibold text-slate-500">{{ item.id }}</p>
                <h3 class="mt-1 text-sm font-semibold text-slate-950">{{ item.subject }}</h3>
                <p class="mt-1 text-xs text-slate-600">
                  {{ item.student }} · Polo {{ item.polo }} · {{ item.theme }}
                </p>
                <p class="mt-1 text-xs text-slate-500">
                  {{ item.queue }} · {{ item.assignedOperator }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <PriorityBadge :priority="item.criticality" />
                <StatusBadge :label="item.status" />
                <SlaBadge :label="item.sla" />
              </div>
            </div>

            <div class="mt-3 flex flex-wrap gap-2">
              <RouterLink
                :to="item.caseRoute"
                class="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Abrir caso
              </RouterLink>
              <RouterLink
                :to="item.interveneRoute"
                class="rounded-[8px] bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                Assumir / acelerar
              </RouterLink>
            </div>
          </article>
        </div>

        <p v-else class="rounded-[8px] border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Nenhum caso em risco imediato no recorte atual.
        </p>
      </section>
    </div>

    <div v-else class="px-5 py-5">
      <p class="rounded-[8px] border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
        Nenhum SLA atrasado ou em risco no escopo atual. Continue monitorando a fila e use
        <strong class="font-semibold text-slate-800">Assumir / acelerar</strong>
        quando precisar intervir sem esperar redistribuicao formal.
      </p>
    </div>

    <div
      v-if="!compact"
      class="border-t border-slate-100 px-5 py-3 text-xs leading-5 text-slate-500"
    >
      Intervencao rapida nao substitui a fila da hierarquia: registra assumir caso, acelera tratativa e
      mantem rastreabilidade no historico do protocolo.
    </div>
  </section>
</template>
