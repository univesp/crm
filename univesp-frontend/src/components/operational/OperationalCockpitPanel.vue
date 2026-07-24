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
  <section class="crm-panel">
    <div class="border-b border-[var(--border-default)] px-5 py-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div class="max-w-3xl">
          <p class="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{{ title }}</p>
          <h2 class="crm-page-title mt-1 text-lg">
            SLAs atrasados e prestes a estourar
            <span v-if="scopeLabel" class="text-base font-medium text-[var(--color-text-muted)]">· {{ scopeLabel }}</span>
          </h2>
          <p class="crm-page-description mt-2">{{ subtitle }}</p>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div class="crm-card crm-state-danger px-3 py-2 text-center">
            <p class="text-[1.35rem] font-semibold leading-none text-[var(--color-text)]">{{ kpis.overdue }}</p>
            <p class="mt-1 text-[11px] font-semibold text-[var(--color-text-muted)]">Atrasados</p>
          </div>
          <div class="crm-card crm-state-warning px-3 py-2 text-center">
            <p class="text-[1.35rem] font-semibold leading-none text-[var(--color-text)]">{{ kpis.atRisk }}</p>
            <p class="mt-1 text-[11px] font-semibold text-[var(--color-text-muted)]">Em risco</p>
          </div>
          <div class="crm-card-muted px-3 py-2 text-center">
            <p class="text-[1.35rem] font-semibold leading-none text-[var(--color-text)]">{{ kpis.active }}</p>
            <p class="mt-1 text-[11px] font-semibold text-[var(--color-text-muted)]">Ativos</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="hasCases" class="grid gap-4 px-5 py-4 xl:grid-cols-2">
      <section>
        <div class="mb-3 flex items-center justify-between gap-2">
          <p class="text-sm font-semibold text-[var(--color-text)]">Atrasados agora</p>
          <span class="crm-chip crm-state-danger">Ação imediata</span>
        </div>

        <div v-if="overdueCases.length" class="grid gap-3">
          <article
            v-for="item in overdueCases"
            :key="`overdue-${item.id}`"
            class="crm-card crm-state-danger"
          >
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div class="min-w-0">
                <p class="text-xs font-semibold text-[var(--color-text-muted)]">{{ item.id }}</p>
                <h3 class="mt-1 text-sm font-semibold text-[var(--color-text)]">{{ item.subject }}</h3>
                <p class="mt-1 text-xs text-[var(--color-text-muted)]">
                  {{ item.student }} · Polo {{ item.polo }} · {{ item.theme }}
                </p>
                <p class="mt-1 text-xs text-[var(--color-text-muted)]">
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
              <RouterLink :to="item.interveneRoute" class="crm-button-primary px-3 py-2 text-xs">
                Assumir / acelerar
              </RouterLink>
              <RouterLink :to="item.caseRoute" class="crm-button-secondary px-3 py-2 text-xs">
                Abrir caso
              </RouterLink>
            </div>
          </article>
        </div>

        <p v-else class="crm-card-muted text-sm text-[var(--color-text-muted)]">
          Nenhum SLA atrasado no recorte atual.
        </p>
      </section>

      <section>
        <div class="mb-3 flex items-center justify-between gap-2">
          <p class="text-sm font-semibold text-[var(--color-text)]">Prestes a estourar</p>
          <span class="crm-chip crm-state-warning">Antecipar ação</span>
        </div>

        <div v-if="atRiskCases.length" class="grid gap-3">
          <article
            v-for="item in atRiskCases"
            :key="`risk-${item.id}`"
            class="crm-card crm-state-warning"
          >
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div class="min-w-0">
                <p class="text-xs font-semibold text-[var(--color-text-muted)]">{{ item.id }}</p>
                <h3 class="mt-1 text-sm font-semibold text-[var(--color-text)]">{{ item.subject }}</h3>
                <p class="mt-1 text-xs text-[var(--color-text-muted)]">
                  {{ item.student }} · Polo {{ item.polo }} · {{ item.theme }}
                </p>
                <p class="mt-1 text-xs text-[var(--color-text-muted)]">
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
              <RouterLink :to="item.interveneRoute" class="crm-button-primary px-3 py-2 text-xs">
                Assumir / acelerar
              </RouterLink>
              <RouterLink :to="item.caseRoute" class="crm-button-secondary px-3 py-2 text-xs">
                Abrir caso
              </RouterLink>
            </div>
          </article>
        </div>

        <p v-else class="crm-card-muted text-sm text-[var(--color-text-muted)]">
          Nenhum caso em risco imediato no recorte atual.
        </p>
      </section>
    </div>

    <div v-else class="px-5 py-5">
      <p class="crm-card-muted text-sm leading-6 text-[var(--color-text-muted)]">
        Nenhum SLA atrasado ou em risco no escopo atual. Use
        <strong class="font-semibold text-[var(--color-text)]">Assumir / acelerar</strong>
        quando precisar intervir antes da redistribuição formal.
      </p>
    </div>

    <div
      v-if="!compact"
      class="border-t border-[var(--border-default)] px-5 py-3 text-xs leading-5 text-[var(--color-text-muted)]"
    >
      Assumir registra a intervenção no histórico do protocolo e mantém o caso na fila correta.
    </div>
  </section>
</template>
