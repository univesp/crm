<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { journeyStages } from '@/data/flowBlueprint'
import { useJourneyStore } from '@/stores/journey'

const route = useRoute()
const journey = useJourneyStore()

const links = journeyStages
const activeFlow = computed(() => journey.activeFlow)
</script>

<template>
  <aside class="w-full lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-[330px] xl:w-[350px]">
    <div class="surface-panel rise-in flex h-full flex-col gap-6 p-5">
      <div>
        <span class="soft-chip">UNIVESP service studio</span>
        <h2 class="mt-4 text-3xl font-semibold text-slate-950">
          Atendimento com ticket, IA e handoff
        </h2>
        <p class="mt-3 text-sm leading-6 text-slate-600">
          Estrutura para desenhar a experiencia antes de plugar APIs reais de Frappe, chatbot e
          autenticacao institucional.
        </p>
      </div>

      <nav class="grid gap-2">
        <RouterLink
          v-for="item in links"
          :key="item.id"
          :to="item.route"
          :class="['nav-link', route.path === item.route ? 'is-active' : '']"
        >
          <div
            :class="[
              'mt-1.5 h-2.5 w-2.5 rounded-full transition-all',
              route.path === item.route ? 'bg-amber-300' : 'bg-slate-300',
            ]"
          ></div>
          <div>
            <p class="text-sm font-semibold">{{ item.label }}</p>
            <p
              :class="[
                'mt-1 text-xs leading-5',
                route.path === item.route ? 'text-white/75' : 'text-slate-500',
              ]"
            >
              {{ item.description }}
            </p>
          </div>
        </RouterLink>
      </nav>

      <div class="rounded-[28px] bg-slate-950 p-5 text-white">
        <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/50">
          Fluxo ativo
        </p>
        <h3 class="mt-3 text-2xl font-semibold">{{ activeFlow.name }}</h3>
        <p class="mt-3 text-sm leading-6 text-white/75">{{ activeFlow.summary }}</p>

        <div class="mt-5 grid gap-3 text-sm">
          <div class="rounded-[20px] bg-white/10 px-4 py-3">
            <p class="text-white/55">Fila alvo</p>
            <p class="mt-1 font-medium text-white">{{ activeFlow.queue }}</p>
          </div>
          <div class="rounded-[20px] bg-white/10 px-4 py-3">
            <p class="text-white/55">SLA esperado</p>
            <p class="mt-1 font-medium text-white">{{ activeFlow.expectedSla }}</p>
          </div>
          <div class="rounded-[20px] bg-white/10 px-4 py-3">
            <p class="text-white/55">Objetivo da IA</p>
            <p class="mt-1 font-medium text-white">{{ activeFlow.aiGoal }}</p>
          </div>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
        <div class="inner-panel px-4 py-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Frappe
          </p>
          <p class="mt-2 text-sm font-semibold text-slate-900">Ticket, timeline e fila humana</p>
        </div>
        <div class="inner-panel px-4 py-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">IA</p>
          <p class="mt-2 text-sm font-semibold text-slate-900">Triagem, resposta e resumo do caso</p>
        </div>
        <div class="inner-panel px-4 py-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">SSO</p>
          <p class="mt-2 text-sm font-semibold text-slate-900">SAML para carregar RA, polo e perfil</p>
        </div>
      </div>
    </div>
  </aside>
</template>
