<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { navigationSections } from '@/data/navigation'
import { useJourneyStore } from '@/stores/journey'

const route = useRoute()
const journey = useJourneyStore()

const activeFlow = computed(() => journey.activeFlow)
</script>

<template>
  <aside class="w-full lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-[330px] xl:w-[350px]">
    <div class="surface-panel rise-in flex h-full flex-col gap-6 p-5">
      <div>
        <span class="soft-chip">Atendimento institucional</span>
        <h2 class="mt-4 text-3xl font-semibold text-slate-950">
          Aluno, operacao e gestao na mesma jornada
        </h2>
        <p class="mt-3 text-sm leading-6 text-slate-600">
          Esta base organiza a experiencia do atendimento antes da integracao real com Frappe,
          chatbot institucional e autenticacao SAML.
        </p>
      </div>

      <nav class="grid gap-4">
        <div
          v-for="section in navigationSections"
          :key="section.id"
          class="grid gap-2"
        >
          <p class="px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            {{ section.label }}
          </p>
          <RouterLink
            v-for="item in section.items"
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
        </div>
      </nav>

      <div class="rounded-[28px] bg-slate-950 p-5 text-white">
        <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/50">
          Caso de referencia
        </p>
        <h3 class="mt-3 text-2xl font-semibold">{{ journey.customer.name }}</h3>
        <p class="mt-3 text-sm leading-6 text-white/75">
          {{ journey.customer.course }} em {{ journey.customer.polo }}. O caso ativo usa o fluxo
          abaixo como referencia operacional.
        </p>

        <div class="mt-5 grid gap-3 text-sm">
          <div class="rounded-[20px] bg-white/10 px-4 py-3">
            <p class="text-white/55">Fluxo atual</p>
            <p class="mt-1 font-medium text-white">{{ activeFlow.name }}</p>
          </div>
          <div class="rounded-[20px] bg-white/10 px-4 py-3">
            <p class="text-white/55">Canal de entrada</p>
            <p class="mt-1 font-medium text-white">{{ journey.customer.channel }}</p>
          </div>
          <div class="rounded-[20px] bg-white/10 px-4 py-3">
            <p class="text-white/55">Prioridade do caso</p>
            <p class="mt-1 font-medium text-white">{{ journey.session.priority }}</p>
          </div>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
        <div class="inner-panel px-4 py-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Aluno</p>
          <p class="mt-2 text-sm font-semibold text-slate-900">Entrada simples, protocolo claro e sem recontato</p>
        </div>
        <div class="inner-panel px-4 py-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">OP</p>
          <p class="mt-2 text-sm font-semibold text-slate-900">Fila orientada por contexto, SLA e resumo do caso</p>
        </div>
        <div class="inner-panel px-4 py-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Gestao</p>
          <p class="mt-2 text-sm font-semibold text-slate-900">Governanca das integracoes e evolucao do atendimento</p>
        </div>
      </div>
    </div>
  </aside>
</template>
