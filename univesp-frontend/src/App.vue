<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppSidebar from '@/components/AppSidebar.vue'
import { useJourneyStore } from '@/stores/journey'

const route = useRoute()
const journey = useJourneyStore()

const pageTitle = computed(() => route.meta.title || 'UNIVESP Service Blueprint')

watch(
  () => route.meta.stage,
  (stage) => {
    if (stage) {
      journey.setStage(stage)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute -left-16 top-10 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl"></div>
      <div class="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl"></div>
      <div class="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl"></div>
    </div>

    <div class="relative mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-4 lg:flex-row lg:px-6">
      <AppSidebar />

      <main class="flex-1 pb-8">
        <header class="surface-panel rise-in mb-6 flex flex-col gap-5 p-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span class="soft-chip">Omnichannel blueprint</span>
            <h1 class="mt-4 text-4xl font-semibold text-slate-950">{{ pageTitle }}</h1>
            <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Base para desenhar triagem inicial, contrato do ticket, conversa com IA e transferencia
              para atendimento humano sem perder contexto.
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <div class="inner-panel px-4 py-3">
              <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Protocolo
              </p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ journey.session.protocol }}</p>
            </div>
            <div class="inner-panel px-4 py-3">
              <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Cliente
              </p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ journey.customer.ssoStatus }}</p>
            </div>
            <div class="inner-panel px-4 py-3">
              <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Prioridade
              </p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ journey.session.priority }}</p>
            </div>
          </div>
        </header>

        <RouterView v-slot="{ Component }">
          <Transition name="route" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>
