<script setup>
import ActionTile from '@/components/ActionTile.vue'
import MetricCard from '@/components/MetricCard.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { adminAreaBreakdown, adminDashboardStats, adminGovernanceCards } from '../../../mocks/operations'
</script>

<template>
  <div class="grid gap-6">
    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        v-for="stat in adminDashboardStats"
        :key="stat.label"
        :label="stat.label"
        :value="stat.value"
        :hint="stat.hint"
      />
    </section>

    <div class="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <SectionPanel
        eyebrow="Admin"
        title="Dashboard geral"
        description="Visao inicial para backlog, risco de SLA e leitura por area do atendimento."
      >
        <div class="grid gap-3">
          <div
            v-for="area in adminAreaBreakdown"
            :key="area.area"
            class="inner-panel p-5"
          >
            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 class="text-lg font-semibold text-slate-950">{{ area.area }}</h3>
                <p class="mt-2 text-sm leading-6 text-slate-600">{{ area.note }}</p>
              </div>
              <StatusBadge :label="area.slaRisk" />
            </div>
            <div class="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
              <span class="rounded-full bg-slate-100 px-3 py-1">
                Casos abertos: {{ area.openCases }}
              </span>
            </div>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Governanca"
        title="Controles estruturais"
        description="Blocos que sustentam a camada administrativa e de gestao."
      >
        <div class="grid gap-3">
          <ActionTile
            v-for="card in adminGovernanceCards"
            :key="card.title"
            :title="card.title"
            :description="card.description"
            eyebrow="Admin"
          />
        </div>
      </SectionPanel>
    </div>
  </div>
</template>
