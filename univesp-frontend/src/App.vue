<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppSidebar from '@/components/AppSidebar.vue'
import MockContextBar from '@/components/MockContextBar.vue'
import { buildShellPresentation } from '@/services/mockContextRuntime'
import { useAuthStore } from '@/stores/auth'
import { useJourneyStore } from '@/stores/journey'

const route = useRoute()
const auth = useAuthStore()
const journey = useJourneyStore()

const pageTitle = computed(() => {
  if (auth.mockContext.isOperationalShell) {
    if (route.name === 'operator-queue') {
      return auth.mockContext.profileKey === 'gestor_polos' ? 'Atendimentos do polo' : 'Meus atendimentos'
    }

    if (route.name === 'operator-case-detail') {
      return 'Analise do caso'
    }

    if (route.name === 'operator-playbook') {
      return 'Consultar orientacao'
    }

    if (route.name === 'operator-assisted-intake') {
      return 'Abrir atendimento em nome do aluno'
    }
  }

  return route.meta.title || 'UNIVESP Service Blueprint'
})
const isAuthLayout = computed(() => route.meta.layout === 'auth')
const isWireframeLayout = computed(() => route.meta.layout === 'wireframe')
const shellPresentation = computed(() => buildShellPresentation(auth.mockContext))
const isStudentShell = computed(() => auth.mockContext.isStudentShell)
const isOperationalShell = computed(() => auth.mockContext.isOperationalShell)
const shellThemeClass = computed(() => {
  if (auth.mockContext.isStudentShell) {
    return 'shell-student'
  }

  if (auth.mockContext.isOperationalShell) {
    return 'shell-operational'
  }

  return 'shell-governance'
})

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

  <div v-else-if="isWireframeLayout" class="min-h-screen bg-[#f5f4ff] text-slate-950">
    <RouterView />
  </div>

  <div v-else :class="['relative min-h-screen overflow-hidden', shellThemeClass]">
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute -left-16 top-10 h-64 w-64 rounded-full bg-[rgba(209,50,57,0.12)] blur-3xl"></div>
      <div class="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-[rgba(16,18,20,0.06)] blur-3xl"></div>
      <div class="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[rgba(128,130,133,0.08)] blur-3xl"></div>
    </div>

    <div
      :class="[
        'relative mx-auto flex min-h-screen flex-col px-4 py-4 lg:flex-row',
        isStudentShell
          ? 'max-w-[1280px] gap-4 lg:px-4 lg:py-5'
          : isOperationalShell
            ? 'max-w-[1380px] gap-3 lg:px-4 lg:py-3.5'
            : 'max-w-[1540px] gap-5 lg:px-6',
      ]"
    >
      <div :class="isStudentShell ? 'hidden lg:block' : ''">
        <AppSidebar />
      </div>

      <main class="flex-1 pb-8">
        <MockContextBar v-if="!isStudentShell && !isOperationalShell" />

        <header
          v-if="!isStudentShell"
          :class="[
            isOperationalShell
              ? 'mb-2 flex flex-col gap-2 px-1 py-0.5 md:flex-row md:items-center md:justify-between'
              : 'surface-panel rise-in mb-4 flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between',
          ]"
        >
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span
                :class="[
                  'rounded-full px-3 py-1 text-xs font-semibold',
                  isOperationalShell
                    ? 'border border-slate-200 bg-white text-slate-700'
                    : 'soft-chip',
                ]"
              >
                {{ isOperationalShell ? (auth.mockContext.profileKey === 'gestor_polos' ? 'Gestao do polo' : 'Operacao do polo') : shellPresentation.label }}
              </span>
              <span
                v-if="isOperationalShell"
                class="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
              >
                {{ auth.mockContext.currentPolo }}
              </span>
              <span
                v-else
                class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
              >
                {{ auth.mockContext.profileLabel }}
              </span>
            </div>
            <h1
              :class="[
                'mt-3 font-semibold text-slate-950',
                isOperationalShell ? 'text-[1.35rem] md:text-[1.5rem]' : 'text-[2rem] md:text-[2.3rem]',
              ]"
            >
              {{ pageTitle }}
            </h1>
            <p
              v-if="!isOperationalShell"
              class="mt-2 max-w-3xl text-sm leading-6 text-slate-600"
            >
              {{ shellPresentation.description }}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <div
              :class="[
                'border border-slate-200 text-sm text-slate-700',
                isOperationalShell
                  ? 'rounded-full bg-white px-3.5 py-2'
                  : 'rounded-[20px] bg-slate-50/80 px-4 py-3',
              ]"
            >
              <p class="font-semibold text-slate-900">{{ auth.mockContext.userName }}</p>
              <p v-if="!isOperationalShell" class="mt-1">{{ auth.mockContext.userEmail }}</p>
              <p v-if="!isOperationalShell" class="mt-1">Polo atual: {{ auth.mockContext.currentPolo }}</p>
            </div>
            <button
              type="button"
              class="inline-flex items-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
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
