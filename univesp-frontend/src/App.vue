<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppSidebar from '@/components/AppSidebar.vue'
import { useAuthStore } from '@/stores/auth'
import { useJourneyStore } from '@/stores/journey'

const route = useRoute()
const auth = useAuthStore()
const journey = useJourneyStore()

const pageTitle = computed(() => route.meta.title || 'UNIVESP Service Blueprint')
const isAuthLayout = computed(() => route.meta.layout === 'auth')

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
  <div v-if="isAuthLayout" class="relative min-h-screen overflow-hidden">
    <RouterView />
  </div>

  <div v-else class="relative min-h-screen overflow-hidden">
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
            <span class="soft-chip">Central de Atendimento UNIVESP</span>
            <h1 class="mt-4 text-4xl font-semibold text-slate-950">{{ pageTitle }}</h1>
            <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Camada frontend da UNIVESP para receber o aluno, apoiar a operacao e preparar a
              gestao para a futura integracao com Frappe via API.
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <div class="inner-panel px-4 py-3">
              <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Usuario
              </p>
              <p class="mt-2 text-sm font-semibold text-slate-900">
                {{ auth.displayName || journey.customer.email }}
              </p>
            </div>
            <div class="inner-panel px-4 py-3">
              <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Protocolo
              </p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ journey.session.protocol }}</p>
            </div>
            <div class="inner-panel px-4 py-3">
              <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Identificacao
              </p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ journey.customer.ssoStatus }}</p>
            </div>
            <div class="inner-panel px-4 py-3">
              <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Fila atual
              </p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ journey.activeFlow.queue }}</p>
            </div>
            <button
              type="button"
              class="inline-flex items-center rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              @click="auth.logout()"
            >
              Sair
            </button>
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
