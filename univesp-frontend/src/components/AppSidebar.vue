<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { buildNavigationSections } from '@/data/navigation'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()

const mockContext = computed(() => auth.mockContext)
const navigationSections = computed(() => buildNavigationSections(mockContext.value))

const shellCopy = computed(() => {
  if (mockContext.value.isStudentShell) {
    return {
      chip: '',
      title: 'UNIVESP',
      description: 'Orientacao oficial primeiro. Solicitacao e acompanhamento quando necessario.',
    }
  }

  if (mockContext.value.isOperationalShell) {
    return {
      chip: '',
      title: 'UNIVESP',
      description: '',
    }
  }

  return {
    chip: '',
    title: 'Central de Atendimento UNIVESP',
    description: '',
  }
})

function isRouteActive(item) {
  const hasCustomMatch =
    (Array.isArray(item.matches) && item.matches.length > 0) ||
    (Array.isArray(item.prefixMatches) && item.prefixMatches.length > 0)

  if (Array.isArray(item.matches) && item.matches.length) {
    if (item.matches.some((match) => route.path === match)) {
      return true
    }
  }

  if (Array.isArray(item.prefixMatches) && item.prefixMatches.length) {
    if (item.prefixMatches.some((match) => route.path.startsWith(match))) {
      return true
    }
  }

  if (hasCustomMatch) {
    return false
  }

  return route.path === item.route || route.path.startsWith(`${item.route}/`)
}

function isGroupActive(item) {
  if (!item) return false
  if (isRouteActive(item)) return true
  return Array.isArray(item.children) && item.children.some((c) => isRouteActive(c))
}

function navLinkClass(item) {
  if (mockContext.value.isStudentShell) {
    return [
      'rounded-[18px] border px-4 py-3 transition',
      isRouteActive(item)
        ? 'border-[rgba(109,76,255,0.18)] bg-[rgba(109,76,255,0.08)] text-slate-950'
        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    ]
  }

  if (mockContext.value.isOperationalShell) {
    return [
      'rounded-[14px] border px-3 py-2.5 transition',
      isRouteActive(item)
        ? 'border-[rgba(209,50,57,0.16)] bg-[rgba(209,50,57,0.06)] text-slate-950'
        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    ]
  }

  return ['nav-link', isGroupActive(item) ? 'is-active' : '']
}
</script>

<template>
  <aside
    :class="[
      'w-full',
      mockContext.isStudentShell
        ? 'lg:sticky lg:top-4 lg:h-fit lg:w-[208px] xl:w-[220px]'
        : mockContext.isOperationalShell
          ? 'lg:sticky lg:top-4 lg:h-fit lg:w-[176px] xl:w-[188px]'
          : 'lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-[300px] xl:w-[320px]',
    ]"
  >
    <div
      :class="[
        mockContext.isOperationalShell
          ? 'flex h-full flex-col gap-3 rounded-[18px] border border-slate-200 bg-white p-3'
          : 'surface-panel rise-in flex h-full flex-col',
        mockContext.isStudentShell ? 'gap-5 p-4' : mockContext.isOperationalShell ? '' : 'gap-5 p-4 md:p-5',
      ]"
    >
      <div>
        <span
          v-if="shellCopy.chip"
          class="soft-chip"
        >
          {{ shellCopy.chip }}
        </span>
        <h2
          :class="[
            'font-semibold text-slate-950',
            mockContext.isStudentShell
              ? 'text-[1.35rem]'
              : mockContext.isOperationalShell
                ? 'text-[1rem]'
                : 'mt-3 text-[1.8rem]',
          ]"
        >
          {{ shellCopy.title }}
        </h2>
        <p
          v-if="!mockContext.isStudentShell && !mockContext.isOperationalShell"
          class="mt-2 text-sm leading-6 text-slate-600"
        >
          {{ shellCopy.description }}
        </p>
      </div>

      <nav :class="mockContext.isStudentShell ? 'grid gap-3' : mockContext.isOperationalShell ? 'grid gap-2.5' : 'grid gap-4'">
        <div
          v-for="section in navigationSections"
          :key="section.id"
          class="grid gap-2"
        >
          <p
            v-if="!mockContext.isStudentShell && !mockContext.isOperationalShell"
            class="px-2 text-xs font-semibold tracking-[0.12em] text-slate-500"
          >
            {{ section.label }}
          </p>
          <template
            v-for="item in section.items"
            :key="item.id"
          >
            <RouterLink
              :to="item.route"
              :class="navLinkClass(item)"
            >
              <template v-if="mockContext.isStudentShell">
                <div class="flex items-center justify-between gap-4">
                  <p class="text-sm font-semibold">{{ item.label }}</p>
                  <span
                    :class="[
                      'h-2.5 w-2.5 rounded-full',
                      isRouteActive(item) ? 'bg-[var(--color-primary)]' : 'bg-slate-300',
                    ]"
                  ></span>
                </div>
              </template>
              <template v-else-if="mockContext.isOperationalShell">
                <div class="flex items-center justify-between gap-4">
                  <p class="text-sm font-semibold">{{ item.label }}</p>
                  <span
                    :class="[
                      'h-2.5 w-2.5 rounded-full',
                      isRouteActive(item) ? 'bg-[var(--color-primary)]' : 'bg-slate-300',
                    ]"
                  ></span>
                </div>
              </template>
              <template v-else>
                <svg
                  class="h-4 w-4 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path :d="item.icon" />
                </svg>
                <p class="text-sm font-semibold">{{ item.label }}</p>
              </template>
            </RouterLink>
            <template
              v-if="!mockContext.isStudentShell && !mockContext.isOperationalShell && Array.isArray(item.children) && item.children.length"
            >
              <RouterLink
                v-for="child in item.children"
                :key="child.id"
                :to="child.route"
                :class="['nav-link', 'ml-5', isRouteActive(child) ? 'is-active' : '']"
              >
                <span
                  :class="[
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    isRouteActive(child) ? 'bg-amber-300' : 'bg-slate-400',
                  ]"
                ></span>
                <p class="text-sm font-normal">{{ child.label }}</p>
              </RouterLink>
            </template>
          </template>
        </div>
      </nav>

      <button
        v-if="mockContext.isStudentShell"
        type="button"
        class="mt-auto inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        @click="auth.logout()"
      >
        Sair
      </button>
    </div>
  </aside>
</template>
