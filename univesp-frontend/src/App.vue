<script setup>
import { computed, onErrorCaptured, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppSidebar from '@/components/AppSidebar.vue'
import MockContextBar from '@/components/MockContextBar.vue'
import { buildShellPresentation } from '@/services/mockContextRuntime'
import { useAuthStore } from '@/stores/auth'
import { useJourneyStore } from '@/stores/journey'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const journey = useJourneyStore()

const pageTitle = computed(() => {
  if (auth.mockContext.isOperationalShell) {
    if (route.name === 'operator-queue') {
      return auth.mockContext.profileKey === 'gestor_polos' ? 'Atendimentos do polo' : 'Meus atendimentos'
    }

    if (route.name === 'area-manager-home') {
      return 'Operação da área'
    }

    if (route.name === 'area-queue') {
      return auth.mockContext.profileKey === 'gestor_area' ? 'Casos da área' : 'Minha fila da área'
    }

    if (route.name === 'operator-case-detail') {
      return 'Análise do caso'
    }

    if (route.name === 'area-case-detail') {
      return 'Análise da área'
    }

    if (route.name === 'area-guidance') {
      return 'Conteúdo vigente da área'
    }

    if (route.name === 'area-knowledge-review') {
      return 'Mudancas pendentes'
    }

    if (route.name === 'area-governance') {
      return 'Regras operacionais da área'
    }

    if (route.name === 'operator-playbook') {
      return 'Consultar orientação'
    }

    if (route.name === 'operator-assisted-intake') {
      return 'Abrir atendimento em nome do aluno'
    }
  }

  return route.meta.title || 'CRM Univesp'
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
const APP_VISUAL_PREFERENCES_KEY = 'univesp.crm.visualPreferences'
const visualTheme = ref('light')
const visualScale = ref(0)
const visualReadableFont = ref(false)
const visualHighContrast = ref(false)
const visualScaleLabel = computed(() => {
  if (visualScale.value === 2) {
    return 'Texto grande'
  }

  if (visualScale.value === 1) {
    return 'Texto médio'
  }

  return 'Texto padrão'
})
const visualPreferencesSummary = computed(() => {
  const preferences = [visualTheme.value === 'dark' ? 'tema escuro' : 'tema claro', visualScaleLabel.value]

  if (visualReadableFont.value) {
    preferences.push('fonte legível')
  }

  if (visualHighContrast.value) {
    preferences.push('alto contraste')
  }

  return preferences.join(', ')
})
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
const routeRecoveryAttemptedFor = ref('')
const routeRecoveryHardReloadFor = ref('')
const routerBasePath = String(
  import.meta.env.VITE_ROUTER_BASE || import.meta.env.VITE_APP_BASE || '/',
)
  .trim()
  .replace(/\/+$/, '')

let isRecoveringFaqBuilderRoute = false

const fallbackRoute = computed(() => {
  if (auth.mockContext.isOperationalShell) {
    return auth.mockContext.profileKey === 'gestor_area' ? '/area/operacao' : '/op/fila'
  }
  if (auth.mockContext.isStudentShell) {
    return '/aluno'
  }
  return '/admin/dashboard'
})
const routeViewRenderKey = computed(() => {
  const routeName = String(route.name || 'unknown')
  if (routeName === 'admin-faq-flow' || routeName === 'admin-faq-builder') {
    const bundleId = String(route.params?.bundleId || '')
    return `faq:${routeName}:${bundleId}`
  }
  return routeName
})

function persistVisualPreferences() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      APP_VISUAL_PREFERENCES_KEY,
      JSON.stringify({
        theme: visualTheme.value,
        scale: visualScale.value,
        readableFont: visualReadableFont.value,
        highContrast: visualHighContrast.value,
      }),
    )
  } catch {
    // Mantem a interface operavel mesmo quando o navegador bloqueia storage.
  }
}

function applyVisualPreferences(shouldPersist = true) {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  root.classList.toggle('theme-dark', visualTheme.value === 'dark')
  root.classList.toggle('theme-light', visualTheme.value !== 'dark')
  root.classList.toggle('a11y-zoom-lg', visualScale.value === 1)
  root.classList.toggle('a11y-zoom-xl', visualScale.value === 2)
  root.classList.toggle('a11y-readable', visualReadableFont.value)
  root.classList.toggle('a11y-high-contrast', visualHighContrast.value)

  if (shouldPersist) {
    persistVisualPreferences()
  }
}

function loadVisualPreferences() {
  if (typeof window === 'undefined') {
    applyVisualPreferences(false)
    return
  }

  try {
    const storedPreferences = JSON.parse(
      window.localStorage.getItem(APP_VISUAL_PREFERENCES_KEY) || '{}',
    )
    visualTheme.value = storedPreferences.theme === 'dark' ? 'dark' : 'light'
    visualScale.value = Math.min(2, Math.max(0, Number(storedPreferences.scale || 0)))
    visualReadableFont.value = storedPreferences.readableFont === true
    visualHighContrast.value = storedPreferences.highContrast === true
  } catch {
    visualTheme.value = 'light'
    visualScale.value = 0
    visualReadableFont.value = false
    visualHighContrast.value = false
  }

  applyVisualPreferences(false)
}

function setVisualTheme(theme) {
  visualTheme.value = theme === 'dark' ? 'dark' : 'light'
  applyVisualPreferences()
}

function increaseVisualScale() {
  visualScale.value = Math.min(2, visualScale.value + 1)
  applyVisualPreferences()
}

function decreaseVisualScale() {
  visualScale.value = Math.max(0, visualScale.value - 1)
  applyVisualPreferences()
}

function toggleReadableFont() {
  visualReadableFont.value = !visualReadableFont.value
  applyVisualPreferences()
}

function toggleHighContrast() {
  visualHighContrast.value = !visualHighContrast.value
  applyVisualPreferences()
}

function resetVisualPreferences() {
  visualTheme.value = 'light'
  visualScale.value = 0
  visualReadableFont.value = false
  visualHighContrast.value = false
  applyVisualPreferences()
}

function clearRouteRenderError() {
  routeRenderError.value = ''
}

function extractBundleIdFromPath(path = '') {
  const normalized = String(path || '')
    .split('?')[0]
    .split('#')[0]
    .trim()

  if (!normalized) {
    return ''
  }

  const editorMatch = normalized.match(/\/admin\/faq-editor\/([^/?#]+)/i)
  if (editorMatch?.[1]) {
    try {
      return decodeURIComponent(editorMatch[1])
    } catch {
      return String(editorMatch[1] || '').trim()
    }
  }

  const legacyMatch = normalized.match(/\/admin\/faq\/([^/?#]+)\/editor/i)
  if (legacyMatch?.[1]) {
    try {
      return decodeURIComponent(legacyMatch[1])
    } catch {
      return String(legacyMatch[1] || '').trim()
    }
  }

  return ''
}

function normalizeBrowserPath(pathname = '') {
  const rawPath = String(pathname || '').trim() || '/'
  const base = routerBasePath && routerBasePath !== '/' ? routerBasePath : ''
  if (!base) {
    return rawPath
  }
  if (rawPath === base) {
    return '/'
  }
  if (rawPath.startsWith(`${base}/`)) {
    return rawPath.slice(base.length) || '/'
  }
  return rawPath
}

function readBrowserQueryObject() {
  if (typeof window === 'undefined') {
    return {}
  }
  try {
    return Object.fromEntries(new URLSearchParams(window.location.search || '').entries())
  } catch {
    return {}
  }
}

function recoverFaqBuilderRouteIfNeeded() {
  if (typeof window === 'undefined') {
    return
  }

  if (isRecoveringFaqBuilderRoute) {
    return
  }

  const normalizedPathname = normalizeBrowserPath(window.location.pathname || '/')
  const currentHrefPath = `${normalizedPathname}${window.location.search || ''}`
  if (!currentHrefPath) {
    return
  }

  const decodedPath = (() => {
    try {
      return decodeURIComponent(currentHrefPath)
    } catch {
      return currentHrefPath
    }
  })()
  const isFaqEditorPath = /\/admin\/faq-editor\/[^/?#]+/i.test(decodedPath)
  const isFaqLegacyEditorPath = /\/admin\/faq\/[^/?#]+\/editor/i.test(decodedPath)

  const bundleId = extractBundleIdFromPath(decodedPath)
  if (
    route.name === 'admin-faq-builder' &&
    bundleId &&
    String(route.params.bundleId || '') === String(bundleId)
  ) {
    return
  }

  const shouldAttemptRecovery =
    (isFaqEditorPath || isFaqLegacyEditorPath) &&
    (route.matched.length === 0 || route.name !== 'admin-faq-builder')

  if (!shouldAttemptRecovery) {
    return
  }

  const recoveryKey = `${currentHrefPath}::${String(route.name || 'unknown')}`
  if (routeRecoveryAttemptedFor.value === recoveryKey) {
    return
  }
  routeRecoveryAttemptedFor.value = recoveryKey

  if (!bundleId) {
    console.warn('[app][faq-route-recovery-skipped]', {
      reason: 'bundle_id_missing',
      browserPath: currentHrefPath,
    })
    return
  }

  const browserQuery = readBrowserQueryObject()
  const recoveryQuery = {
    ...browserQuery,
  }
  const safeQueryValue =
    browserQuery.safe !== undefined ? browserQuery.safe : route.query.safe
  if (safeQueryValue !== undefined && String(safeQueryValue).trim() !== '') {
    recoveryQuery.safe = String(safeQueryValue)
  }
  const fullscreenQueryValue =
    browserQuery.fullscreen !== undefined
      ? browserQuery.fullscreen
      : route.query.fullscreen
  if (
    fullscreenQueryValue !== undefined &&
    String(fullscreenQueryValue).trim() !== ''
  ) {
    recoveryQuery.fullscreen = String(fullscreenQueryValue)
  }
  const recoveryTarget = {
    name: 'admin-faq-builder',
    params: {
      bundleId,
    },
    query: recoveryQuery,
  }

  const resolvedForReplace = router.resolve(recoveryTarget)
  if (resolvedForReplace.fullPath === route.fullPath) {
    return
  }

  const hardReloadHref = router.resolve({
    ...recoveryTarget,
    query: {
      ...recoveryQuery,
      recover: String(browserQuery.recover || '1'),
      reload: String(Date.now()),
    },
  }).href

  isRecoveringFaqBuilderRoute = true
  router
    .replace(recoveryTarget)
    .then(() => {
      const shouldHardRecover =
        route.name !== 'admin-faq-builder' &&
        routeRecoveryHardReloadFor.value !== recoveryKey &&
        String(browserQuery.recover || '') !== '1'

      if (!shouldHardRecover) {
        return
      }

      routeRecoveryHardReloadFor.value = recoveryKey
      window.location.assign(hardReloadHref)
    })
    .catch((error) => {
      console.error('[app][faq-route-recovery-failed]', error)
      if (
        routeRecoveryHardReloadFor.value !== recoveryKey &&
        String(browserQuery.recover || '') !== '1'
      ) {
        routeRecoveryHardReloadFor.value = recoveryKey
        window.location.assign(hardReloadHref)
      }
    })
    .finally(() => {
      isRecoveringFaqBuilderRoute = false
    })
}

function forceRouteReload() {
  if (typeof window === 'undefined') {
    return
  }
  const targetPath =
    route.matched.length > 0
      ? route.path || route.fullPath || fallbackRoute.value
      : fallbackRoute.value
  const nextHref = router.resolve({
    path: targetPath,
    query: {
      ...route.query,
      reload: String(Date.now()),
    },
  }).href
  window.location.assign(nextHref)
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
    recoverFaqBuilderRouteIfNeeded()
  },
  { immediate: true },
)

onMounted(() => {
  loadVisualPreferences()
})

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

  <div v-else :class="['relative min-h-screen overflow-x-clip', shellThemeClass]">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:rounded-full focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-slate-950"
    >
      Pular para o conteúdo principal
    </a>

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
      <div
        :class="[
          'app-shell-sidebar shrink-0',
          isStudentShell ? 'hidden lg:block' : '',
        ]"
      >
        <AppSidebar />
      </div>

      <main
        id="main-content"
        class="app-shell-main min-w-0 flex-1 pb-8"
      >
        <section
          :class="[
            'app-a11y-toolbar',
            isOperationalShell ? 'mb-3' : '',
          ]"
          aria-label="Preferências de visualização"
        >
          <div class="app-a11y-toolbar__group" role="group" aria-label="Tema">
            <button
              type="button"
              class="app-a11y-toolbar__button"
              :class="{ 'is-active': visualTheme === 'light' }"
              :aria-pressed="visualTheme === 'light'"
              @click="setVisualTheme('light')"
            >
              Claro
            </button>
            <button
              type="button"
              class="app-a11y-toolbar__button"
              :class="{ 'is-active': visualTheme === 'dark' }"
              :aria-pressed="visualTheme === 'dark'"
              @click="setVisualTheme('dark')"
            >
              Escuro
            </button>
          </div>

          <div class="app-a11y-toolbar__group" role="group" aria-label="Tamanho do texto">
            <button
              type="button"
              class="app-a11y-toolbar__button"
              :disabled="visualScale === 0"
              aria-label="Diminuir texto"
              @click="decreaseVisualScale"
            >
              A-
            </button>
            <output class="app-a11y-toolbar__status" aria-live="polite">
              {{ visualScaleLabel }}
            </output>
            <button
              type="button"
              class="app-a11y-toolbar__button"
              :disabled="visualScale === 2"
              aria-label="Aumentar texto"
              @click="increaseVisualScale"
            >
              A+
            </button>
          </div>

          <div class="app-a11y-toolbar__group" role="group" aria-label="Leitura e contraste">
            <button
              type="button"
              class="app-a11y-toolbar__button"
              :class="{ 'is-active': visualReadableFont }"
              :aria-pressed="visualReadableFont"
              @click="toggleReadableFont"
            >
              Fonte legível
            </button>
            <button
              type="button"
              class="app-a11y-toolbar__button"
              :class="{ 'is-active': visualHighContrast }"
              :aria-pressed="visualHighContrast"
              @click="toggleHighContrast"
            >
              Alto contraste
            </button>
            <button
              type="button"
              class="app-a11y-toolbar__button"
              aria-label="Redefinir preferências de visualização"
              @click="resetVisualPreferences"
            >
              Redefinir
            </button>
          </div>

          <p class="sr-only" aria-live="polite">
            Preferências ativas: {{ visualPreferencesSummary }}.
          </p>
        </section>

        <MockContextBar v-if="!isStudentShell && !isOperationalShell" />

        <header
          v-if="!isStudentShell"
          :class="[
            isOperationalShell
              ? 'mb-3 flex flex-col gap-3 px-1 py-0.5 lg:flex-row lg:items-start lg:justify-between'
              : 'surface-panel rise-in mb-4 flex flex-col gap-4 p-5 xl:flex-row xl:items-center xl:justify-between',
          ]"
        >
          <div class="min-w-0 flex-1">
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

          <div class="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            <template v-if="isOperationalShell">
              <div class="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700">
                <p class="font-semibold text-slate-900">{{ auth.mockContext.userName }}</p>
              </div>
              <template v-if="isAreaOperationalShell">
                <select
                  v-if="showAreaSelector"
                  v-model="operationalAreaModel"
                  :aria-label="isAreaManagerOperationalShell ? 'Selecionar área do gestor' : 'Selecionar área de trabalho'"
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
                  Todas as suas áreas
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
              class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
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
              v-if="routeRenderError || (!Component && route.matched.length === 0)"
              class="rounded-[8px] border border-[rgba(166,31,40,0.24)] bg-[rgba(253,236,237,0.75)] p-5 text-slate-800"
            >
              <p class="text-xs font-semibold uppercase tracking-normal text-[var(--color-danger)]">
                Tela indisponível
              </p>
              <h2 class="mt-2 text-lg font-semibold text-slate-950">
                Não foi possível carregar este módulo agora.
              </h2>
              <p class="mt-2 text-sm leading-6">
                {{ routeRenderError || 'A rota atual não encontrou um componente válido para renderizar.' }}
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
                <button
                  type="button"
                  class="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  @click="forceRouteReload"
                >
                  Recarregar app
                </button>
                <RouterLink
                  :to="fallbackRoute"
                  class="inline-flex items-center rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  Voltar para módulo seguro
                </RouterLink>
                <RouterLink
                  to="/acesso-local"
                  class="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Ir para acesso local
                </RouterLink>
              </div>
            </section>
            <section
              v-else-if="!Component"
              class="rounded-[8px] border border-slate-200 bg-white p-5 text-slate-700"
            >
              <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">
                Carregando módulo
              </p>
              <h2 class="mt-2 text-lg font-semibold text-slate-950">
                Preparando a tela selecionada
              </h2>
              <p class="mt-2 text-sm leading-6">
                Aguarde alguns segundos. Se o carregamento nao concluir, use "Recarregar app".
              </p>
              <div class="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  class="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  @click="forceRouteReload"
                >
                  Recarregar app
                </button>
                <RouterLink
                  :to="fallbackRoute"
                  class="inline-flex items-center rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  Voltar para módulo seguro
                </RouterLink>
              </div>
            </section>
            <div v-else class="crm-page-container min-w-0 w-full">
              <component :is="Component" :key="routeViewRenderKey" />
            </div>
          </Transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>
