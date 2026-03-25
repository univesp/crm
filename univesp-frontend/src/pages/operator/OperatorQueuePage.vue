<script setup>
import ActionTile from '@/components/ActionTile.vue'
import MetricCard from '@/components/MetricCard.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { operatorActionCards, operatorQueue } from '../../../mocks/operations'
</script>

<template>
  <div class="grid gap-6">
    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Fila ativa" :value="operatorQueue.length" hint="Casos aguardando acao do OP." />
      <MetricCard label="Criticos" :value="1" hint="Demandam tratamento imediato." />
      <MetricCard label="Em SLA curto" :value="2" hint="Casos com janela operacional reduzida." />
      <MetricCard label="Abertos pelo aluno" :value="3" hint="Fluxos gerados pelo portal institucional." />
    </section>

    <div class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <SectionPanel
        eyebrow="OP"
        title="Fila operacional do polo"
        description="Base visual para a fila do OP com priorizacao por SLA, criticidade e contexto do caso."
      >
        <div class="grid gap-3">
          <div
            v-for="item in operatorQueue"
            :key="item.id"
            class="inner-panel p-5"
          >
            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {{ item.id }}
                </p>
                <h3 class="mt-2 text-lg font-semibold text-slate-950">{{ item.subject }}</h3>
                <p class="mt-2 text-sm leading-6 text-slate-600">
                  {{ item.student }} - {{ item.queue }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <StatusBadge :label="item.criticality" />
                <StatusBadge :label="item.status" />
              </div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
              <span class="rounded-full bg-slate-100 px-3 py-1">SLA: {{ item.sla }}</span>
            </div>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Acao"
        title="Acoes esperadas do OP"
        description="A fila do OP precisa levar a resposta ate o portal ou encaminhar o caso ao last mile com briefing pronto."
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
    </div>
  </div>
</template>
