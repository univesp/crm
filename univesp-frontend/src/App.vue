<script setup>
import { computed, onErrorCaptured, ref, watch } from 'vue'
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

    if (route.name === 'area-manager-home') {
      return 'Operacao da area'
    }

    if (route.name === 'area-queue') {
      return auth.mockContext.profileKey === 'gestor_area' ? 'Casos da area' : 'Minha fila da area'
    }

    if (route.name === 'operator-case-detail') {
      return 'Analise do caso'
    }

    if (route.name === 'area-case-detail') {
      return 'Analise da area'
    }

    if (route.name === 'area-guidance') {
      return 'Conteudo vigente da area'
    }

    if (route.name === 'area-knowledge-review') {
      return 'Mudancas pendentes'
    }

    if (route.name === 'area-governance') {
      return 'Regras operacionais da area'
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
const isManagerOperationalShell = computed(
  () => auth.mockContext.isOperationalShell && auth.mockContext.profileKey === 'gestor_polos',
)
const isAreaOperationalShell = computed(() =>
  ['analista_area', 'gestor_area'].includes(auth.mockContext.profileKey),
)
const isAreaManagerOperationalShell = computed(
  () => auth.mockContext.isOperationalShell && auth.mockContext.profileKey === 'gestor_area',
)
const showAreaSelector = computed(
  () =>
    (auth.mockContext.linkedAreas || []).length > 1 &&
    (isAreaManagerOperationalShell.value ||
      (auth.mockContext.profileKey === 'analista_area' && route.name === 'area-guidance')),
)
const showOperationalBackAction = computed(() =>
  ['operator-case-detail', 'area-case-detail'].includes(String(route.name || '')),
)
const operationalBackRoute = computed(() =>
  route.name === 'area-case-detail' ? '/area/fila' : '/op/fila',
)
const operationalPoloModel = computed({
  get() {
    return auth.mockContext.currentPolo
  },
  set(value) {
    auth.setSelectedOperationalPolo(value)
  },
})
const operationalAreaModel = computed({
  get() {
    return auth.mockContext.currentArea
  },
  set(value) {
    auth.setSelectedOperationalArea(value)
  },
})

const routeRenderError = ref('')

const fallbackRoute = computed(() => {
  if (auth.mockContext.isOperationalShell) {
    return auth.mockContext.profileKey === 'gestor_area' ? '/area/operacao' : '/op/fila'
  }
  if (auth.mockContext.isStudentShell) {
    return '/aluno'
  }
  return '/admin/dashboard'
})

function clearRouteRenderError() {
  routeRenderError.value = ''
}

watch(
  () => route.meta.stage,
  (stage) => {
    if (stage) {
      journey.setStage(stage)
    }
  },
  { immediate: true },
)

watch(
  () => route.fullPath,
  () => {
    routeRenderError.value = ''
  },
)

onErrorCaptured((error) => {
  routeRenderError.value = String(error?.message || 'Falha ao carregar a tela atual.')
  console.error(error)
  return false
})
</script>

<template>
  <div v-if="isAuthLayout" class="relative min-h-screen overflow-hidden">
    <RouterView />
  </div>

  <div v-else-if="isWireframeLayout" class="min-h-screen bg-[#f5f4ff] text-slate-950">
    <RouterView />
  </div>

  <div v-else :class="['relative min-h-screen overflow-hidden', shellThemeClass]">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:rounded-full focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-slate-950"
    >
      Pular para o conteudo principal
    </a>

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

      <main id="main-content" class="flex-1 pb-8">
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
            <div v-if="!isOperationalShell" class="flex flex-wrap items-center gap-2">
              <span
                :class="[
                  'rounded-full px-3 py-1 text-xs font-semibold',
                  'soft-chip',
                ]"
              >
                {{ shellPresentation.label }}
              </span>
            </div>
            <h1
              :class="[
                'font-semibold text-slate-950',
                !isOperationalShell ? 'mt-3' : '',
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
            <template v-if="isOperationalShell">
              <div class="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700">
                <p class="font-semibold text-slate-900">{{ auth.mockContext.userName }}</p>
              </div>
              <template v-if="isAreaOperationalShell">
                <select
                  v-if="showAreaSelector"
                  v-model="operationalAreaModel"
                  :aria-label="isAreaManagerOperationalShell ? 'Selecionar area do gestor' : 'Selecionar area de trabalho'"
                  class="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700"
                >
                  <option v-for="area in auth.mockContext.linkedAreas" :key="area" :value="area">
                    {{ area }}
                  </option>
                </select>
                <div
                  v-else-if="isAreaManagerOperationalShell"
                  class="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700"
                >
                  {{ auth.mockContext.currentArea }}
                </div>
                <div
                  v-else-if="(auth.mockContext.linkedAreas || []).length > 1"
                  class="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700"
                >
                  Todas as suas areas
                </div>
                <div
                  v-else
                  class="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700"
                >
                  {{ auth.mockContext.currentArea }}
                </div>
              </template>
              <template v-else>
                <select
                  v-if="isManagerOperationalShell"
                  v-model="operationalPoloModel"
                  aria-label="Selecionar polo do gestor"
                  class="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700"
                >
                  <option v-for="polo in auth.mockContext.linkedPolos" :key="polo" :value="polo">
                    {{ polo }}
                  </option>
                </select>
                <div
                  v-else
                  class="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700"
                >
                  {{ auth.mockContext.currentPolo }}
                </div>
              </template>
              <RouterLink
                v-if="showOperationalBackAction"
                :to="operationalBackRoute"
                class="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Voltar para fila
              </RouterLink>
            </template>
            <div
              v-else
              class="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
            >
              <p class="font-semibold text-slate-900">{{ auth.mockContext.userName }}</p>
              <p class="mt-1">{{ auth.mockContext.userEmail }}</p>
              <p class="mt-1">Polo atual: {{ auth.mockContext.currentPolo }}</p>
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
            <section
              v-if="routeRenderError || !Component"
              class="rounded-[18px] border border-[rgba(166,31,40,0.24)] bg-[rgba(253,236,237,0.75)] p-5 text-slate-800"
            >
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-danger)]">
                Tela indisponivel
              </p>
              <h2 class="mt-2 text-lg font-semibold text-slate-950">
                Nao foi possivel carregar este modulo agora.
              </h2>
              <p class="mt-2 text-sm leading-6">
                {{ routeRenderError || 'A rota atual nao encontrou um componente valido para renderizar.' }}
              </p>
              <p class="mt-2 text-xs text-slate-600">
                Rota: {{ route.fullPath }} · Itens reconhecidos: {{ route.matched.length }}
              </p>
              <div class="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  class="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  @click="clearRouteRenderError"
                >
                  Tentar novamente
                </button>
                <RouterLink
                  :to="fallbackRoute"
                  class="inline-flex items-center rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  Voltar para modulo seguro
                </RouterLink>
                <RouterLink
                  to="/acesso-local"
                  class="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Ir para acesso local
                </RouterLink>
              </div>
            </section>
            <component :is="Component" v-else />
          </Transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>
