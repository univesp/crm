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
  embedded: {
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
  <component :is="embedded ? 'div' : 'section'" :class="embedded ? 'mt-3' : 'crm-panel'">
    <div v-if="!embedded" class="border-b border-[var(--border-default)] px-5 py-4">
      <div class="crm-panel-header 2xl:flex-row 2xl:items-start 2xl:justify-between">
        <div class="crm-panel-header__copy">
          <h2 class="crm-page-title mt-1 text-lg">
            SLAs atrasados e prestes a estourar
            <span v-if="scopeLabel" class="text-base font-medium text-[var(--color-text-muted)]">· {{ scopeLabel }}</span>
          </h2>
          <p class="crm-page-description mt-2">{{ subtitle }}</p>
        </div>

        <div
          :class="[
            'crm-kpi-strip shrink-0',
            compact ? 'sm:max-w-md' : '2xl:max-w-[17.5rem]',
          ]"
        >
          <div class="crm-kpi-tile crm-state-danger">
            <p class="crm-kpi-tile__value">{{ kpis.overdue }}</p>
            <p class="crm-kpi-tile__label">Atrasados</p>
          </div>
          <div class="crm-kpi-tile crm-state-warning">
            <p class="crm-kpi-tile__value">{{ kpis.atRisk }}</p>
            <p class="crm-kpi-tile__label">Em risco</p>
          </div>
          <div class="crm-kpi-tile crm-card-muted">
            <p class="crm-kpi-tile__value">{{ kpis.active }}</p>
            <p class="crm-kpi-tile__label">Ativos</p>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="hasCases"
      :class="embedded ? 'grid gap-4 pt-1 xl:grid-cols-2' : 'grid gap-4 px-5 py-4 xl:grid-cols-2'"
    >
      <section>
        <div class="mb-3 flex items-center justify-between gap-2">
          <p class="text-sm font-semibold text-[var(--color-text)]">Atrasados agora</p>
          <span class="crm-chip crm-state-danger">Ação imediata</span>
        </div>

        <div v-if="overdueCases.length" class="crm-cockpit-queue" :class="{ 'crm-table-scroll--bounded-lg': embedded }">
          <article
            v-for="item in overdueCases"
            :key="`overdue-${item.id}`"
            class="crm-cockpit-row"
          >
            <div class="crm-cockpit-row__accent crm-cockpit-row__accent--danger" aria-hidden="true" />
            <div class="crm-cockpit-row__body">
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
            </div>
          </article>
        </div>

        <p v-else class="py-2 text-sm text-[var(--color-text-muted)]">
          Nenhum SLA atrasado no recorte atual.
        </p>
      </section>

      <section>
        <div class="mb-3 flex items-center justify-between gap-2">
          <p class="text-sm font-semibold text-[var(--color-text)]">Prestes a estourar</p>
          <span class="crm-chip crm-state-warning">Antecipar ação</span>
        </div>

        <div v-if="atRiskCases.length" class="crm-cockpit-queue" :class="{ 'crm-table-scroll--bounded-lg': embedded }">
          <article
            v-for="item in atRiskCases"
            :key="`risk-${item.id}`"
            class="crm-cockpit-row"
          >
            <div class="crm-cockpit-row__accent crm-cockpit-row__accent--warning" aria-hidden="true" />
            <div class="crm-cockpit-row__body">
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
            </div>
          </article>
        </div>

        <p v-else class="py-2 text-sm text-[var(--color-text-muted)]">
          Nenhum caso em risco imediato no recorte atual.
        </p>
      </section>
    </div>

    <div v-else :class="embedded ? 'pt-1' : 'px-5 py-5'">
      <p class="text-sm leading-6 text-[var(--color-text-muted)]">
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
  </component>
</template>
