<script setup>
import { computed } from 'vue'

import MetricCard from '@/components/MetricCard.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import { useJourneyStore } from '@/stores/journey'

const journey = useJourneyStore()

const transfer = computed(() => journey.transferBrief)
</script>

<template>
  <div class="grid gap-6">
    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Fila destino" :value="journey.activeFlow.queue" hint="Time humano que assume o caso." />
      <MetricCard label="Cliente" :value="journey.customer.name" hint="Caso autenticado, sem coleta repetida." />
      <MetricCard label="SLA de fila" :value="journey.activeFlow.expectedSla" hint="Pode virar prioridade operacional." />
      <MetricCard label="Protocolo" :value="journey.session.protocol" hint="Conecta ticket, bot e atendente." />
    </section>

    <div class="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <SectionPanel
        eyebrow="Transferencia"
        title="Pacote que o atendente deve receber"
        description="O objetivo do handoff e simples: o humano entra no caso com contexto suficiente para resolver, nao para reiniciar a conversa."
      >
        <div class="rounded-[26px] bg-slate-950 p-6 text-white">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">
            Motivo da escalacao
          </p>
          <p class="mt-3 text-sm leading-7 text-white/80">{{ transfer.reason }}</p>
        </div>

        <div class="mt-5 grid gap-3 md:grid-cols-2">
          <div
            v-for="item in transfer.packetItems"
            :key="item.label"
            class="inner-panel p-4"
          >
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              {{ item.label }}
            </p>
            <p class="mt-2 text-sm font-semibold text-slate-900">{{ item.value }}</p>
          </div>
        </div>

        <div class="mt-5 inner-panel p-5">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Resumo narrativo
          </p>
          <p class="mt-3 text-sm leading-7 text-slate-700">{{ transfer.summary }}</p>
        </div>
      </SectionPanel>

      <div class="grid gap-6">
        <SectionPanel
          eyebrow="Foco do atendente"
          title="Checklist antes da primeira resposta humana"
          description="Esses pontos ajudam a padronizar a transicao e reduzem idas e vindas."
        >
          <div class="grid gap-3">
            <div
              v-for="item in transfer.agentFocus"
              :key="item"
              class="inner-panel p-4 text-sm leading-6 text-slate-700"
            >
              {{ item }}
            </div>
          </div>
        </SectionPanel>

        <SectionPanel
          eyebrow="Passos finais"
          title="Acoes obrigatorias antes de fechar o loop"
          description="Mesmo quando houver transferencia, o estado do caso precisa continuar sincronizado."
        >
          <div class="grid gap-3">
            <div
              v-for="step in transfer.nextActions"
              :key="step"
              class="inner-panel p-4 text-sm leading-6 text-slate-700"
            >
              {{ step }}
            </div>
          </div>

          <RouterLink
            to="/integracoes"
            class="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
          >
            Fechar com integracoes
          </RouterLink>
        </SectionPanel>
      </div>
    </div>
  </div>
</template>
